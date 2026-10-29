/**
 * Clicks through the built report builder page (index.html) in jsdom, the way finance would.
 * Run `npm run build:report-builder` first; `npm run test:report-builder` does both.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { beforeEach, describe, expect, it } from 'vitest';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

let dom: JSDOM;
let doc: Document;
let errors: string[];

/** Opens the page. Most tests start with every group open ("Expand all"); the defaults have their own tests. */
function load(expand = true) {
  errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String(e.message ?? e)));
  vc.on('error', (e) => errors.push(String(e)));
  dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc, pretendToBeVisual: true });
  doc = dom.window.document;
  if (expand) (doc.getElementById('colAll') as HTMLButtonElement).click();
}
beforeEach(() => load());

/* ---------- helpers that act like a person ---------- */
const $ = <T extends Element = HTMLElement>(sel: string) => doc.querySelector(sel) as T | null;
const $$ = (sel: string) => [...doc.querySelectorAll(sel)] as HTMLElement[];
const text = (sel: string) => $(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const S = () => (dom.window as any).__builder.state();
const formulaOf = (id: string) => S().nodes.find((n: any) => n.id === id).formula as string;
const press = (el: Element, key: string, opts: KeyboardEventInit = {}) => el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
const type = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string, event = 'change') => {
  el.value = value;
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  if (event === 'change') el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
};
/** Opens a box on the map (same as clicking its header). */
const openNode = (id: string) => press(($(`.node[data-id="${id}"] .nh`) ?? $(`.mrow[data-id="${id}"]`))!, 'Enter');
/** Opens one input (same as clicking its row). */
const openField = (name: string) => press($(`.frow[data-var="${name}"]`)!, 'Enter');
/** The floating toolbar on the canvas. */
const addFromMenu = (what: 'input' | 'section' | 'calc' | 'check' | 'setting') => { $(`[data-act="${what}"]`)!.click(); };
/** Finishes an in-place rename on a card. */
const renameInline = (value: string) => { const i = $<HTMLInputElement>('.inl')!; i.value = value; press(i, 'Enter'); };
const changes = () => $$('#changes .li .t').map((e) => e.firstChild?.textContent ?? '');
const testsPassing = () => text('#heroTests');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('loading', () => {
  it('opens with no errors and the verified example figures', () => {
    expect(errors).toEqual([]);
    expect(text('#heroFig')).toBe('£2,687.50');
    expect(text('#heroWage')).toBe('29.8%');
    expect(testsPassing()).toBe('8 of 8');
    expect(text('#heroChanges')).toBe('No changes');
    expect($<HTMLButtonElement>('#publishBtn')!.disabled).toBe(true);
  });
  it('draws every box in four labelled columns', () => {
    expect($$('.lane-h').map((e) => e.textContent?.replace(/^\d/, ''))).toEqual(['Inputs', 'Calculations', 'Day totals', 'Checks & actions']);
    expect($$('.node')).toHaveLength(12); // 6 input sections + 6 calculation groups; figures are rows inside them
    expect($$('.mrow')).toHaveLength(39);
    expect($$('.frow')).toHaveLength(34);
  });
  it('shows the working for a formula', () => {
    openNode('lunchNet');
    expect(text('#fxRes')).toBe('£1,200.00 − £120.00 − £180.00 − £50.00 = £850.00');
  });
});

describe('adding', () => {
  it('adds an input from the toolbar, named and ready to rename on the card', () => {
    addFromMenu('input');
    const inl = $<HTMLInputElement>('.frow .inl')!;
    expect(inl.value).toBe('New input');
    expect(doc.activeElement).toBe(inl);
    renameInline('Lunch card tips');
    expect($('.frow[data-var="Lunch card tips"]')).not.toBeNull();
    addFromMenu('input'); renameInline('New input');
    expect($('.frow[data-var="New input"]')).not.toBeNull();
    expect(changes()).toContain('Added New input');
    expect(text('#toast')).toMatch(/Added an input/);
  });
  it('adds an input at the bottom of a section, with the next free name', () => {
    $('.node[data-id="wages"] .addrow')!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    $('.node[data-id="wages"] .addrow')!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(S().nodes.find((n: any) => n.id === 'wages').fields.map((f: any) => f.name)).toEqual(['Wage cost', 'New input', 'New input 2']);
  });
  it('adds a section with its first input', () => {
    addFromMenu('section');
    const sec = S().nodes.find((n: any) => n.title === 'New section');
    expect(sec.fields).toHaveLength(1);
    renameInline('Payments');
    expect(text(`.node[data-id="${sec.id}"] .nt`)).toBe('Payments');
  });
  it('adds a setting to Site settings', () => {
    addFromMenu('setting');
    expect(S().nodes.find((n: any) => n.id === 'settings').fields.at(-1).name).toBe('New setting');
  });
  it('adds a calculation, works it out as you type, and explains mistakes', () => {
    addFromMenu('calc');
    const fx = $<HTMLTextAreaElement>('#fx')!;
    type(fx, '[Lunch net] + [Dinner net]', 'input');
    expect(text('#fxRes')).toBe('£850.00 + £1,700.00 = £2,550.00');
    type(fx, '[Lunch net] +', 'input');
    expect(text('#fxRes')).toBe('The formula stops too early');
    type(fx, 'Lunch net', 'input');
    expect(text('#fxRes')).toBe('Put names in [brackets], like [Lunch gross]');
  });
  it('suggests figures after you type [', () => {
    openNode('lunchNet');
    const fx = $<HTMLTextAreaElement>('#fx')!;
    fx.value += ' + [din'; fx.selectionStart = fx.selectionEnd = fx.value.length;
    fx.dispatchEvent(new dom.window.Event('input'));
    expect(text('#insHead')).toBe('Figures matching “din”');
    const names = $$('#insList button').map((b) => b.textContent);
    expect(names.slice(0, 4)).toEqual(['Dinner gross', 'Dinner service charge', 'Dinner VAT', 'Dinner discounts']);
    expect(names).toContain('Dinner net');
    $$('#insList button').find((b) => b.textContent === 'Dinner net')!.click();
    expect(formulaOf('lunchNet')).toMatch(/\+ \[Dinner net\]$/);
  });
});

describe('renaming', () => {
  it('updates every formula and email that uses the name, and keeps the answers', () => {
    openField('Lunch gross');
    type($<HTMLInputElement>('#nm')!, 'Lunch sales');
    expect(formulaOf('lunchNet')).toBe('[Lunch sales] − [Lunch service charge] − [Lunch VAT] − [Lunch discounts]');
    expect(text('#heroFig')).toBe('£2,687.50');
    expect(testsPassing()).toBe('8 of 8');
    expect(changes()).toContain('Renamed Lunch gross');
    expect(changes()).not.toContain('Changed Lunch net');
  });
  it('renames a calculation that an email shows', () => {
    openNode('dayNet');
    type($<HTMLInputElement>('#nm')!, 'Net sales');
    expect(S().nodes.find((n: any) => n.id === 'email').uses).toContain('Net sales');
    expect(formulaOf('wagePct')).toBe('if([Net sales] > 0, [Wage cost] ÷ [Net sales], 0)');
    expect(text('#heroFig')).toBe('£2,687.50');
  });
  it('refuses a name that is taken, and says why', () => {
    openField('Lunch gross');
    type($<HTMLInputElement>('#nm')!, 'dinner VAT');
    expect(text('#nmErr')).toBe('There is already a figure called dinner VAT');
    expect(formulaOf('lunchNet')).toMatch(/^\[Lunch gross\]/);
  });
  it('refuses brackets in names', () => {
    openField('Lunch gross');
    type($<HTMLInputElement>('#nm')!, 'Lunch [gross]');
    expect(text('#nmErr')).toBe('Names can’t contain [ or ]');
  });
});

describe('changing', () => {
  it('moves an input to another section', () => {
    openField('Deliveroo gross');
    type($<HTMLSelectElement>('#sec')!, 'wages');
    expect(S().nodes.find((n: any) => n.id === 'wages').fields.map((f: any) => f.name)).toContain('Deliveroo gross');
    expect(changes()).toContain('Moved Deliveroo gross');
  });
  it('makes an input optional and adds help for managers', () => {
    openField('Lunch discounts');
    $<HTMLButtonElement>('#req')!.click();
    type($<HTMLInputElement>('#help')!, 'Staff meals and comps');
    const f = S().nodes.find((n: any) => n.id === 'lunch').fields.find((x: any) => x.name === 'Lunch discounts');
    expect(f).toMatchObject({ optional: true, help: 'Staff meals and comps' });
    expect(changes()).toContain('Changed how managers see Lunch discounts');
  });
  it('changing an example value recalculates without counting as a change', () => {
    openField('Wage cost');
    type($<HTMLInputElement>('#ex')!, '1000', 'input');
    expect(text('#heroWage')).toBe('37.2%');
    expect(S().nodes.find((n: any) => n.id === 'check')).toBeTruthy();
    expect(text('#heroChanges')).toBe('No changes');
  });
  it('changing a setting counts as a change', () => {
    openField('VAT rate');
    type($<HTMLInputElement>('#ex')!, '17.5%', 'input');
    expect(changes()).toContain('Changed the VAT rate setting');
  });
});

describe('connecting', () => {
  it('connects a new input to a calculation from “Use it in…”, and the total follows', () => {
    openNode('lunch');
    $<HTMLButtonElement>('#addHere')!.click();
    type($<HTMLInputElement>('#nm')!, 'Lunch tips');
    type($<HTMLInputElement>('#ex')!, '100', 'input');
    type($<HTMLSelectElement>('#useIn')!, 'lunchNet');
    expect(formulaOf('lunchNet')).toMatch(/\+ \[Lunch tips\]$/);
    expect(text('#heroFig')).toBe('£2,787.50');
    expect(testsPassing()).toBe('3 of 8'); // lunch, day total, wage %, net a head and vs target all move
  });
  it('only offers boxes that would not make a loop or a repeat', () => {
    openNode('dayNet');
    const offered = $$('#useIn option').map((o) => o.textContent);
    expect(offered).not.toContain('Lunch net');
    expect(offered).not.toContain('Wage %');
    expect(offered).not.toContain('Send the summary email');
    expect(offered).toContain('Wages over red?');
  });
  it('adds a figure to the summary email by ticking it', () => {
    openNode('email');
    const box = $$('#inspector input[type=checkbox]').find((c) => (c as HTMLInputElement).dataset.n === 'Deliveroo net') as HTMLInputElement;
    box.checked = true; box.dispatchEvent(new dom.window.Event('change'));
    expect(S().nodes.find((n: any) => n.id === 'email').uses).toContain('Deliveroo net');
  });
  it('removes a link from the line’s menu', () => {
    const hit = $$('#edges .hit').find((h) => h.getAttribute('data-src') === 'Lunch discounts' && h.getAttribute('data-tgt') === 'lunchNet')!;
    hit.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(text('.linkpop')).toMatch(/Lunch discounts feeds Lunch net/);
    $<HTMLButtonElement>('.linkpop [data-rm]')!.click();
    expect(formulaOf('lunchNet')).toBe('[Lunch gross] − [Lunch service charge] − [Lunch VAT]');
    expect(testsPassing()).toBe('3 of 8');
  });
});

describe('deleting', () => {
  it('blocks deleting something that is used, and says what uses it', () => {
    openField('Lunch VAT');
    expect($<HTMLButtonElement>('#del')!.disabled).toBe(true);
    expect(text('#inspector .why')).toBe('Take it out of Lunch net first.');
    press(doc.body, 'Delete');
    expect(text('#toast')).toBe('Lunch VAT is used by Lunch net. Take it out of those first.');
    expect($('.frow[data-var="Lunch VAT"]')).not.toBeNull();
  });
  it('deletes an unused input, and Undo brings it back', () => {
    addFromMenu('input');
    $<HTMLButtonElement>('#del')!.click();
    expect($('.frow[data-var="New input"]')).toBeNull();
    expect(text('#toast')).toMatch(/Deleted New input/);
    $<HTMLButtonElement>('#toastUndo')!.click();
    expect($('.frow[data-var="New input"]')).not.toBeNull();
  });
  it('deletes with the keyboard, and ⌘Z / Ctrl Z undoes', () => {
    addFromMenu('calc');
    renameInline('New calculation');
    press(doc.body, 'Delete');
    expect($('.mrow[data-var="New calculation"]')).toBeNull();
    press(doc.body, 'z', { metaKey: true });
    expect($('.mrow[data-var="New calculation"]')).not.toBeNull();
    press(doc.body, 'z', { ctrlKey: true });
    press(doc.body, 'z', { ctrlKey: true });
    expect($('.mrow[data-var="New calculation"]')).toBeNull();
  });
  it('deletes a whole section once nothing uses its inputs', () => {
    addFromMenu('section');
    const id = S().sel;
    $<HTMLButtonElement>('#delSec')!.click();
    expect(S().nodes.some((n: any) => n.id === id)).toBe(false);
    openNode('lunch');
    expect($<HTMLButtonElement>('#delSec')!.disabled).toBe(true);
  });
  it('a deleted figure with a test can have its test removed', () => {
    // Tips is shown by the email and the SharePoint save, so take it out of both first.
    openNode('email');
    const box = $$('#inspector input[type=checkbox]').find((c) => (c as HTMLInputElement).dataset.n === 'Total tips') as HTMLInputElement;
    box.checked = false; box.dispatchEvent(new dom.window.Event('change'));
    $$('#edges .hit').find((h) => h.getAttribute('data-src') === 'Total tips' && h.getAttribute('data-tgt') === 'sp')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    $<HTMLButtonElement>('.linkpop [data-rm]')!.click();
    openNode('tipsTotal'); $<HTMLButtonElement>('#del')!.click();
    expect(text('#tests')).toMatch(/This figure was deleted/);
    $<HTMLButtonElement>('#tests [data-drop]')!.click();
    expect(testsPassing()).toBe('7 of 7');
  });
});

describe('tests and publishing', () => {
  it('a formula change that moves totals blocks approval until someone confirms', () => {
    openNode('lunchNet');
    type($<HTMLTextAreaElement>('#fx')!, '[Lunch gross] − [Lunch VAT] − [Lunch discounts]', 'input');
    expect(testsPassing()).toBe('3 of 8');
    expect($<HTMLButtonElement>('#publishBtn')!.disabled).toBe(true);
    expect(text('#heroState')).toBe('5 tests failing');
    while ($('#tests [data-fix]')) $<HTMLButtonElement>('#tests [data-fix]')!.click();
    expect(testsPassing()).toBe('8 of 8');
    expect(changes()).toContain('Changed the expected Lunch net');
    expect($<HTMLButtonElement>('#publishBtn')!.disabled).toBe(false);
    $<HTMLButtonElement>('#publishBtn')!.click();
    expect(text('#heroState')).toBe('Waiting for a second finance user');
  });
  it('a broken formula blocks approval', () => {
    openNode('dinnerNet');
    type($<HTMLTextAreaElement>('#fx')!, '[Dinner gross] − ', 'input');
    expect(text('#heroState')).toBe('A formula needs fixing');
    expect($<HTMLButtonElement>('#publishBtn')!.disabled).toBe(true);
  });
  it('Undo all changes gets back to v1.3', () => {
    addFromMenu('input');
    openField('Lunch gross');
    type($<HTMLInputElement>('#nm')!, 'Lunch sales');
    $<HTMLButtonElement>('#undoAll')!.click();
    expect(text('#heroChanges')).toBe('No changes');
    expect(formulaOf('lunchNet')).toMatch(/^\[Lunch gross\]/);
  });
});

describe('assistant suggestions', () => {
  it('card fees: adds the section, setting, two calculations and the email line', async () => {
    $<HTMLButtonElement>('[data-sug="fees"]')!.click();
    await sleep(650);
    $<HTMLButtonElement>('#applyP')!.click();
    const R = (dom.window as any).__builder.computeAll();
    expect(R.vals['Card fees']).toBeCloseTo(50.75);
    expect(R.vals['Net after card fees']).toBeCloseTo(2636.75);
    expect(S().nodes.find((n: any) => n.id === 'email').uses).toContain('Net after card fees');
    expect(testsPassing()).toBe('8 of 8');
    expect(changes()).toEqual(expect.arrayContaining(['Added Card takings', 'Added Card fee rate', 'Added Card fees', 'Added Net after card fees']));
  });
  it('service charge: takes it out of both nets and fails the tests', async () => {
    $<HTMLButtonElement>('[data-sug="sc"]')!.click();
    await sleep(650);
    $<HTMLButtonElement>('#applyP')!.click();
    expect(formulaOf('lunchNet')).toBe('[Lunch gross] − [Lunch VAT] − [Lunch discounts]');
    expect(testsPassing()).toBe('3 of 8');
    $<HTMLButtonElement>('#toastUndo')!.click();
    expect(testsPassing()).toBe('8 of 8');
  });
});

describe('other views', () => {
  it('list view shows every box', () => {
    $<HTMLButtonElement>('[data-view="list"]')!.click();
    expect($$('.lrow')).toHaveLength(45);
    expect(text('.lrow[data-id="lunchNet"] .worked')).toBe('£1,200.00 − £120.00 − £180.00 − £50.00 = £850.00');
  });
  it('the form tab edits the same inputs', () => {
    $<HTMLButtonElement>('#tab-form')!.click();
    $<HTMLButtonElement>('[data-addf="dinner"]')!.click();
    expect($$('.fieldrow').map((r) => r.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('New input')]));
    $<HTMLButtonElement>('[data-req]')!.click();
    expect(changes()).toContain('Changed how managers see Lunch gross');
  });
  it('the after-submit tab adds and removes steps', () => {
    $<HTMLButtonElement>('#tab-flow')!.click();
    $<HTMLButtonElement>('[data-at="2"]')!.click();
    $('[data-l="1"]')!.click();
    expect(text('.flow')).toMatch(/Ask someone to approve/);
    $<HTMLButtonElement>('[data-rm]')!.click();
    expect(text('.flow')).not.toMatch(/Ask someone to approve/);
  });
});

describe('safety', () => {
  it('shows names as text, so HTML typed into a name can’t run', () => {
    openField('Lunch gross');
    type($<HTMLInputElement>('#nm')!, '<img src=x onerror="window.__pwned=1">');
    expect($('.node img, #inspector img, #changes img')).toBeNull();
    expect((dom.window as any).__pwned).toBeUndefined();
    expect(text('.frow')).toContain('<img src=x');
  });
  it('a formula can’t run code', () => {
    openNode('lunchNet');
    type($<HTMLTextAreaElement>('#fx')!, 'constructor.constructor("window.__pwned=1")()', 'input');
    expect((dom.window as any).__pwned).toBeUndefined();
    expect(text('#fxRes')).toMatch(/brackets|understand/);
  });
  it('never logs an error while clicking through everything', () => {
    addFromMenu('input'); addFromMenu('calc'); addFromMenu('check'); addFromMenu('section'); addFromMenu('setting');
    $<HTMLButtonElement>('[data-view="list"]')!.click(); $<HTMLButtonElement>('[data-view="map"]')!.click();
    $<HTMLButtonElement>('#tab-form')!.click(); $<HTMLButtonElement>('#tab-flow')!.click(); $<HTMLButtonElement>('#tab-calc')!.click();
    for (let i = 0; i < 10; i++) press(doc.body, 'z', { metaKey: true });
    expect(errors).toEqual([]);
    expect(text('#heroChanges')).toBe('No changes');
  });
});

describe('zoom and mini-map', () => {
  const scale = () => /scale\([^)]*\)/.exec($('#cv')!.style.transform)![0];
  it('zooms in and out in 10% steps, within limits, and resets', () => {
    expect(text('#zPct')).toBe('100%');
    $<HTMLButtonElement>('#zIn')!.click();
    expect(text('#zPct')).toBe('110%');
    expect(scale()).toBe('scale(1.1)');
    for (let i = 0; i < 20; i++) $<HTMLButtonElement>('#zOut')!.click();
    expect(text('#zPct')).toBe('35%');
    $<HTMLButtonElement>('#zPct')!.click();
    expect(scale()).toBe('scale(1)');
  });
  it('keeps the zoom when the map redraws', () => {
    $<HTMLButtonElement>('#zOut')!.click();
    openNode('dayNet');
    expect(scale()).toBe('scale(0.9)');
  });
  it('draws one mini-map block per box, plus the view window', () => {
    expect($$('#mm rect[data-id]')).toHaveLength(12);
    expect($('#mmView')).not.toBeNull();
    addFromMenu('section'); renameInline('Agency');
    expect($$('#mm rect[data-id]')).toHaveLength(13);
  });
});

describe('search', () => {
  const find = (q: string) => { const f = $<HTMLInputElement>('#find')!; f.value = q; f.dispatchEvent(new dom.window.Event('input')); return f; };
  it('finds figures, sections and actions by part of the name', () => {
    find('vat');
    expect($$('#results [data-i]').map((b) => b.querySelector('span:last-child')!.firstChild!.textContent)).toEqual(['VAT rate', 'Lunch VAT', 'Dinner VAT']);
    find('email');
    expect(text('#results')).toContain('Send the summary email');
    find('zzz');
    expect(text('#results')).toBe('Nothing called “zzz”');
  });
  it('Enter jumps to the figure and opens it', () => {
    const f = find('dinner vat');
    press(f, 'Enter');
    expect(S().sel).toBe('dinner');
    expect($<HTMLInputElement>('#nm')!.value).toBe('Dinner VAT');
  });
  it('arrow keys move through the results', () => {
    const f = find('net');
    expect($$('#results [data-i]').slice(0, 2).map((b) => b.querySelector('span:last-child')!.firstChild!.textContent)).toEqual(['Net per head', 'Net against target']);
    press(f, 'ArrowDown');
    press(f, 'Enter');
    expect(S().sel).toBe('vsTarget');
  });
  it('⌘K / Ctrl K and / put you in the search box', () => {
    press(doc.body, 'k', { metaKey: true });
    expect(doc.activeElement?.id).toBe('find');
    (doc.activeElement as HTMLElement).blur();
    press(doc.body, '/');
    expect(doc.activeElement?.id).toBe('find');
  });
  it('finds new names straight away', () => {
    openField('Lunch gross');
    type($<HTMLInputElement>('#nm')!, 'Lunch sales');
    find('sales');
    expect(text('#results')).toContain('Lunch sales');
  });
});

describe('comments', () => {
  const comment = (t: string) => { type($<HTMLTextAreaElement>('#cmt')!, t, 'input'); $<HTMLButtonElement>('#cmtAdd')!.click(); };
  it('adds a comment to a box and shows a count on it', () => {
    openNode('wagePct');
    comment('Should this use wages including holiday pay?');
    expect(text('#inspector .cmts')).toContain('Should this use wages including holiday pay?');
    expect(text('.mrow[data-id="wagePct"] .cbadge')).toBe('1');
    expect(text('#heroChanges')).toBe('No changes');
  });
  it('adds a comment to a single input, counted on its section too', () => {
    openField('Lunch VAT');
    comment('Is this from the Z report?');
    expect(text('.frow[data-var="Lunch VAT"] .cbadge')).toBe('1');
    expect(text('.node[data-id="lunch"] .nh .cbadge')).toBe('1');
  });
  it('resolves and reopens', () => {
    openNode('dayNet');
    comment('Check the delivery figure');
    $<HTMLButtonElement>('#inspector [data-res]')!.click();
    expect($('.mrow[data-id="dayNet"] .cbadge')).toBeNull();
    expect(text('#inspector .cmts summary')).toBe('1 resolved');
    $<HTMLButtonElement>('#inspector [data-res]')!.click();
    expect(text('.mrow[data-id="dayNet"] .cbadge')).toBe('1');
  });
  it('ignores an empty comment, and shows HTML as text', () => {
    openNode('dayNet');
    comment('   ');
    expect($('#inspector .cm')).toBeNull();
    comment('<b onmouseover="x()">hi</b>');
    expect($('#inspector .cm b[onmouseover]')).toBeNull();
    expect(text('#inspector .cm p')).toBe('<b onmouseover="x()">hi</b>');
  });
  it('survives undo, because comments aren’t part of the draft', () => {
    addFromMenu('input'); renameInline('New input');
    comment('Do we need this?');
    const id = S().selField;
    press(doc.body, 'z', { metaKey: true });
    expect(S().comments[id]).toHaveLength(1);
  });
});

describe('history: undo for each step', () => {
  const history = () => $$('#history [data-undo]').map((b) => b.closest('.li')!.querySelector('.t')!.firstChild!.textContent);
  it('lists every step, newest first', () => {
    addFromMenu('input');
    openField('Lunch gross');
    type($<HTMLInputElement>('#nm')!, 'Lunch sales');
    openNode('lunchNet');
    const fx = $<HTMLTextAreaElement>('#fx')!;
    fx.dispatchEvent(new dom.window.Event('focus'));
    type(fx, '[Lunch sales] − [Lunch VAT]');
    expect(history()).toEqual(['Changed the formula for Lunch net', 'Renamed Lunch gross to Lunch sales', 'Added an input to Lunch']);
    expect(text('#histMeta')).toBe('3 steps');
  });
  it('undoes one step from the middle and keeps the ones after it', () => {
    addFromMenu('input');
    openField('Lunch gross');
    type($<HTMLInputElement>('#nm')!, 'Lunch sales');
    addFromMenu('calc');
    // Undo the first step (adding the input) only.
    $<HTMLButtonElement>('#history [data-undo="0"]')!.click();
    expect($('.frow[data-var="New input"]')).toBeNull();
    expect($('.frow[data-var="Lunch sales"]')).not.toBeNull();
    expect($('.mrow[data-var="New calculation"]')).not.toBeNull();
    expect(history()).toEqual(['Added a calculation', 'Renamed Lunch gross to Lunch sales']);
  });
  it('refuses to undo a step that a later step needs, and changes nothing', () => {
    addFromMenu('input');
    type($<HTMLSelectElement>('#useIn')!, 'lunchNet');
    $<HTMLButtonElement>('#history [data-undo="0"]')!.click();
    expect(text('#toast')).toMatch(/^Can’t undo “Added an input to Lunch” on its own: a later step needs it\./);
    expect(formulaOf('lunchNet')).toMatch(/\+ \[New input\]$/);
    expect(history()).toHaveLength(2);
  });
  it('undoes a typed formula change on its own', () => {
    openNode('lunchNet');
    const fx = $<HTMLTextAreaElement>('#fx')!;
    fx.dispatchEvent(new dom.window.Event('focus'));
    type(fx, '[Lunch gross] − [Lunch VAT]');
    addFromMenu('check');
    $<HTMLButtonElement>('#history [data-undo="0"]')!.click();
    expect(formulaOf('lunchNet')).toBe('[Lunch gross] − [Lunch service charge] − [Lunch VAT] − [Lunch discounts]');
    expect($('.mrow[data-var="New check"]')).not.toBeNull();
  });
  it('redoes what was undone, from the list, the message or ⌘⇧Z', () => {
    addFromMenu('input');
    press(doc.body, 'z', { metaKey: true });
    expect($('.frow[data-var="New input"]')).toBeNull();
    $<HTMLButtonElement>('#hRedo')!.click();
    expect($('.frow[data-var="New input"]')).not.toBeNull();
    press(doc.body, 'z', { ctrlKey: true });
    press(doc.body, 'z', { metaKey: true, shiftKey: true });
    expect($('.frow[data-var="New input"]')).not.toBeNull();
    expect($<HTMLButtonElement>('#redoBtn')!.disabled).toBe(true);
  });
  it('a new edit clears what could be redone', () => {
    addFromMenu('input');
    press(doc.body, 'z', { metaKey: true });
    addFromMenu('calc');
    expect($('#hRedo')).toBeNull();
  });
});

describe('colours', () => {
  const colourOf = (role: string, dark = false) => {
    const root = doc.documentElement;
    if (dark) root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
    // The page follows theme changes through a MutationObserver; give it a tick.
    (dom.window as any).__builder.applyColours();
    return root.style.getPropertyValue(`--r-${role}`).toUpperCase();
  };
  const pick = (role: string, name: string) => {
    $<HTMLButtonElement>(`[data-role="${role}"]`)!.click();
    $$('.palette [data-pick]').find((b) => b.textContent === name)!.click();
  };
  it('sets colours on the page root, not with an added style tag (which a strict CSP can block)', () => {
    expect($('style#roleColours')).toBeNull();
    expect(doc.documentElement.style.getPropertyValue('--r-in')).not.toBe('');
  });
  it('starts with the default colours for light and dark', () => {
    expect(colourOf('in')).toBe('#5856D6');
    expect(colourOf('in', true)).toBe('#8E8CFF');
    expect(colourOf('calc')).toBe('#9A3FCB');
  });
  it('changes the colour for one type of box', () => {
    pick('in', 'Plum');
    expect(colourOf('in')).toBe('#A23B72');
    expect(colourOf('in', true)).toBe('#F08FC0');
    expect(text('#toast')).toBe('Inputs are now Plum');
  });
  it('swaps when the colour is already used, so types never look the same', () => {
    pick('in', 'Purple');
    expect(colourOf('in')).toBe('#9A3FCB');
    expect(colourOf('calc')).toBe('#5856D6');
    expect(text('#toast')).toBe('Swapped colours with Calculations');
  });
  it('never offers green, amber or red', () => {
    $<HTMLButtonElement>('[data-role="act"]')!.click();
    expect($$('.palette [data-pick]').map((b) => b.textContent)).toEqual(['Indigo', 'Purple', 'Teal', 'Slate', 'Plum', 'Graphite', 'Sand']);
    expect(text('.palette .why')).toMatch(/Green, amber and red aren’t offered/);
  });
  it('remembers the choice in this browser, and resets', () => {
    pick('set', 'Sand');
    expect(JSON.parse(dom.window.localStorage.getItem('rb-colours')!).set).toBe('sand');
    // The picker stays open after a pick, so colours can be compared.
    $<HTMLButtonElement>('[data-preset]')!.click();
    expect(colourOf('set')).toBe('#5B6B82');
  });
  it('isn’t a change to the report', () => {
    pick('calc', 'Graphite');
    expect(text('#heroChanges')).toBe('No changes');
    expect($('#history [data-undo]')).toBeNull();
  });
});

describe('the current EOD on the map', () => {
  it('has every section of the form, with the same inputs', () => {
    const sections = S().nodes.filter((n: any) => n.fields).map((n: any) => `${n.title}: ${n.fields.length}`);
    expect(sections).toEqual(['Lunch: 10', 'Dinner: 10', 'Delivery: 2', 'Wages: 1', 'Tips: 2', 'Site settings: 9']);
  });
  it('works out the same figures as today’s report', () => {
    const R = (dom.window as any).__builder.computeAll();
    expect(R.errs).toEqual({});
    expect(R.vals['Lunch net']).toBe(850);
    expect(R.vals['Total covers']).toBe(105);
    expect(R.vals['Net per head']).toBeCloseTo(24.29);
    expect(R.vals['Lunch cash difference']).toBe(0);
    expect(R.vals['Total tips']).toBeCloseTo(228.4);
    expect(R.vals['Net against target']).toBeCloseTo(187.5);
    expect(R.vals['Cash doesn’t balance?']).toBe(0);
  });
  it('shows the text-only sections in the form view', () => {
    $<HTMLButtonElement>('#tab-form')!.click();
    expect(text('.formgrid')).toMatch(/Promotions & other.*Feedback.*Handover/);
  });
});

describe('editing on the card', () => {
  it('renames an input by double-clicking its name', () => {
    $('.frow[data-var="Lunch gross"] .fname')!.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true }));
    renameInline('Lunch sales');
    expect(formulaOf('lunchNet')).toMatch(/^\[Lunch sales\]/);
    expect(text('#toast')).toMatch(/Renamed Lunch gross to Lunch sales/);
  });
  it('keeps editing and explains, when the new name is taken', () => {
    $('.frow[data-var="Lunch gross"] .fname')!.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true }));
    renameInline('Dinner gross');
    expect(text('#toast')).toBe('There is already a figure called Dinner gross');
    expect($('.inl')).not.toBeNull();
    press($('.inl')!, 'Escape');
    expect($('.inl')).toBeNull();
    expect(formulaOf('lunchNet')).toMatch(/^\[Lunch gross\]/);
  });
  it('changes the type with the £ / % / # chip', () => {
    const chip = $<HTMLSelectElement>('[data-ty="lunch.booked"]')!;
    expect(chip.value).toBe('num');
    chip.value = 'money'; chip.dispatchEvent(new dom.window.Event('change'));
    expect(S().nodes.find((n: any) => n.id === 'lunch').fields.find((f: any) => f.id === 'lunch.booked').fmt).toBe('money');
    expect(changes()).toContain('Changed Lunch booked covers to Money (£)');
  });
  it('deletes with × on the row, unless something uses it', () => {
    $<HTMLButtonElement>('[data-del="lunch.vat"]')!.click();
    expect(text('#toast')).toBe('Lunch VAT is used by Lunch net. Take it out of those first.');
    $<HTMLButtonElement>('.node[data-id="wages"] .addrow')!.click();
    renameInline('Agency staff');
    const id = S().nodes.find((n: any) => n.id === 'wages').fields.at(-1).id;
    $<HTMLButtonElement>(`[data-del="${id}"]`)!.click();
    expect($('.frow[data-var="Agency staff"]')).toBeNull();
  });
  it('renames and deletes a calculation from its card header', () => {
    addFromMenu('calc'); renameInline('Spare');
    $<HTMLButtonElement>('.mrow[data-var="Spare"] [data-ren]')!.click();
    renameInline('Spend a head');
    expect($('.mrow[data-var="Spend a head"]')).not.toBeNull();
    $<HTMLButtonElement>('.mrow[data-var="Spend a head"] [data-rm-node]')!.click();
    expect($('.mrow[data-var="Spend a head"]')).toBeNull();
  });
  it('renames a section from its card header', () => {
    $<HTMLButtonElement>('.node[data-id="tips"] [data-ren]')!.click();
    renameInline('Tips & tronc');
    expect(text('.node[data-id="tips"] .nt')).toBe('Tips & tronc');
  });
  it('has no rename or delete on settings and actions', () => {
    expect($('.node[data-id="settings"] [data-rm-node]')).toBeNull();
    expect($('.mrow[data-id="email"] [data-ren]')).toBeNull();
  });
});

describe('workspace', () => {
  it('lists everything in the layers panel, and clicking a layer opens it', () => {
    expect($$('#layerList .lyr')).toHaveLength(12 + 34 + 39); // 12 cards, 34 inputs and settings, 39 figures in groups
    $$('#layerList .lyr').find((b) => b.textContent === 'Wage %')!.click();
    expect(S().sel).toBe('wagePct');
    expect($('#modal')!.hidden).toBe(false);
    expect($('#layerList .lyr.on')!.textContent).toBe('Wage %');
    $$('#layerList .lyr').find((b) => b.textContent === 'Card tips')!.click();
    expect(S().selField).toBe('tips.card');
  });
  it('adds with single keys: I input, S section, C calculation, K check, T setting', () => {
    const n = $$('.node').length, f = $$('.frow').length;
    press(doc.body, 'c'); renameInline('A');
    press(doc.body, 'k'); renameInline('B');
    press(doc.body, 's'); renameInline('C');
    press(doc.body, 'i'); renameInline('D');
    press(doc.body, 't'); renameInline('E');
    expect($$('.node').length).toBe(n + 1); // only the section is a new card; the rest are rows
    expect($$('.frow').length).toBe(f + 3);
    expect($$('.mrow').length).toBe(41);
  });
  it('zooms with + and −, and Shift 0 goes back to 100%', () => {
    press(doc.body, '=');
    expect(text('#zPct')).toBe('110%');
    press(doc.body, '-'); press(doc.body, '-');
    expect(text('#zPct')).toBe('90%');
    press(doc.body, ')', { shiftKey: true, code: 'Digit0' } as KeyboardEventInit);
    expect(text('#zPct')).toBe('100%');
  });
  it('opens a box as a pop-up over the darkened map, and closes it with ×, Esc or the background', () => {
    const modal = () => $('#modal')!.hidden;
    expect(modal()).toBe(true);
    openNode('dayNet');
    expect(modal()).toBe(false);
    expect($('#modal #nm')).not.toBeNull();
    $<HTMLButtonElement>('#modalClose')!.click();
    expect(modal()).toBe(true);
    expect(S().sel).toBe('dayNet'); // still followed on the map
    openField('Lunch VAT');
    press(doc.body, 'Escape');
    expect(modal()).toBe(true);
    openNode('wagePct');
    $('#modal')!.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true }));
    expect(modal()).toBe(true);
  });
  it('closes the pop-up when its figure is deleted', () => {
    addFromMenu('calc'); renameInline('Spare');
    openNode(S().nodes.find((n: any) => n.name === 'Spare').id);
    $<HTMLButtonElement>('#del')!.click();
    expect($('#modal')!.hidden).toBe(true);
  });
  it('starts with the side panels hidden, and opens them', () => {
    expect($('#frame')!.classList.contains('no-panel')).toBe(true);
    expect($('#frame')!.classList.contains('no-layers')).toBe(true);
    $<HTMLButtonElement>('#tglPanel')!.click();
    $<HTMLButtonElement>('#tglLayers')!.click();
    expect($('#frame')!.classList.contains('no-panel')).toBe(false);
    expect($('#frame')!.classList.contains('no-layers')).toBe(false);
    expect($('#pt-checks')!.hidden).toBe(false);
    expect(text('#checksCount')).toBe('8/8');
    $<HTMLButtonElement>('#ptab-ai')!.click();
    expect($('#pt-ai')!.hidden).toBe(false);
    expect($('#pt-checks')!.hidden).toBe(true);
    $<HTMLButtonElement>('#tglPanel')!.click();
    expect($('#frame')!.classList.contains('no-panel')).toBe(true);
  });
  it('opens full screen like Figma, and Esc or the button goes back to the page', () => {
    expect($('.builder')!.classList.contains('full')).toBe(true);
    expect(doc.documentElement.classList.contains('rb-full')).toBe(true);
    expect(text('#fullBtn')).toBe('Exit full screen');
    expect($('.stage .cv-legend')).not.toBeNull();
    press(doc.body, 'Escape');
    expect($('.builder')!.classList.contains('full')).toBe(false);
    expect(text('#fullBtn')).toBe('Full screen');
    $<HTMLButtonElement>('#fullBtn')!.click();
    expect($('.builder')!.classList.contains('full')).toBe(true);
  });
  it('the top bar shows the test status and sends for approval', () => {
    expect(text('#fbTests')).toBe('Tests 8/8');
    expect($<HTMLButtonElement>('#fbSend')!.disabled).toBe(true); // nothing changed yet
    addFromMenu('input'); renameInline('Agency staff');
    expect($<HTMLButtonElement>('#fbSend')!.disabled).toBe(false);
    $<HTMLButtonElement>('#fbSend')!.click();
    expect(text('#heroState')).toBe('Waiting for a second finance user');
    expect(text('#fbSend')).toBe('Sent for approval');
  });
  it('the flow tab’s step library opens as a pop-up too', () => {
    $<HTMLButtonElement>('#tab-flow')!.click();
    $<HTMLButtonElement>('[data-at="2"]')!.click();
    expect($('#modal')!.hidden).toBe(false);
    $('[data-l="1"]')!.click();
    expect($('#modal')!.hidden).toBe(true);
    expect(text('.flow')).toMatch(/Ask someone to approve/);
  });
  it('the checks count turns red when tests fail', () => {
    openNode('lunchNet');
    type($<HTMLTextAreaElement>('#fx')!, '[Lunch gross]', 'input');
    expect($('#checksCount')!.className).toContain('bad');
  });
});

describe('calmer cards', () => {
  beforeEach(() => load(false));
  const collapsed = (id: string) => $(`.node[data-id="${id}"]`)!.classList.contains('collapsed');
  it('starts with every section collapsed to a count', () => {
    for (const id of ['lunch', 'dinner', 'delivery', 'wages', 'tips', 'settings']) expect(collapsed(id)).toBe(true);
    expect(text('.node[data-id="dinner"] .csum')).toBe('10 inputsShow');
    expect(text('.node[data-id="settings"] .csum')).toBe('9 settingsShow');
  });
  it('opens and closes a section with its chevron or its count', () => {
    $<HTMLButtonElement>('.node[data-id="dinner"] [data-col]')!.click();
    expect(collapsed('dinner')).toBe(false);
    expect($('.node[data-id="dinner"] [data-col]')!.getAttribute('aria-expanded')).toBe('true');
    $<HTMLButtonElement>('.node[data-id="dinner"] [data-col]')!.click();
    expect(collapsed('dinner')).toBe(true);
    $<HTMLButtonElement>('.node[data-id="dinner"] [data-expand]')!.click();
    expect(collapsed('dinner')).toBe(false);
  });
  it('expands and collapses everything at once', () => {
    expect($$('.node.collapsed')).toHaveLength(12);
    $<HTMLButtonElement>('#colAll')!.click();
    expect($$('.node.collapsed')).toHaveLength(0);
    expect(text('#colAll')).toBe('Collapse all');
    $<HTMLButtonElement>('#colAll')!.click();
    expect($$('.node.collapsed')).toHaveLength(12);
  });
  it('opens a section when you add to it or jump to one of its inputs', () => {
    $<HTMLButtonElement>('.node[data-id="wages"] .addrow')!.click();
    renameInline('Agency staff');
    expect(collapsed('wages')).toBe(false);
    const f = $<HTMLInputElement>('#find')!; f.value = 'card tips'; f.dispatchEvent(new dom.window.Event('input')); press(f, 'Enter');
    expect(collapsed('tips')).toBe(false);
  });
  it('drops the section name from row labels, keeping the full name on hover', () => {
    load();
    const row = $('.frow[data-var="Dinner service charge"] .fname')!;
    expect(row.textContent).toBe('Service charge');
    expect(row.getAttribute('title')).toMatch(/^Dinner service charge\./);
    expect(text('.frow[data-var="Card tips"] .fname')).toBe('Card tips');
  });
  it('shows each figure in an open group as one row: name and value', () => {
    load();
    expect(text('.mrow[data-id="dayNet"] .mn')).toBe('Day total net');
    expect(text('.mrow[data-id="dayNet"] .mv')).toBe('£2,687.50');
    expect($('.mrow[data-id="dayNet"] .desc')).toBeNull();
    openNode('dayNet');
    expect($<HTMLInputElement>('#fxd')!.value).toBe('Everything the site made today, after deductions');
  });
  it('joins a collapsed section’s lines at its header', () => {
    $<HTMLButtonElement>('.node[data-id="c-lunch"] [data-col]')!.click();
    openNode('lunchNet');
    const into = $$('#edges .hit').filter((h) => h.getAttribute('data-tgt') === 'lunchNet');
    expect(into).toHaveLength(1);
    expect(into[0]!.getAttribute('data-bundle')).toBe('lunch');
  });
});

describe('the simple map', () => {
  beforeEach(() => load(false));
  it('opens on a dozen cards: six input sections and six calculation groups', () => {
    expect($$('.node')).toHaveLength(12);
    expect($$('.node.cluster').map((e) => e.querySelector('.nt')!.textContent)).toEqual(['Lunch figures', 'Dinner figures', 'Delivery figures', 'Day totals', 'Checks', 'After submit']);
  });
  it('shows each group’s key figures and status', () => {
    expect(text('.node[data-id="c-lunch"] .nb')).toMatch(/^Net£850\.00Covers40/);
    expect(text('.node[data-id="c-totals"] .nb')).toMatch(/^Day total net£2,687\.50Wage %29\.8%/);
    expect(text('.node[data-id="c-checks"] .nb')).toMatch(/All clear/);
    expect(text('.node[data-id="c-actions"] .nb')).toMatch(/Run on the test day2 of 5/);
  });
  it('flags a group when one of its figures goes wrong', () => {
    load();
    openNode('dinnerNet');
    type($<HTMLTextAreaElement>('#fx')!, '[Dinner gross] −', 'input');
    $<HTMLButtonElement>('#colAll')!.click(); // collapse everything again
    expect(text('.node[data-id="c-dinner"] .nh')).toMatch(/4 to fix/); // net, and the 3 figures that use it
  });
  it('draws one line between groups instead of one per figure', () => {
    const lines = $$('#edges .hit');
    expect(lines.length).toBeLessThan(25);
    const lunchToLunch = lines.filter((h) => h.getAttribute('data-bundle') === 'lunch c-lunch');
    expect(lunchToLunch).toHaveLength(1);
  });
  it('clicking a bundled line opens both groups', () => {
    $$('#edges .hit').find((h) => h.getAttribute('data-bundle') === 'lunch c-lunch')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect($('.node[data-id="lunch"]')!.classList.contains('collapsed')).toBe(false);
    expect($('.mrow[data-id="lunchNet"]')).not.toBeNull();
  });
  it('opens a group with its chevron and shows its figures under it', () => {
    $<HTMLButtonElement>('.node[data-id="c-totals"] [data-col]')!.click();
    expect($('.node[data-id="c-totals"] .mrow[data-id="dayNet"]')).not.toBeNull(); // one card, rows inside
    expect($$('.node[data-id="c-totals"] .mrow')).toHaveLength(8);
    expect($('.node[data-id="c-totals"] .csum')).toBeNull();
  });
  it('jumping to a figure opens its group, exact names first', () => {
    const f = $<HTMLInputElement>('#find')!; f.value = 'wage %'; f.dispatchEvent(new dom.window.Event('input')); press(f, 'Enter');
    expect($('.mrow[data-id="wagePct"]')).not.toBeNull();
    expect($('#modal')!.hidden).toBe(false);
  });
  it('new calculations appear in an open group, ready to name', () => {
    addFromMenu('calc');
    expect($('.inl')).not.toBeNull();
    renameInline('Spend per head');
    expect($('.mrow[data-var="Spend per head"]')).not.toBeNull();
  });
  it('drops the group name from figure titles inside a group', () => {
    $<HTMLButtonElement>('.node[data-id="c-lunch"] [data-col]')!.click();
    expect(text('.mrow[data-id="lunchNet"] .mn')).toBe('Net');
  });
});

describe('pipeline view', () => {
  const showPipeline = () => $<HTMLButtonElement>('[data-view="pipe"]')!.click();
  const stage = (name: string) => $$('.pv-stage').find((s) => s.querySelector('header b')!.textContent === name)!;
  const job = (stageName: string, jobName: string) => [...stage(stageName).querySelectorAll('.pv-job')].find((j) => j.querySelector('.pv-jn')!.firstChild!.textContent === jobName) as HTMLButtonElement;
  const status = (el: Element) => [...el.classList].find((c) => c.startsWith('st-'));

  it('runs the test day through six stages, like a CI pipeline', () => {
    showPipeline();
    expect($$('.pv-stage header b').map((b) => b.textContent)).toEqual(['Collect', 'Validate', 'Calculate', 'Test', 'Store', 'Notify']);
    expect(text('.pv-head')).toMatch(/Test-day run #1Passed · All passed · \d+ jobs in 6 stages · 3 skipped/);
    expect(status(stage('Validate'))).toBe('st-ok');
    expect(text('.pv-stage:nth-child(1) .pv-job')).toMatch(/Lunch10 of 10 required filled/);
    expect(job('Collect', 'Delivery').textContent).toMatch(/2 inputs, all optional/);
  });
  it('skips conditional actions that don’t apply, and says why', () => {
    showPipeline();
    expect(status(job('Notify', 'Alert the ops manager'))).toBe('st-skip');
    expect(job('Notify', 'Alert the ops manager').textContent).toMatch(/Only runs when “Wages over red\?” is yes/);
    expect(status(job('Notify', 'Send the summary email'))).toBe('st-ok');
  });
  it('shows a warning without stopping the run', () => {
    openField('Wage % amber limit');
    type($<HTMLInputElement>('#ex')!, '25%', 'input'); // 29.8% is now over amber, still under red; no test moves
    showPipeline();
    expect(status(stage('Validate'))).toBe('st-warn');
    expect(status(job('Store', 'Save to SharePoint'))).toBe('st-ok');
    expect(text('.pv-head')).toMatch(/Passed with warnings · 1 warning/);
  });
  it('a blocking check fails Validate and skips Store and Notify', () => {
    openField('Lunch till cash');
    type($<HTMLInputElement>('#ex')!, '240', 'input'); // £20 short
    showPipeline();
    expect(status(stage('Validate'))).toBe('st-fail');
    expect(job('Validate', 'Lunch cash doesn’t balance').textContent).toMatch(/blocks sending until explained/);
    expect(status(job('Store', 'Save to SharePoint'))).toBe('st-skip');
    expect(job('Store', 'Save to SharePoint').textContent).toMatch(/Blocked by Validate/);
    expect(text('.pv-head')).toMatch(/Failed/);
  });
  it('a broken formula fails Calculate and Test', () => {
    openNode('dinnerNet');
    type($<HTMLTextAreaElement>('#fx')!, '[Dinner gross] −', 'input');
    showPipeline();
    expect(status(job('Calculate', 'Dinner figures'))).toBe('st-fail');
    expect(job('Calculate', 'Dinner figures').textContent).toMatch(/can’t be worked out: Dinner net/);
    expect(status(stage('Test'))).toBe('st-fail');
    expect(job('Notify', 'Send the summary email').textContent).toMatch(/Blocked by/);
  });
  it('clicking a job opens that figure', () => {
    showPipeline();
    job('Validate', 'Wages over red').click();
    expect($('#modal')!.hidden).toBe(false);
    expect($<HTMLInputElement>('#nm')!.value).toBe('Wages over red?');
  });
  it('the Test job opens the review panel', () => {
    showPipeline();
    job('Test', 'Verified example').click();
    expect($('#frame')!.classList.contains('no-panel')).toBe(false);
    expect($('#pt-checks')!.hidden).toBe(false);
  });
  it('writes a run log grouped by stage, with failures opened', () => {
    openField('Lunch till cash');
    type($<HTMLInputElement>('#ex')!, '240', 'input');
    showPipeline();
    const groups = $$('.pv-log details');
    expect(groups).toHaveLength(6);
    expect(groups[1]!.hasAttribute('open')).toBe(true);
    expect(text('.pv-log')).toMatch(/2\.\d+ Lunch cash doesn’t balance — Yes: blocks sending until explained/);
  });
  it('Run again steps through the stages and finishes with the same result', async () => {
    showPipeline();
    $<HTMLButtonElement>('#rerun')!.click();
    expect(text('.pv-head')).toMatch(/Test-day run #2.*Running…/);
    expect($$('.pv-stage.st-run').length).toBe(1);
    // Wait for the run to finish rather than a fixed time, so a busy machine can't make this flaky.
    for (let t = 0; t < 100 && $$('.pv-stage.st-run').length; t++) await new Promise((r) => setTimeout(r, 50));
    expect($$('.pv-stage.st-run').length).toBe(0);
    expect(text('.pv-head')).toMatch(/Test-day run #2Passed/);
  });
});

describe('cards never cover each other', () => {
  beforeEach(() => load(false));
  const top = (id: string) => parseFloat($<HTMLElement>(`.node[data-id="${id}"]`)!.style.top);
  it('opening a section moves the cards below it down', () => {
    const before = top('dinner');
    $<HTMLButtonElement>('.node[data-id="lunch"] [data-col]')!.click();
    expect(top('dinner')).toBeGreaterThan(top('lunch'));
    expect(top('dinner')).toBeGreaterThanOrEqual(before);
  });
  it('keeps cards apart even after they were arranged by hand', () => {
    const S = (dom.window as any).__builder.state();
    S.tidy = false;
    S.nodes.find((n: any) => n.id === 'dinner').y = top('lunch'); // dragged right on top of Lunch
    $<HTMLButtonElement>('.node[data-id="tips"] [data-col]')!.click(); // any redraw
    expect(top('dinner')).toBeGreaterThan(top('lunch'));
  });
});

describe('moving around the map', () => {
  const panOf = () => { const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec($('#cv')!.style.transform)!; return [+m[1]!, +m[2]!]; };
  const pointer = (el: Element, type: string, x: number, y: number, extra: MouseEventInit = {}) => el.dispatchEvent(new dom.window.MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0, ...extra }));
  it('drags empty space to move the map, at any zoom', () => {
    const cvs = $('#cvs')!, [x0, y0] = panOf();
    pointer(cvs, 'pointerdown', 100, 100);
    pointer(dom.window as any, 'pointermove', 160, 70);
    pointer(dom.window as any, 'pointerup', 160, 70);
    expect(panOf()).toEqual([x0 + 60, y0 - 30]);
  });
  it('a click on empty space without moving clears the selection', () => {
    openNode('lunch'); $<HTMLButtonElement>('#modalClose')!.click();
    pointer($('#cvs')!, 'pointerdown', 50, 50); pointer(dom.window as any, 'pointerup', 50, 50);
    expect(S().sel).toBeNull();
  });
  it('holding Space drags the map even over a card, without opening it', () => {
    const [x0] = panOf();
    doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    const card = $('.node[data-id="c-totals"] .nh')!;
    pointer(card, 'pointerdown', 200, 200);
    pointer(dom.window as any, 'pointermove', 120, 200);
    pointer(dom.window as any, 'pointerup', 120, 200);
    doc.dispatchEvent(new dom.window.KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
    expect(panOf()[0]).toBe(x0 - 80);
    expect($('#modal')!.hidden).toBe(true);
  });
  it('scrolling moves the map, ⌘ or Ctrl + scroll zooms', () => {
    const [x0, y0] = panOf();
    $('#cvs')!.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaX: 20, deltaY: 40, bubbles: true, cancelable: true }));
    expect(panOf()).toEqual([x0 - 20, y0 - 40]);
    $('#cvs')!.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }));
    expect(text('#zPct')).toBe('122%');
  });
  it('arrow keys nudge the map when nothing is selected', () => {
    const [x0, y0] = panOf();
    press(doc.body, 'ArrowLeft'); press(doc.body, 'ArrowUp');
    expect(panOf()).toEqual([x0 + 60, y0 + 60]);
  });
});

describe('bottom controls', () => {
  it('sit together in one row, so they can’t overlap', () => {
    const dock = $('.stage .dock')!;
    expect(dock.querySelector('.dock-l .cv-legend')).not.toBeNull();
    expect(dock.querySelector('.dock-c .floatbar')).not.toBeNull();
    expect(dock.querySelector('.dock-r .zoombar')).not.toBeNull();
    expect($$('.stage .floatbar')).toHaveLength(1);
  });
  it('keeps colour names for screen readers and hovering when they’re folded to dots', () => {
    expect($('[data-role="in"]')!.getAttribute('title')).toBe('Inputs: change its colour');
    expect(text('[data-role="in"] .swl')).toBe('Inputs');
  });
});

describe('layers fold like the map', () => {
  beforeEach(() => load(false));
  const visible = () => $$('#layerList .lyr').filter((b) => !b.closest('[hidden]')).map((b) => b.querySelector('.nm')!.textContent);
  it('starts showing the columns and their twelve cards', () => {
    expect($$('#layerList .lyr-lane').map((l) => l.textContent!.replace(/\d+$/, ''))).toEqual(['Inputs', 'Calculations', 'Day totals', 'Checks & actions']);
    expect(visible()).toEqual(['Lunch', 'Dinner', 'Delivery', 'Wages', 'Tips', 'Site settings', 'Lunch figures', 'Dinner figures', 'Delivery figures', 'Day totals', 'Checks', 'After submit']);
  });
  it('unfolds a card to show its figures, and folds it again', () => {
    $<HTMLButtonElement>('#layerList [data-lt="lunch"]')!.click();
    expect(visible()).toContain('Lunch gross');
    $<HTMLButtonElement>('#layerList [data-lt="lunch"]')!.click();
    expect(visible()).not.toContain('Lunch gross');
  });
  it('folds a whole column', () => {
    $<HTMLButtonElement>('#layerList [data-lt="lane0"]')!.click();
    expect(visible()).not.toContain('Lunch');
    expect(visible()).toContain('Lunch figures');
  });
  it('clicking a card opens it on the map', () => {
    $<HTMLButtonElement>('#layerList [data-lcard="c-totals"]')!.click();
    expect($('.node[data-id="c-totals"]')!.classList.contains('collapsed')).toBe(false);
    expect($('.mrow[data-id="dayNet"]')).not.toBeNull();
  });
});

describe('an endless map', () => {
  it('lets cards be dragged anywhere, even above or left of the columns', () => {
    const card = $('.node[data-id="lunch"]')!, n = S().nodes.find((x: any) => x.id === 'lunch');
    const x0 = n.x, y0 = n.y;
    card.dispatchEvent(new dom.window.MouseEvent('pointerdown', { clientX: 500, clientY: 500, bubbles: true, button: 0 }));
    (card as any).hasPointerCapture = () => true;
    card.dispatchEvent(new dom.window.MouseEvent('pointermove', { clientX: 500 - (x0 + 400), clientY: 500 - (y0 + 300), bubbles: true }));
    card.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true }));
    expect(n.x).toBeLessThan(0);
    expect(n.y).toBeLessThan(0);
  });
  it('the dotted grid moves with the map', () => {
    const vp = $<HTMLElement>('#cvs')!;
    const before = vp.style.backgroundPosition;
    vp.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaX: 30, deltaY: 30, bubbles: true, cancelable: true }));
    expect(vp.style.backgroundPosition).not.toBe(before);
  });
});

describe('two-finger zoom', () => {
  const ev = (type: string, id: number, x: number, y: number) => {
    const e = new dom.window.MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(e, 'pointerId', { value: id }); Object.defineProperty(e, 'pointerType', { value: 'touch' });
    return e;
  };
  it('pinching out on a touch screen zooms in, pinching in zooms out', () => {
    const cvs = $('#cvs')!;
    cvs.dispatchEvent(ev('pointerdown', 1, 100, 100));
    cvs.dispatchEvent(ev('pointerdown', 2, 200, 100));
    cvs.dispatchEvent(ev('pointermove', 2, 300, 100)); // fingers twice as far apart
    expect(text('#zPct')).toBe('200%'.replace('200', String(Math.round(Math.min(1.6, 2) * 100))));
    cvs.dispatchEvent(ev('pointermove', 2, 150, 100)); // closer than at the start
    expect(text('#zPct')).toBe('50%');
    cvs.dispatchEvent(ev('pointerup', 2, 150, 100)); cvs.dispatchEvent(ev('pointerup', 1, 100, 100));
  });
  it('a trackpad pinch zooms smoothly, in small steps', () => {
    const cvs = $('#cvs')!;
    for (let i = 0; i < 10; i++) cvs.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: -2, ctrlKey: true, bubbles: true, cancelable: true }));
    expect(text('#zPct')).toBe('104%'); // ten 0.4% steps, none lost to rounding
  });
  it('Safari’s trackpad pinch (gesture events) zooms too', () => {
    const cvs = $('#cvs')!;
    const g = (type: string, scale: number) => { const e = new dom.window.Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'scale', { value: scale }); cvs.dispatchEvent(e); };
    g('gesturestart', 1); g('gesturechange', 1.3); g('gestureend', 1.3);
    expect(text('#zPct')).toBe('130%');
  });
  it('the + and − buttons still step in tens', () => {
    $<HTMLButtonElement>('#zIn')!.click(); $<HTMLButtonElement>('#zIn')!.click();
    expect(text('#zPct')).toBe('120%');
    $<HTMLButtonElement>('#zOut')!.click();
    expect(text('#zPct')).toBe('110%');
  });
});

describe('open groups', () => {
  it('draw lines to the exact row, and each row can be connected by its own dot', () => {
    const into = $$('#edges .hit').filter((h) => h.getAttribute('data-tgt') === 'wagePct');
    // Day total net is in the same card as Wage %, so no line loops back into the card; Wage cost comes from Wages.
    expect(into.map((h) => h.getAttribute('data-src')).sort()).toEqual(['Wage cost']);
    expect($('.mrow[data-id="wagePct"] .port')).not.toBeNull();
  });
  it('rename and delete a row from its hover buttons', () => {
    addFromMenu('calc'); renameInline('Spare');
    $<HTMLButtonElement>('.mrow[data-var="Spare"] [data-ren]')!.click();
    renameInline('Spend per head');
    $<HTMLButtonElement>('.mrow[data-var="Spend per head"] [data-rm-node]')!.click();
    expect($('.mrow[data-var="Spend per head"]')).toBeNull();
  });
  it('can be dragged like any other card', () => {
    const card = $('.node[data-id="c-totals"]')!, pos = S().cpos['c-totals'], x0 = pos.x;
    const ev = (t: string, x: number) => card.dispatchEvent(new dom.window.MouseEvent(t, { clientX: x, clientY: 100, bubbles: true, button: 0 }));
    ev('pointerdown', 100); ev('pointermove', 180); ev('pointerup', 180);
    expect(pos.x).toBe(x0 + 80);
    expect(parseFloat((card as HTMLElement).style.left)).toBe(x0 + 80);
  });
  it('a click on a group’s header opens or closes it; a click on a row opens that figure', () => {
    load(false);
    const card = $('.node[data-id="c-checks"]')!;
    const click = (el: Element) => { el.dispatchEvent(new dom.window.MouseEvent('pointerdown', { clientX: 5, clientY: 5, bubbles: true, button: 0 })); el.dispatchEvent(new dom.window.MouseEvent('pointerup', { clientX: 5, clientY: 5, bubbles: true })); };
    click(card.querySelector('.nt')!);
    expect($('.node[data-id="c-checks"]')!.classList.contains('open')).toBe(true);
    click($('.mrow[data-id="check"] .mn')!);
    expect($('#modal')!.hidden).toBe(false);
    expect($<HTMLInputElement>('#nm')!.value).toBe('Wages over red?');
  });
});

describe('colour key', () => {
  it('is a compact row of dots, with names on hover', () => {
    expect($$('.cv-legend .swbtn')).toHaveLength(4);
    expect($('[data-role="calc"]')!.getAttribute('title')).toBe('Calculations: change its colour');
  });
});

describe('drag to select', () => {
  // jsdom has no layout, so every card sits at (0, 0): a box around the origin catches them all.
  const box = (extra: MouseEventInit = {}) => {
    const cvs = $('#cvs')!;
    cvs.dispatchEvent(new dom.window.MouseEvent('pointerdown', { clientX: -20, clientY: -20, bubbles: true, cancelable: true, button: 0, ...extra }));
    dom.window.dispatchEvent(new dom.window.MouseEvent('pointermove', { clientX: 20, clientY: 20, bubbles: true }));
    expect($('.marquee')).not.toBeNull();
    dom.window.dispatchEvent(new dom.window.MouseEvent('pointerup', { clientX: 20, clientY: 20, bubbles: true }));
  };
  it('the Select tool draws a box that picks every card it touches', () => {
    $<HTMLButtonElement>('[data-tool="select"]')!.click();
    box();
    expect($$('.node.picked')).toHaveLength(12);
    expect(text('.tool .grow')).toMatch(/^12 selected/);
    expect($('.marquee')).toBeNull();
  });
  it('Shift + drag selects even with the Hand tool, and doesn’t move the map', () => {
    const before = $('#cv')!.style.transform;
    box({ shiftKey: true });
    expect($$('.node.picked')).toHaveLength(12);
    expect($('#cv')!.style.transform).toBe(before);
  });
  it('dragging one picked card moves them all together', () => {
    box({ shiftKey: true });
    const lunch = S().nodes.find((n: any) => n.id === 'lunch'), tips = S().nodes.find((n: any) => n.id === 'tips'), totals = S().cpos['c-totals'];
    const [lx, tx, gx] = [lunch.x, tips.x, totals.x];
    const card = $('.node[data-id="lunch"]')!;
    (card as any).hasPointerCapture = () => true;
    card.dispatchEvent(new dom.window.MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true, button: 0 }));
    card.dispatchEvent(new dom.window.MouseEvent('pointermove', { clientX: 150, clientY: 100, bubbles: true }));
    card.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true }));
    expect([lunch.x - lx, tips.x - tx, totals.x - gx]).toEqual([50, 50, 50]);
  });
  it('Esc, a click on empty space, or Clear empties the selection', () => {
    box({ shiftKey: true });
    press(doc.body, 'Escape');
    expect($$('.node.picked')).toHaveLength(0);
    box({ shiftKey: true });
    $<HTMLButtonElement>('#clearPicked')!.click();
    expect($$('.node.picked')).toHaveLength(0);
  });
  it('⌘A / Ctrl A selects every card; V and H switch tools', () => {
    press(doc.body, 'a', { metaKey: true });
    expect($$('.node.picked')).toHaveLength(12);
    press(doc.body, 'v');
    expect($('[data-tool="select"]')!.getAttribute('aria-pressed')).toBe('true');
    press(doc.body, 'h');
    expect($('[data-tool="hand"]')!.getAttribute('aria-pressed')).toBe('true');
  });
  it('with the Hand tool, a plain drag still moves the map', () => {
    const cvs = $('#cvs')!, t0 = $('#cv')!.style.transform;
    cvs.dispatchEvent(new dom.window.MouseEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true, button: 0 }));
    dom.window.dispatchEvent(new dom.window.MouseEvent('pointermove', { clientX: 60, clientY: 10, bubbles: true }));
    dom.window.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true }));
    expect($('#cv')!.style.transform).not.toBe(t0);
    expect($('.marquee')).toBeNull();
  });
});

describe('undoing moves', () => {
  const drag = (el: Element, dx: number, dy: number) => {
    (el as any).hasPointerCapture = () => true;
    el.dispatchEvent(new dom.window.MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true, button: 0 }));
    el.dispatchEvent(new dom.window.MouseEvent('pointermove', { clientX: 100 + dx, clientY: 100 + dy, bubbles: true }));
    el.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true }));
  };
  const at = (id: string) => { const e = $<HTMLElement>(`.node[data-id="${id}"]`)!; return [parseFloat(e.style.left), parseFloat(e.style.top)]; };
  it('⌘Z puts a moved card back, and redo moves it again', () => {
    const start = at('lunch');
    // Sideways, so the keep-cards-apart rule (cards have no height in jsdom) doesn't nudge it.
    drag($('.node[data-id="lunch"]')!, 120, 0);
    expect(at('lunch')).toEqual([start[0]! + 120, start[1]!]);
    expect(text('#history')).toMatch(/Moved Lunch/);
    press(doc.body, 'z', { metaKey: true });
    expect(at('lunch')).toEqual(start);
    press(doc.body, 'z', { metaKey: true, shiftKey: true });
    expect(at('lunch')).toEqual([start[0]! + 120, start[1]!]);
  });
  it('undoes a group card move', () => {
    const start = at('c-totals');
    drag($('.node[data-id="c-totals"]')!, -60, 90);
    press(doc.body, 'z', { metaKey: true });
    expect(at('c-totals')).toEqual(start);
  });
  it('a selection moved together undoes in one step', () => {
    press(doc.body, 'a', { metaKey: true });
    const a = at('lunch'), b = at('c-checks');
    drag($('.node[data-id="lunch"]')!, 50, 0);
    expect(text('#history')).toMatch(/Moved 12 cards/);
    press(doc.body, 'z', { metaKey: true });
    expect([at('lunch'), at('c-checks')]).toEqual([a, b]);
  });
  it('Tidy up can be undone', () => {
    const start = at('lunch');
    drag($('.node[data-id="lunch"]')!, 200, 0);
    $<HTMLButtonElement>('#tidy')!.click();
    expect(at('lunch')).toEqual(start);
    press(doc.body, 'z', { metaKey: true });
    expect(at('lunch')).toEqual([start[0]! + 200, start[1]!]);
  });
  it('an earlier move can be undone on its own from History', () => {
    const l = at('lunch'), t = at('tips');
    drag($('.node[data-id="lunch"]')!, 70, 0);
    drag($('.node[data-id="tips"]')!, 0, 300);
    $<HTMLButtonElement>('#history [data-undo="0"]')!.click();
    expect(at('lunch')).toEqual(l);
    expect(at('tips')[1]).toBe(t[1]! + 300);
  });
});
