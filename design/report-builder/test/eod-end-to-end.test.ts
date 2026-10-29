/**
 * End to end: a change made in the builder → saved and published through the real server
 * endpoint (no second person needed) → a manager's submitted EOD worked out with the published version.
 *
 * Checks that each change moves exactly the figures it should, and that everything else still
 * matches today's EOD (computeDay) to the penny. Example figures only (HANDOFF.md §5).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { computeDay, definitionOn, officialFigures, seedDefinitionRecord, type DefinitionRecord, type EodDraft } from '../../../packages/core/src/index';
import { settings, verifiedDraft } from '../../../packages/core/test/fixtures';
import { createDefinitionHandler, MemoryDefinitionStore } from '../../../apps/functions/src/report-definition-handler';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

/* ---------- the builder, driven like a person ---------- */
function openBuilder() {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const doc = dom.window.document, w = dom.window as any;
  const $ = <T extends Element = HTMLElement>(sel: string) => doc.querySelector(sel) as T;
  const press = (el: Element, key: string) => el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true }));
  const type = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string, change = true) => {
    el.value = value; el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    if (change) el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  };
  ($('#colAll') as HTMLButtonElement).click(); // open every card
  const open = (id: string) => press(($(`.node[data-id="${id}"] .nh`) ?? $(`.mrow[data-id="${id}"]`))!, 'Enter');
  const openField = (name: string) => press($(`.frow[data-var="${name}"]`)!, 'Enter');
  return {
    $, type, open, openField,
    rename(name: string, to: string) { openField(name); type($<HTMLInputElement>('#nm'), to); },
    formula(id: string, f: string) {
      open(id); const fx = $<HTMLTextAreaElement>('#fx');
      fx.dispatchEvent(new dom.window.Event('focus')); type(fx, f);
    },
    addInput(section: string, name: string, test: string) {
      ($(`.node[data-id="${section}"] .addrow`) as HTMLButtonElement).click();
      const inl = $<HTMLInputElement>('.inl'); inl.value = name; press(inl, 'Enter');
      openField(name); type($<HTMLInputElement>('#ex'), test, false);
    },
    connect(name: string, targetId: string) { openField(name); type($<HTMLSelectElement>('#useIn'), targetId); },
    acceptTests() { while ($('#tests [data-fix]')) ($('#tests [data-fix]') as HTMLButtonElement).click(); },
    async suggest(key: 'fees' | 'sc') {
      ($(`[data-sug="${key}"]`) as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 650));
      ($('#applyP') as HTMLButtonElement).click();
    },
    exportDraft: () => w.__builder.exportDraft(),
    testsPassing: () => $('#heroTests').textContent,
  };
}

/* ---------- the server: draft → publish → live ---------- */
const PEOPLE = { ana: { name: 'Ana', siteCodes: [], role: 'headoffice' as const }, ben: { name: 'Ben', siteCodes: [], role: 'headoffice' as const } };
async function approveThroughServer(draft: { definition: unknown; testDays: unknown }): Promise<DefinitionRecord> {
  const store = new MemoryDefinitionStore(seedDefinitionRecord({ startsOn: '2026-09-01', by: 'Finance', at: '2026-09-01T09:00:00Z' }));
  const handler = createDefinitionHandler({
    authenticate: async (req) => PEOPLE[req.headers.get('Authorization')!.slice(7) as 'ana' | 'ben'] ?? null,
    store,
    groupSettings: async () => ({ dayCloseTime: '04:00', timezone: 'Europe/London' }),
    now: () => new Date('2026-10-01T11:00:00Z'), // approved 1 Oct, so it's live from 2 Oct
  });
  const call = async (who: 'ana' | 'ben', method: string, body: unknown) => {
    const etag = (await handler(new Request('https://ops.example/', { headers: { Authorization: `Bearer ${who}` } }))).headers.get('ETag')!;
    const res = await handler(new Request('https://ops.example/', { method, headers: { Authorization: `Bearer ${who}`, 'If-Match': etag, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
    const json = await res.json();
    if (res.status !== 200) throw new Error(`${method} by ${who}: ${res.status} ${json.error}`);
    return json;
  };
  await call('ana', 'PUT', draft);
  const done = await call('ana', 'POST', { action: 'publish', summary: 'Change from the builder' });
  return done.record as DefinitionRecord;
}

/** The figures a manager's EOD would get today, and with the approved version. */
const eod = (): EodDraft => verifiedDraft(); // trading day 5 Oct 2026
const today = () => computeDay(eod(), settings, { netSales: 250000 });
const pounds = (p: number) => p / 100;

/** Figures the change must not touch: they have to equal today's EOD exactly. */
function expectUnchanged(f: Record<string, number>, ids: string[]) {
  const d = today(), L = d.sessions.lunch, D = d.sessions.dinner;
  const now: Record<string, number | null> = {
    lunchNet: L.net, lunchCovers: L.covers, lunchHead: L.perHead, lunchCashTaken: L.cash.taken, lunchCashDiff: L.cash.difference,
    dinnerNet: D.net, dinnerCovers: D.covers, dinnerHead: D.perHead, dinnerCashTaken: D.cash.taken, dinnerCashDiff: D.cash.difference,
    delNet: d.delivery.find((x) => x.platformId === 'deliveroo')!.net, deliveryNet: d.deliveryNet, dineInNet: d.dineInNet,
    dayNet: d.totalNet, dayGross: d.totalGross, covers: d.covers, headNet: d.perHeadDineIn, tipsTotal: d.tips, vsTarget: d.netVsTarget,
  };
  for (const id of ids) expect(f[id], id).toBe(now[id]);
}

describe('builder change → approved → a manager’s EOD', () => {
  it('with no changes, every figure matches today’s EOD', async () => {
    const b = openBuilder();
    expect(b.testsPassing()).toBe('8 of 8');
    // The builder's own export, sent through the server unchanged, gives the same EOD as today.
    const rec = await approveThroughServer(b.exportDraft());
    const f = officialFigures(rec, eod(), settings, {}, 250000);
    expect(f.version).toBe(2);
    expect(f.errors).toEqual({});
    expectUnchanged(f.byId, ['lunchNet', 'dinnerNet', 'dayNet', 'dayGross', 'covers', 'headNet', 'tipsTotal', 'vsTarget', 'lunchCashDiff', 'dinnerCashDiff']);
  });

  it('renaming inputs and figures changes nothing in the EOD (figures are linked by id)', async () => {
    const b = openBuilder();
    b.rename('Lunch gross', 'Lunch sales');
    b.open('dayNet'); b.type(b.$<HTMLInputElement>('#nm'), 'Net sales');
    const rec = await approveThroughServer(b.exportDraft());
    const f = officialFigures(rec, eod(), settings, {}, 250000);
    expect(f.version).toBe(2);
    expect(f.errors).toEqual({});
    expectUnchanged(f.byId, ['lunchNet', 'dinnerNet', 'dayNet', 'dayGross', 'covers', 'headNet', 'tipsTotal', 'vsTarget', 'lunchCashDiff']);
  });

  it('taking service charge out of the formula moves net sales, wages % and the target, nothing else', async () => {
    const b = openBuilder();
    await b.suggest('sc');
    b.acceptTests();
    expect(b.testsPassing()).toBe('8 of 8');
    const rec = await approveThroughServer(b.exportDraft());
    const f = officialFigures(rec, eod(), settings, {}, 250000);
    // £1,200 − £180 − £50 = £970.00 at lunch; £2,400 − £360 − £100 = £1,940.00 at dinner.
    expect(pounds(f.byId.lunchNet!)).toBe(970);
    expect(pounds(f.byId.dinnerNet!)).toBe(1940);
    expect(pounds(f.byId.dayNet!)).toBe(970 + 1940 + 137.5);
    expect(Math.round(f.byId.wagePct! * 1000) / 10).toBe(26.3); // £800 ÷ £3,047.50
    expect(pounds(f.byId.vsTarget!)).toBe(3047.5 - 2500);
    expectUnchanged(f.byId, ['delNet', 'covers', 'tipsTotal', 'lunchCashDiff', 'dinnerCashDiff', 'dayGross']);
  });

  it('card fees: a new input, a new setting and two new figures reach the EOD and the email', async () => {
    const b = openBuilder();
    await b.suggest('fees');
    const draft = b.exportDraft();
    const rec = await approveThroughServer(draft);
    // A manager enters card takings of £2,900; the site's card fee rate is 1.75%.
    const f = officialFigures(rec, eod(), settings, { 'pay.card': 290000, 'set.cardfee': 0.0175 }, 250000);
    expect(pounds(f.byId.cardFees!)).toBe(50.75);
    expect(pounds(f.byId.netAfter!)).toBe(2636.75);
    expect(definitionOn(rec, '2026-10-05')!.definition.actions.find((a) => a.id === 'email')!.shows).toContain('Net after card fees');
    expectUnchanged(f.byId, ['lunchNet', 'dinnerNet', 'dayNet', 'covers', 'tipsTotal', 'vsTarget']);
  });

  it('a new input connected to a calculation adds the manager’s figure into the total', async () => {
    const b = openBuilder();
    b.addInput('lunch', 'Lunch room hire', '100');
    b.connect('Lunch room hire', 'lunchNet');
    b.acceptTests();
    const rec = await approveThroughServer(b.exportDraft());
    const id = rec.versions.at(-1)!.definition.figures.find((x) => x.name === 'Lunch room hire')!.id;
    const withHire = officialFigures(rec, eod(), settings, { [id]: 15000 }, 250000); // manager enters £150
    expect(pounds(withHire.byId.lunchNet!)).toBe(850 + 150);
    expect(pounds(withHire.byId.dayNet!)).toBe(2687.5 + 150);
    // Left empty by the manager, it counts as nothing rather than breaking the report.
    const empty = officialFigures(rec, eod(), settings, {}, 250000);
    expect(empty.errors).toEqual({});
    expect(pounds(empty.byId.lunchNet!)).toBe(850);
  });

  it('a typed formula change applies to the EOD exactly as written', async () => {
    const b = openBuilder();
    b.formula('wagePct', '[Wage cost] ÷ [Dine-in net]'); // wages against dine-in only
    b.acceptTests();
    const rec = await approveThroughServer(b.exportDraft());
    const f = officialFigures(rec, eod(), settings, {}, 250000);
    expect(Math.round(f.byId.wagePct! * 1000) / 10).toBe(31.4); // £800 ÷ £2,550
    expect(f.byId.amber).toBe(1); // over the 30% amber limit now
    expect(f.byId.check).toBe(0); // still under the 35% red limit
    expectUnchanged(f.byId, ['lunchNet', 'dayNet', 'covers']);
  });

  it('removing a link in the builder takes that figure out of the EOD total', async () => {
    const b = openBuilder();
    const hit = [...b.$('#edges').querySelectorAll('.hit')].find((h) => h.getAttribute('data-src') === 'Lunch discounts' && h.getAttribute('data-tgt') === 'lunchNet')!;
    hit.dispatchEvent(new (b.$('#edges').ownerDocument.defaultView as any).MouseEvent('click', { bubbles: true }));
    (b.$('.linkpop [data-rm]') as HTMLButtonElement).click();
    b.acceptTests();
    const rec = await approveThroughServer(b.exportDraft());
    const f = officialFigures(rec, eod(), settings, {}, 250000);
    expect(pounds(f.byId.lunchNet!)).toBe(900); // discounts (£50) no longer taken off
    expect(pounds(f.byId.dayNet!)).toBe(2737.5);
  });

  it('the builder’s test-day values are examples: the EOD uses the manager’s figures and the site’s settings', async () => {
    const b = openBuilder();
    b.openField('Wage cost'); b.type(b.$<HTMLInputElement>('#ex'), '5000', false); // example only
    b.openField('Wage % amber limit'); b.type(b.$<HTMLInputElement>('#ex'), '10%'); // changes the test day only
    b.addInput('wages', 'Agency staff', '0'); // one real change, so there's something to approve
    b.acceptTests();
    const rec = await approveThroughServer(b.exportDraft());
    const f = officialFigures(rec, eod(), settings, {}, 250000);
    expect(Math.round(f.byId.wagePct! * 1000) / 10).toBe(29.8); // the manager’s £800, not the £5,000 example
    expect(f.byId.amber).toBe(0); // the site’s own 30% amber limit, not the 10% typed on the test day
  });

  it('reports keep the version for their own trading day; an approved change starts the next day', async () => {
    const b = openBuilder();
    await b.suggest('sc'); b.acceptTests();
    const rec = await approveThroughServer(b.exportDraft()); // approved 1 Oct
    const before = { ...eod(), businessDate: '2026-10-01' }, after = { ...eod(), businessDate: '2026-10-02' };
    expect(officialFigures(rec, before, settings).version).toBe(1);
    expect(pounds(officialFigures(rec, before, settings).byId.lunchNet!)).toBe(850);
    expect(officialFigures(rec, after, settings).version).toBe(2);
    expect(pounds(officialFigures(rec, after, settings).byId.lunchNet!)).toBe(970);
  });

  it('a change whose tests fail can’t be approved, so it never reaches the EOD', async () => {
    const b = openBuilder();
    await b.suggest('sc'); // moves 5 tests, not accepted
    await expect(approveThroughServer(b.exportDraft())).rejects.toThrow(/422 5 tests failing/);
  });

  it('a broken formula can’t be approved either', async () => {
    const b = openBuilder();
    b.formula('dinnerNet', '[Dinner gross] −');
    await expect(approveThroughServer(b.exportDraft())).rejects.toThrow(/422 Fix the formulas with problems first: Dinner net/);
  });
});
