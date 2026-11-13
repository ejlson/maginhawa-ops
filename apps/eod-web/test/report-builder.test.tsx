/**
 * The report builder inside the app (head office only): the prototype's key interactions, then saving,
 * publishing (no second person needed), conflicts, roll back, and the whole journey to a manager's EOD.
 * Demo mode: the record is saved on the device under 'mgh.definitions'. All figures are examples.
 */
import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { EOD_DEFINITION, VERIFIED_TEST_DAY, saveDefinitionDraft, seedDefinitionRecord, submitDefinition, updateFigure, type DefinitionRecord } from '@maginhawa/core';
import { setNow } from '../app/lib/clock';
import { demoDefinitions, setDemoDefinitions } from '../app/lib/definition';
import type { User } from '../app/lib/auth';
import { admin, manager, renderApp, seedVerifiedDraft } from './harness';

const ana = admin;
/** The longer journeys click through a lot of screens. */
const SLOW = 20_000;
const ben: User = { name: 'Ben', initials: 'B', role: 'headoffice', siteCode: 'BUN' };

/** Opens the builder with both side panels showing (they start hidden on a screen this narrow). */
async function openBuilder(who: User = ana) {
  const r = renderApp('/head-office/report-builder', who);
  await screen.findByRole('region', { name: 'Report builder' });
  for (const name of ['Review', 'Layers']) {
    const b = screen.getByRole('button', { name });
    if (b.getAttribute('aria-pressed') !== 'true') await r.user.click(b);
  }
  return r;
}
const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T | null;
const $$ = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)];
const text = (sel: string) => $(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const changes = () => $$('#changes .li .t').map((e) => e.firstChild?.textContent ?? '');
const editor = () => screen.getByRole('dialog');
/** Finds a figure, section or action by name and opens it, as typing in "Find a figure" and pressing Enter does. */
async function openByName(user: ReturnType<typeof renderApp>['user'], name: string) {
  const find = screen.getByRole('searchbox', { name: 'Find a figure' });
  await user.clear(find);
  await user.type(find, name);
  await user.keyboard('{Enter}');
  return screen.findByRole('dialog');
}
/** Typing a formula (fireEvent, because [ is a special key for user-event). */
function typeFormula(value: string) {
  const ta = within(editor()).getByLabelText('Formula');
  fireEvent.change(ta, { target: { value } });
  fireEvent.blur(ta);
}
const waitSaved = () => waitFor(() => expect(screen.getByText('Draft saved')).toBeInTheDocument(), { timeout: 2000 });
const stored = () => demoDefinitions();

describe('loading', () => {
  it('opens with the verified example figures, today’s rules live and nothing to send', async () => {
    await openBuilder();
    expect(text('#heroFig')).toBe('£2,687.50');
    expect(text('#heroWage')).toBe('29.8%');
    expect(text('#heroTests')).toBe('8 of 8');
    expect(text('#heroChanges')).toBe('No changes');
    expect(screen.getByRole('status', { name: 'Status: Live' })).toBeInTheDocument();
    for (const b of screen.getAllByRole('button', { name: 'Publish' })) expect(b).toBeDisabled();
  });

  it('draws a dozen cards in four labelled columns: six sections and six calculation groups', async () => {
    await openBuilder();
    expect($$('.node')).toHaveLength(12);
    expect($$('.lane-h').map((e) => e.textContent)).toEqual(['1Inputs', '2Calculations', '3Day totals', '4Checks & actions']);
    expect($$('.node.collapsed')).toHaveLength(12);
  });

  it('shows the working for a formula', async () => {
    const { user } = await openBuilder();
    await openByName(user, 'Lunch net');
    expect(within(editor()).getByText('£1,200.00 − £120.00 − £180.00 − £50.00 = £850.00')).toBeInTheDocument();
  });

  it('is for head office only', async () => {
    renderApp('/head-office/report-builder', manager);
    expect(screen.queryByRole('region', { name: 'Report builder' })).not.toBeInTheDocument();
  });

  it('is in head office’s navigation', async () => {
    // A desktop-sized screen, where head office has the sidebar.
    window.matchMedia = ((q: string) => ({ matches: /min-width/.test(q), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    try {
      renderApp('/head-office', ana);
      expect(await screen.findByRole('link', { name: 'Report builder' })).toHaveAttribute('href', '/head-office/report-builder');
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });
});

describe('adding', () => {
  it('adds an input from the toolbar, ready to rename on the card', async () => {
    const { user } = await openBuilder();
    await user.click($('[data-act="input"]')!);
    const inl = screen.getByRole('textbox', { name: 'Name' });
    expect(inl).toHaveValue('New input');
    await user.clear(inl);
    await user.type(inl, 'Card takings{Enter}');
    expect($('.frow[data-var="Card takings"]')).not.toBeNull();
    expect(changes()).toContain('Added Card takings');
  });

  it('adds a section with its first input, and a setting to the site settings', async () => {
    const { user } = await openBuilder();
    await user.click($('[data-act="section"]')!);
    await user.keyboard('{Enter}'); // keeps the name "New section"
    expect(changes()).toEqual(expect.arrayContaining(['Added New input', 'Added the New section section']));
    await user.click($('[data-act="setting"]')!);
    await user.keyboard('{Enter}');
    expect($('.node[data-id="settings"] .frow[data-var="New setting"]')).not.toBeNull();
  });

  it('adds a calculation that works out as you type, and explains mistakes', async () => {
    const { user } = await openBuilder();
    await user.click($('[data-act="calc"]')!);
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    await user.click($('.mrow[data-var="New calculation"]')!);
    typeFormula('[Lunch net] × 2');
    expect(within(editor()).getByText('£850.00 × 2 = £1,700.00')).toBeInTheDocument();
    typeFormula('[Lunch nett] × 2');
    expect(within(editor()).getByText('Can’t find [Lunch nett]')).toBeInTheDocument();
  });

  it('suggests figures after you type [', async () => {
    const { user } = await openByNameReady('Lunch net');
    const ta = within(editor()).getByLabelText('Formula') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '[Tip', selectionStart: 4 } });
    expect(within(editor()).getByText('Figures matching “Tip”')).toBeInTheDocument();
    await user.click(within(editor()).getByRole('button', { name: 'Card tips' }));
    expect(ta.value).toBe('[Card tips]');
  });

  it('groups the figures in tabs, starting on the one being edited, with short names that add the full name', async () => {
    const { user } = await openByNameReady('Lunch net');
    const tabs = within(editor()).getByRole('tablist', { name: 'Figures by group' });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Lunch', 'Dinner', 'Delivery', 'Wages', 'Tips', 'Day totals', 'Checks', 'Settings']);
    expect(within(tabs).getByRole('tab', { name: 'Lunch' })).toHaveAttribute('aria-selected', 'true');
    const panel = within(editor()).getByRole('tabpanel');
    expect(within(panel).getByRole('button', { name: 'Lunch gross' })).toHaveTextContent(/^Gross$/);
    expect(within(panel).queryByRole('button', { name: 'Wage %' })).not.toBeInTheDocument();
    await user.click(within(tabs).getByRole('tab', { name: 'Day totals' }));
    const ta = within(editor()).getByLabelText('Formula') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '', selectionStart: 0 } });
    await user.click(within(editor()).getByRole('button', { name: 'Wage %' }));
    expect(ta.value).toBe('[Wage %]');
  });
});

/** Opens the builder and one figure. */
async function openByNameReady(name: string) {
  const r = await openBuilder();
  await openByName(r.user, name);
  return r;
}

describe('renaming', () => {
  it('updates every formula and email that uses the name, and keeps the answers', async () => {
    const { user } = await openByNameReady('Day total net');
    const nm = within(editor()).getByLabelText('Name');
    await user.clear(nm);
    await user.type(nm, 'Net sales{Enter}');
    expect(changes()).toContain('Renamed Day total net');
    expect(text('#heroFig')).toBe('£2,687.50');
    expect(text('#heroTests')).toBe('8 of 8');
    expect(stored().draft ?? null).toBeNull(); // not saved yet: it saves a moment later
    await waitSaved();
    const def = stored().draft!.definition;
    expect(def.figures.find((f) => f.id === 'wagePct')?.formula).toContain('[Net sales]');
    expect(def.actions.find((a) => a.id === 'email')?.shows).toContain('Net sales');
  });

  it('refuses a name that is taken, and says why', async () => {
    const { user } = await openByNameReady('Day total net');
    const nm = within(editor()).getByLabelText('Name');
    await user.clear(nm);
    await user.type(nm, 'Lunch net');
    expect(screen.getByRole('alert')).toHaveTextContent('There is already a figure called Lunch net');
  });

  it('shows names as text, so HTML typed into a name can’t run', async () => {
    const { user } = await openByNameReady('Day total net');
    const nm = within(editor()).getByLabelText('Name');
    await user.clear(nm);
    await user.type(nm, '<img src=x onerror=alert(1)>{Enter}');
    expect(document.querySelector('img')).toBeNull();
    expect(changes()).toContain('Renamed Day total net');
  });
});

describe('changing', () => {
  it('moves an input to another section, makes it optional and adds a hint', async () => {
    const { user } = await openByNameReady('Wage cost');
    await user.selectOptions(within(editor()).getByLabelText('Section'), 'tips');
    expect(changes()).toContain('Moved Wage cost');
    await user.click(within(editor()).getByRole('button', { name: 'Required' }));
    expect(changes()).toContain('Changed how managers see Wage cost');
  });

  it('changing an example value recalculates without counting as a change; a setting counts', async () => {
    const { user } = await openByNameReady('Lunch gross');
    const ex = within(editor()).getByLabelText('Test-day value');
    await user.clear(ex);
    await user.type(ex, '1300');
    await user.tab();
    expect(text('#heroFig')).toBe('£2,787.50');
    expect(changes()).toEqual([]);
    await openByName(user, 'Cash float');
    const v = within(editor()).getByLabelText('Value at this site');
    await user.clear(v);
    await user.type(v, '200');
    await user.tab();
    expect(changes()).toContain('Changed the Cash float setting');
  });
});

describe('connecting', () => {
  it('connects a new input from “Add it to…”, and the total follows', async () => {
    const { user } = await openBuilder();
    await user.click($('[data-act="input"]')!);
    await user.keyboard('{Enter}');
    await user.click($('.frow[data-var="New input"]')!);
    const ex = within(editor()).getByLabelText('Test-day value');
    await user.clear(ex);
    await user.type(ex, '100');
    await user.tab();
    await user.selectOptions(within(editor()).getByLabelText('Add it to…'), 'dayNet');
    expect(text('#heroFig')).toBe('£2,787.50');
    expect(changes()).toContain('Changed Day total net');
  });

  it('only offers boxes that wouldn’t make a loop or a repeat', async () => {
    const { user } = await openByNameReady('Day total net');
    const opts = within(within(editor()).getByLabelText('Add it to…')).getAllByRole('option').map((o) => o.textContent);
    expect(opts).not.toContain('Dine-in net'); // feeds Day total net
    expect(opts).not.toContain('Send the summary email'); // already shows it
    expect(opts).toContain('Gross sales');
    await user.keyboard('{Escape}');
  });

  it('adds a figure to the summary email by ticking it', async () => {
    const { user } = await openByNameReady('Send the summary email');
    await user.click(within(editor()).getByRole('checkbox', { name: /Gross sales/ }));
    expect(changes()).toContain('Changed Send the summary email');
  });

  it('shows what Power Automate receives, and updates it when a figure is ticked', async () => {
    const { user } = await openByNameReady('Send to Power Automate');
    const preview = () => within(editor()).getByLabelText('Example message').textContent ?? '';
    expect(preview()).toContain('"name": "Day total net"');
    expect(preview()).toContain('"text": "£2,687.50"');
    expect(preview()).not.toContain('Gross sales');
    await user.click(within(editor()).getByRole('checkbox', { name: /Gross sales/ }));
    expect(preview()).toContain('"name": "Gross sales"');
    expect(changes()).toContain('Changed Send to Power Automate');
    await waitSaved();
    expect(stored().draft!.definition.actions.find((a) => a.id === 'flow')?.shows).toContain('Gross sales');
  });

  it('removes a link from the line’s menu', async () => {
    const { user } = await openBuilder();
    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    const hit = $(`#edges .hit[data-src="Lunch service charge"][data-tgt="lunchNet"]`)!;
    fireEvent.click(hit);
    await user.click(screen.getByRole('button', { name: 'Remove link' }));
    expect(changes()).toContain('Changed Lunch net');
    expect(text('#heroTests')).not.toBe('8 of 8');
  });
});

describe('deleting and undo', () => {
  it('blocks deleting something that is used, and says what uses it', async () => {
    const { user } = await openByNameReady('Lunch gross');
    expect(within(editor()).getByRole('button', { name: 'Delete input' })).toBeDisabled();
    expect(within(editor()).getByText(/Take it out of Lunch net, Gross sales/)).toBeInTheDocument();
  });

  it('deletes an unused input, and Undo brings it back', async () => {
    const { user } = await openBuilder();
    await user.click($('[data-act="input"]')!);
    await user.keyboard('{Enter}');
    await user.click(screen.getAllByRole('button', { name: 'Delete New input' })[0]!);
    expect(changes()).toEqual([]);
    await user.click(within($('.toast')!).getByRole('button', { name: 'Undo' }));
    expect(changes()).toContain('Added New input');
  });

  it('deletes with the keyboard, and ⌘Z / Ctrl Z undoes', async () => {
    const { user } = await openBuilder();
    await user.click($('[data-act="calc"]')!);
    await user.keyboard('{Enter}');
    expect(changes()).toContain('Added New calculation');
    await user.keyboard('{Delete}');
    expect(changes()).toEqual([]);
    await user.keyboard('{Control>}z{/Control}');
    expect(changes()).toContain('Added New calculation');
  });

  it('deletes a whole section once nothing uses its inputs', async () => {
    const { user } = await openBuilder();
    await user.click($('[data-act="section"]')!);
    await user.keyboard('{Enter}');
    await user.click($('.node[data-id^="sec-"] .nh')!);
    await user.click(within(editor()).getByRole('button', { name: 'Delete section' }));
    expect(changes()).toEqual([]);
  });

  it('undoes one step from the middle of History and keeps the ones after it', async () => {
    const { user } = await openBuilder();
    await user.click($('[data-act="input"]')!);
    await user.keyboard('{Enter}');
    await user.click($('[data-act="calc"]')!);
    await user.keyboard('{Enter}');
    expect($$('#history .li .t').map((e) => e.firstChild?.textContent)).toEqual(['Added a calculation', 'Added an input to Lunch']);
    await user.click(screen.getByRole('button', { name: 'Undo Added an input to Lunch' }));
    expect(changes()).toEqual(['Added New calculation']);
  });

  it('refuses to undo a step that a later step needs, and changes nothing', async () => {
    const { user } = await openBuilder();
    await user.click($('[data-act="input"]')!);
    await user.keyboard('{Enter}');
    await user.click($('.frow[data-var="New input"]')!);
    await user.selectOptions(within(editor()).getByLabelText('Add it to…'), 'dayNet');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Undo Added an input to Lunch' }));
    expect(screen.getByText(/Can’t undo “Added an input to Lunch” on its own/)).toBeInTheDocument();
    expect(changes()).toEqual(expect.arrayContaining(['Added New input', 'Changed Day total net']));
  });
});

describe('tests', () => {
  it('a formula change that moves totals blocks sending until someone confirms the new figures', async () => {
    const { user } = await openByNameReady('Lunch net');
    typeFormula('[Lunch gross] − [Lunch VAT] − [Lunch discounts]');
    await user.keyboard('{Escape}');
    expect(text('#heroTests')).toBe('3 of 8');
    expect(screen.getByText('5 tests failing')).toBeInTheDocument();
    for (const b of screen.getAllByRole('button', { name: 'Publish' })) expect(b).toBeDisabled();
    while (screen.queryAllByRole('button', { name: 'It’s right, update' }).length) await user.click(screen.getAllByRole('button', { name: 'It’s right, update' })[0]!);
    expect(text('#heroTests')).toBe('8 of 8');
    expect(changes()).toContain('Changed the expected Lunch net');
    for (const b of screen.getAllByRole('button', { name: 'Publish' })) expect(b).toBeEnabled();
  }, SLOW);

  it('a broken formula blocks sending', async () => {
    const { user } = await openByNameReady('Lunch net');
    typeFormula('[Lunch gross] −');
    await user.keyboard('{Escape}');
    expect(screen.getByText('A formula needs fixing')).toBeInTheDocument();
  });

  it('Undo all changes gets back to the live version', async () => {
    const { user } = await openByNameReady('Lunch net');
    typeFormula('[Lunch gross]');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Undo all changes' }));
    expect(changes()).toEqual([]);
    expect(text('#heroTests')).toBe('8 of 8');
  });
});

describe('other views', () => {
  it('list view shows every box, and opens one', async () => {
    const { user } = await openBuilder();
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect($$('.lrow')).toHaveLength(6 + EOD_DEFINITION.figures.filter((f) => f.kind === 'calc' || f.kind === 'check').length + EOD_DEFINITION.actions.length);
    await user.click($('.lrow[data-id="dayNet"]')!);
    expect(editor()).toHaveAccessibleName('Edit Day total net');
  });

  it('pipeline: six stages, and a blocking check fails Validate and skips Store and Notify', async () => {
    const { user } = await openByNameReady('Lunch till cash');
    const ex = within(editor()).getByLabelText('Test-day value');
    await user.clear(ex);
    await user.type(ex, '100');
    await user.tab();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Pipeline' }));
    expect($$('.pv-stage')).toHaveLength(6);
    expect(screen.getByRole('listitem', { name: 'Validate: Failed' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Store: Skipped' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Wages over red/ }));
    expect(editor()).toHaveAccessibleName('Edit Wages over red?');
  });
});

describe('workspace', () => {
  it('lists everything in the layers panel; a figure opens its editor', async () => {
    const { user } = await openBuilder();
    const layers = screen.getByRole('navigation', { name: 'Everything in the report' });
    await user.click(within(layers).getByRole('button', { name: 'Unfold Lunch' }));
    await user.click(within(layers).getByRole('button', { name: 'Lunch gross' }));
    expect(editor()).toHaveAccessibleName('Edit Lunch gross');
  });

  it('opens a box as a pop-up, and closes it with × or Esc', async () => {
    const { user } = await openByNameReady('Lunch net');
    await user.click(within(editor()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await openByName(user, 'Lunch net');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens and folds a group with its chevron', async () => {
    const { user } = await openBuilder();
    await user.click(screen.getByRole('button', { name: 'Show Lunch figures' }));
    expect($$('.node[data-id="c-lunch"] .mrow').map((r) => r.dataset.var)).toEqual(['Lunch net', 'Lunch covers', 'Lunch net per head', 'Lunch food %', 'Lunch drink %', 'Lunch cash taken', 'Lunch cash difference']);
    await user.click(screen.getByRole('button', { name: 'Hide Lunch figures' }));
    expect($$('.node[data-id="c-lunch"] .mrow').length).toBe(0);
  });

  it('adds with single keys: I input, C calculation, K check', async () => {
    const { user } = await openBuilder();
    for (const k of ['i', 'c', 'k']) { await user.keyboard(k); await user.keyboard('{Enter}'); }
    expect(changes()).toEqual(expect.arrayContaining(['Added New input', 'Added New calculation', 'Added New check']));
  });

  it('Shift-click picks several cards; dragging one moves them all, and one Undo puts them back', async () => {
    await openBuilder();
    const card = (id: string) => $(`.node[data-id="${id}"]`)!;
    const at = (id: string) => [card(id).style.left, card(id).style.top];
    const click = (id: string, shiftKey: boolean) => { fireEvent.pointerDown(card(id).querySelector('.nh')!, { button: 0, shiftKey, clientX: 10, clientY: 10 }); fireEvent.pointerUp(window, { clientX: 10, clientY: 10 }); fireEvent.click(card(id).querySelector('.nh')!); };
    click('lunch', true); click('dinner', true);
    expect($$('.node.picked').map((n) => n.dataset.id)).toEqual(['lunch', 'dinner']);
    expect(text('.tool')).toContain('2 selected');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    click('dinner', true);
    expect($$('.node.picked').map((n) => n.dataset.id)).toEqual(['lunch']);
    click('dinner', true);
    const before = { lunch: at('lunch'), dinner: at('dinner') };
    fireEvent.pointerDown(card('lunch').querySelector('.nh')!, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 90 });
    fireEvent.pointerUp(window, { clientX: 60, clientY: 90 });
    expect(at('lunch')).not.toEqual(before.lunch);
    expect(at('dinner')).not.toEqual(before.dinner);
    await act(async () => { fireEvent.keyDown(document, { key: 'z', metaKey: true }); });
    expect({ lunch: at('lunch'), dinner: at('dinner') }).toEqual(before);
    expect(text('.toast')).toContain('Undid: Moved 2 cards');
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect($$('.node.picked')).toHaveLength(0);
  });

  it('changes a type’s colour from the dots at the bottom; taking one in use swaps the two', async () => {
    const { user } = await openBuilder();
    const rb = $('.rb')!;
    await user.click(screen.getByRole('button', { name: 'Inputs' }));
    const pal = screen.getByRole('dialog', { name: 'Colour for Inputs' });
    await user.click(within(pal).getByRole('button', { name: /^Plum/ }));
    expect(rb.style.getPropertyValue('--r-in')).toBe('#A23B72');
    await user.click(within(pal).getByRole('button', { name: /^Teal/ }));
    expect(rb.style.getPropertyValue('--r-in')).toBe('#16879D');
    expect(rb.style.getPropertyValue('--r-act')).toBe('#A23B72'); // checks took the inputs' old colour
    expect(text('.toast')).toBe('Swapped colours with Checks & actions');
    await user.click(within(pal).getByRole('button', { name: 'Reset all colours' }));
    expect(rb.style.getPropertyValue('--r-in')).toBe('');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Colour for Inputs' })).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ saving */

describe('saving', () => {
  it('saves the draft a moment after a change, and it is still there when the builder is opened again', async () => {
    const first = await openByNameReady('Lunch net');
    typeFormula('[Lunch gross] − [Lunch VAT] − [Lunch discounts]');
    expect(screen.getByText('Saving…')).toBeInTheDocument();
    await waitSaved();
    expect(screen.getByRole('status', { name: 'Status: Draft' })).toBeInTheDocument();
    expect(stored().draft?.by).toBe('Ana');
    first.unmount();

    await openBuilder();
    expect(text('#heroFig')).toBe('£2,807.50');
    expect(changes()).toContain('Changed Lunch net');
    expect(screen.getByRole('status', { name: 'Status: Draft' })).toBeInTheDocument();
  });

  it('Discard throws the saved draft away and goes back to the live version', async () => {
    const { user } = await openByNameReady('Lunch net');
    typeFormula('[Lunch gross]');
    await user.keyboard('{Escape}');
    await waitSaved();
    await user.click(screen.getByRole('button', { name: 'Discard the saved draft' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Discard the draft' })).getByRole('button', { name: 'Discard' }));
    await screen.findByRole('status', { name: 'Status: Live' });
    expect(changes()).toEqual([]);
    expect(stored().draft).toBeNull();
  });

  it('when someone else saved first, shows their change and lets you reload it', async () => {
    const { user } = await openByNameReady('Lunch net');
    // Ben saves a draft from another device while Ana has the builder open.
    act(() => {
      const theirs = saveDefinitionDraft(stored(), { definition: updateFigure(EOD_DEFINITION, 'tipsTotal', { formula: '[Card tips]' }), testDays: stored().versions[0]!.testDays, by: 'Ben', at: '2026-10-05T20:00:00Z' });
      setDemoDefinitions(theirs);
    });
    typeFormula('[Lunch gross]');
    await user.keyboard('{Escape}');
    const banner = await screen.findByRole('alert', {}, { timeout: 2000 });
    expect(banner).toHaveTextContent('Someone else changed the report while you were working');
    expect(banner).toHaveTextContent('Ben saved a draft');
    expect(within(banner).getByRole('list', { name: 'Their changes' })).toHaveTextContent('Changed Total tips');
    await user.click(within(banner).getByRole('button', { name: 'Reload their version' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(changes()).toEqual(['Changed Total tips']);
    expect(stored().draft?.definition.figures.find((f) => f.id === 'lunchNet')?.formula).toContain('[Lunch service charge]');
  });
});

/** Ana makes the service-charge change, confirms the new figures and publishes it. */
async function anaPublishes(summary = 'Count service charge in lunch net sales') {
  const r = await openByNameReady('Lunch net');
  typeFormula('[Lunch gross] − [Lunch VAT] − [Lunch discounts]');
  await r.user.keyboard('{Escape}');
  while (screen.queryAllByRole('button', { name: 'It’s right, update' }).length) await r.user.click(screen.getAllByRole('button', { name: 'It’s right, update' })[0]!);
  await waitSaved();
  await r.user.click(screen.getAllByRole('button', { name: 'Publish' })[0]!);
  const dlg = screen.getByRole('dialog', { name: 'Publish' });
  const box = within(dlg).getByLabelText('What changed');
  await r.user.clear(box);
  await r.user.click(within(dlg).getByRole('button', { name: 'Publish' }));
  expect(within(dlg).getByRole('alert')).toHaveTextContent('Say what changed');
  await r.user.type(box, summary);
  await r.user.click(within(dlg).getByRole('button', { name: 'Publish' }));
  await screen.findByRole('status', { name: 'Status: Starts tomorrow' });
  return r;
}

/** A change Ana sent for approval before publishing replaced approval, already saved on the device. */
function waitingFromBefore() {
  let rec = seedDefinitionRecord({ startsOn: '2000-01-01', by: 'Finance', at: '2000-01-01T00:00:00Z' });
  const def = updateFigure(EOD_DEFINITION, 'wagePct', { description: 'Share of today’s net spent on wages' });
  rec = saveDefinitionDraft(rec, { definition: def, testDays: [VERIFIED_TEST_DAY], by: 'Ana', at: '2026-10-05T10:00:00Z' });
  rec = submitDefinition(rec, { summary: 'Clearer wording for Wage %', by: 'Ana', at: '2026-10-05T10:00:00Z' });
  setDemoDefinitions(rec);
}

describe('publishing', () => {
  it('needs a summary; then it’s live from the next trading day, with no second person; it can be rolled back', async () => {
    const { user } = await anaPublishes();
    expect(screen.getByText('Published. Managers at every site use it from Tuesday 6 October.')).toBeInTheDocument();
    const v2 = stored().versions[1]!;
    expect([v2.version, v2.startsOn, v2.summary, v2.draftedBy, v2.approvedBy]).toEqual([2, '2026-10-06', 'Count service charge in lunch net sales', 'Ana', 'Ana']);
    expect(stored().pending).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Roll back to v1' }));
    const rb = screen.getByRole('dialog', { name: 'Roll back to v1' });
    await user.type(within(rb).getByLabelText('Why'), 'Published by mistake');
    await user.click(within(rb).getByRole('button', { name: 'Roll back to v1' }));
    await waitFor(() => expect(stored().versions).toHaveLength(3));
    expect(stored().versions[2]!.summary).toBe('Back to v1: Published by mistake');
  }, SLOW);

  it('a change sent for approval before can be approved by the person who sent it', async () => {
    waitingFromBefore();
    const { user } = await openBuilder(ana);
    expect(screen.getByText('Sent for approval')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Approve this change' })).getByRole('button', { name: 'Approve' }));
    await screen.findByRole('status', { name: 'Status: Starts tomorrow' });
    expect(stored().versions[1]).toMatchObject({ version: 2, draftedBy: 'Ana', approvedBy: 'Ana', startsOn: '2026-10-06' });
  }, SLOW);

  it('someone else can still turn such a change down with a reason, and it goes back to Ana as a draft', async () => {
    waitingFromBefore();
    const { user } = await openBuilder(ben);
    expect(screen.getByText('Ana sent this for approval')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Turn down' }));
    const dlg = screen.getByRole('dialog', { name: 'Turn this change down' });
    await user.type(within(dlg).getByLabelText('Why'), 'Keep the old wording');
    await user.click(within(dlg).getByRole('button', { name: 'Turn down' }));
    await screen.findByRole('status', { name: 'Status: Draft' });
    expect(stored().rejected?.reason).toBe('Keep the old wording');
  }, SLOW);
});

describe('the whole journey', () => {
  it('edit → autosave → reopen → publish → a manager’s EOD shows it from the next trading day', async () => {
    // Ana edits; it saves itself; she closes the builder and opens it again: the edit is still there.
    const first = await openByNameReady('Lunch net');
    typeFormula('[Lunch gross] − [Lunch VAT] − [Lunch discounts]');
    await first.user.keyboard('{Escape}');
    await waitSaved();
    first.unmount();
    const again = await openBuilder(ana);
    expect(text('#heroFig')).toBe('£2,807.50');
    while (screen.queryAllByRole('button', { name: 'It’s right, update' }).length) await again.user.click(screen.getAllByRole('button', { name: 'It’s right, update' })[0]!);
    await waitSaved();

    // She publishes it on Monday 5 October, with a summary. Nobody else needs to approve it.
    await again.user.click(screen.getAllByRole('button', { name: 'Publish' })[0]!);
    const dlg = screen.getByRole('dialog', { name: 'Publish' });
    await again.user.clear(within(dlg).getByLabelText('What changed'));
    await again.user.type(within(dlg).getByLabelText('What changed'), 'Service charge counts in lunch net');
    await again.user.click(within(dlg).getByRole('button', { name: 'Publish' }));
    await screen.findByRole('status', { name: 'Status: Starts tomorrow' });
    again.unmount();

    // Tonight's report keeps today's rules.
    await seedVerifiedDraft();
    const today = renderApp('/close/review', manager);
    expect(await screen.findByTestId('day-total')).toHaveTextContent('£2,687.50');
    today.unmount();

    // On Tuesday, the manager's review screen shows the new figure.
    setNow(new Date('2026-10-06T21:00:00Z'));
    await seedVerifiedDraft((d) => { d.businessDate = '2026-10-06'; });
    renderApp('/close/review', manager);
    expect(await screen.findByTestId('day-total')).toHaveTextContent('£2,807.50');
    const rec: DefinitionRecord = stored();
    expect(rec.versions.map((v) => [v.version, v.startsOn])).toEqual([[1, '2000-01-01'], [2, '2026-10-06']]);
  }, SLOW);
});
