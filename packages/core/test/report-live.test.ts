import { describe, expect, it } from 'vitest';
import { computeDay, type DayResult } from '../src/calc';
import { eodSummaryEmail } from '../src/email';
import { MemoryStore } from '../src/store';
import { submitReport } from '../src/submit';
import { EOD_DEFINITION, VERIFIED_TEST_DAY, addFigure, connect, disconnect, updateFigure, type ReportDefinition } from '../src/report-definition';
import { approveDefinition, saveDefinitionDraft, seedDefinitionRecord, submitDefinition, type DefinitionRecord } from '../src/report-versions';
import { BUILT_IN_IDS, addedInputs, computeDayWith, definitionIssues, liveVersion, sectionForGroup } from '../src/report-live';
import { EodDraft } from '../src/schema';
import { settings, verifiedDraft } from './fixtures';

const AT = '2026-09-30T10:00:00Z';
const seed = () => seedDefinitionRecord({ startsOn: '2026-09-01', by: 'Finance', at: AT });
/** Approves a definition on 30 Sep, so it's live from 1 Oct (the verified day is 5 Oct). */
function approved(def: ReportDefinition, testDays = [VERIFIED_TEST_DAY]): DefinitionRecord {
  let r = saveDefinitionDraft(seed(), { definition: def, testDays, by: 'Ana', at: AT });
  r = submitDefinition(r, { summary: 'change', by: 'Ana', at: AT });
  return approveDefinition(r, { by: 'Ben', today: '2026-09-30', at: AT });
}
/** Accepts a change's new figures as the test day's expected ones. */
function testDayFor(def: ReportDefinition) {
  return [{ ...VERIFIED_TEST_DAY, expect: Object.fromEntries(Object.keys(VERIFIED_TEST_DAY.expect).map((id) => [id, (approvedFigures(def))[id]!])) }];
}
function approvedFigures(def: ReportDefinition) {
  const r = { ...seed(), versions: [{ ...seed().versions[0]!, definition: def }] };
  return computeDayWith(verifiedDraft(), settings, { netSales: 250000 }, r).definition!.figures;
}
const strip = (d: DayResult) => { const { calcVersion: _c, definition: _d, ...rest } = d; return rest; };

/** Days that exercise every path in computeDay. Example figures only. */
function days() {
  const out: [string, ReturnType<typeof verifiedDraft>, number | null][] = [['verified example', verifiedDraft(), 250000]];
  const a = verifiedDraft(); a.ran.lunch = false; out.push(['lunch didn’t run', a, 250000]);
  const b = verifiedDraft(); b.ran.delivery = false; out.push(['no delivery', b, null]);
  const c = verifiedDraft(); c.sessions.lunch.cash.tillCash = 24000; out.push(['lunch cash £20 short', c, 250000]);
  const e = verifiedDraft(); e.sessions.dinner.cash.tillCash = 30000; e.sessions.dinner.cash.reason = 'Miscount, recounted'; out.push(['dinner cash over, explained', e, 250000]);
  const f = verifiedDraft(); f.sessions.dinner.food = 100000; out.push(['food and drink don’t add up', f, 250000]);
  const g = verifiedDraft(); g.wages.wageCost = 85000; out.push(['wages amber', g, 250000]);
  const h = verifiedDraft(); h.wages.wageCost = 120000; out.push(['wages red', h, 250000]);
  const i = verifiedDraft(); i.wages.wageCost = null; out.push(['no wage cost yet', i, 250000]);
  const j = verifiedDraft(); j.sessions.lunch.booked = 0; j.sessions.lunch.walkins = 0; out.push(['no lunch covers', j, 250000]);
  const k = verifiedDraft(); k.sessions.lunch.cash = { counted: {}, tillCash: null, reason: null, note: '' }; out.push(['cash not counted yet', k, 250000]);
  const l = EodDraft.parse({ ...verifiedDraft(), sessions: { ...verifiedDraft().sessions, lunch: { ...verifiedDraft().sessions.lunch, food: null, drink: null } } }); out.push(['no food/drink split', l, 250000]);
  return out;
}

describe('the live EOD with the approved version', () => {
  it('without a version, it is exactly computeDay', () => {
    const d = verifiedDraft();
    expect(computeDayWith(d, settings, { netSales: 250000 }, null)).toEqual(computeDay(d, settings, { netSales: 250000 }));
  });

  it.each(days())('with today’s rules approved, every field matches computeDay: %s', (_name, d, target) => {
    const t = { netSales: target };
    const live = computeDayWith(d, settings, t, seed());
    expect(strip(live)).toEqual(strip(computeDay(d, settings, t)));
    expect(live.calcVersion).toBe('definition-v1');
    expect(live.definition!.errors).toEqual({});
  });

  it('a report uses the version for its own trading day', () => {
    const rec = approved(disconnect(EOD_DEFINITION, 'Lunch service charge', 'lunchNet'), testDayFor(disconnect(EOD_DEFINITION, 'Lunch service charge', 'lunchNet')));
    const before = { ...verifiedDraft(), businessDate: '2026-09-30' }, after = verifiedDraft();
    expect(liveVersion(rec, '2026-09-30')!.version).toBe(1);
    expect(computeDayWith(before, settings, undefined, rec).sessions.lunch.net).toBe(85000);
    expect(computeDayWith(after, settings, undefined, rec).sessions.lunch.net).toBe(97000);
    expect(computeDayWith(after, settings, undefined, rec).calcVersion).toBe('definition-v2');
  });

  it('a formula change flows into every total and the wage colour', () => {
    const def = disconnect(disconnect(EOD_DEFINITION, 'Lunch service charge', 'lunchNet'), 'Dinner service charge', 'dinnerNet');
    const live = computeDayWith(verifiedDraft(), settings, { netSales: 250000 }, approved(def, testDayFor(def)));
    expect(live.sessions.lunch.net).toBe(97000);
    expect(live.sessions.dinner.net).toBe(194000);
    expect(live.dineInNet).toBe(291000);
    expect(live.totalNet).toBe(304750);
    expect(live.wagePct).toBe(26.3);
    expect(live.wageRag).toBe('green');
    expect(live.netVsTarget).toBe(54750);
    expect(live.sessions.lunch.perHead).toBe(2425);
    expect(live.covers).toBe(105); // untouched
  });

  it('a stricter wage rule turns wages amber', () => {
    const def = updateFigure(EOD_DEFINITION, 'wagePct', { formula: 'if([Dine-in net] > 0, [Wage cost] ÷ [Dine-in net], 0)' });
    const live = computeDayWith(verifiedDraft(), settings, undefined, approved(def, testDayFor(def)));
    expect(live.wagePct).toBe(31.4);
    expect(live.wageRag).toBe('amber');
  });

  describe('inputs and settings finance add', () => {
    let def = addFigure(EOD_DEFINITION, { id: 'pay.card', name: 'Card takings', kind: 'input', type: 'money', group: 'tips', required: true });
    def = addFigure(def, { id: 'set.cardfee', name: 'Card fee rate', kind: 'setting', type: 'percent', group: 'settings' });
    def = addFigure(def, { id: 'cardFees', name: 'Card fees', kind: 'calc', type: 'money', formula: '[Card takings] × [Card fee rate]' });
    def = addFigure(def, { id: 'netAfter', name: 'Net after card fees', kind: 'calc', type: 'money', formula: '[Day total net] − [Card fees]' });
    def = connect(def, 'Net after card fees', 'email');
    def = addFigure(def, { id: 'wages.agency', name: 'Agency staff', kind: 'input', type: 'money', group: 'wages' });
    def = addFigure(def, { id: 'room.hire', name: 'Room hire', kind: 'input', type: 'money', group: 'payments' });
    const rec = approved(def);
    const site = { ...settings, definitionSettings: { 'set.cardfee': 0.0175 } };

    it('lists the inputs managers fill in, and where they show', () => {
      expect(addedInputs(liveVersion(rec, '2026-10-05')).map((f) => [f.name, sectionForGroup(f.group)])).toEqual([['Card takings', 'tips'], ['Agency staff', 'wages'], ['Room hire', 'promotions']]);
      expect(BUILT_IN_IDS.has('pay.card')).toBe(false);
    });
    it('works out the new figures from what the manager typed and the site’s setting', () => {
      const d = EodDraft.parse({ ...verifiedDraft(), extra: { 'pay.card': 290000 } });
      const live = computeDayWith(d, site, { netSales: 250000 }, rec);
      expect(live.definition!.added).toEqual([
        { id: 'cardFees', name: 'Card fees', type: 'money', value: 5075 },
        { id: 'netAfter', name: 'Net after card fees', type: 'money', value: 263675 },
      ]);
      expect(live.totalNet).toBe(268750);
    });
    it('a required one left empty stops sending; an optional one doesn’t', () => {
      const d = verifiedDraft();
      expect(definitionIssues(d, rec)).toEqual([{ level: 'block', code: 'added-input-missing', section: 'tips', title: 'Card takings isn’t filled in', detail: 'Head office added this to the report. Fill it in before sending.' }]);
      expect(definitionIssues(EodDraft.parse({ ...d, extra: { 'pay.card': 0 } }), rec)).toEqual([]);
    });
    it('old reports without the new field still load', () => {
      const { extra: _e, ...old } = verifiedDraft();
      expect(EodDraft.parse(old).extra).toEqual({});
    });
    it('the summary email shows the figures finance added to it', () => {
      const d = EodDraft.parse({ ...verifiedDraft(), extra: { 'pay.card': 290000 } });
      const o = computeDayWith(d, site, { netSales: 250000 }, rec);
      const mail = eodSummaryEmail({ draft: d, status: 'submitted', submittedAt: AT, submittedBy: 'Jo', official: o, issues: [] }, settings);
      expect(mail.text).toContain('Net after card fees: £2,636.75');
      expect(mail.text).not.toContain('Day total net:'); // built-in figures keep their usual lines
    });
    it('submit stores the official figures from the approved version, and blocks a missing required input', async () => {
      const store = new MemoryStore();
      const blocked = await submitReport(verifiedDraft(), { store, settings: site, submittedBy: 'Jo', targetNet: 250000, definitions: rec });
      expect(blocked).toMatchObject({ ok: false, code: 'blocked' });
      const ok = await submitReport(EodDraft.parse({ ...verifiedDraft(), extra: { 'pay.card': 290000 } }), { store, settings: site, submittedBy: 'Jo', targetNet: 250000, definitions: rec });
      expect(ok.ok).toBe(true);
      const stored = await store.get('BUN', '2026-10-05');
      expect(stored!.official!.calcVersion).toBe('definition-v2');
      expect(stored!.official!.definition!.figures.netAfter).toBe(263675);
    });
  });
});
