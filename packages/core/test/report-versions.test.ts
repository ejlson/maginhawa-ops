import { describe, expect, it } from 'vitest';
import { computeDay } from '../src/calc';
import { EOD_DEFINITION, VERIFIED_TEST_DAY, addFigure, connect, renameFigure, updateFigure } from '../src/report-definition';
import {
  ReviewError, approveDefinition, publishDefinition, checkDraft, definitionOn, definitionStatus, discardDefinitionDraft, editableDefinition,
  inputsFromDraft, officialFigures, rejectDefinition, rollbackDefinition, saveDefinitionDraft, seedDefinitionRecord,
  submitDefinition, withdrawDefinition, type DefinitionRecord,
} from '../src/report-versions';
import { settings, verifiedDraft } from './fixtures';

const AT = '2026-11-02T10:00:00Z';
const seed = () => seedDefinitionRecord({ startsOn: '2026-10-01', by: 'Finance', at: AT });
const withDraft = (rec: DefinitionRecord, definition = EOD_DEFINITION, by = 'Ana') =>
  saveDefinitionDraft(rec, { definition, testDays: [VERIFIED_TEST_DAY], by, at: AT });
const addTips = () => {
  const d = addFigure(EOD_DEFINITION, { id: 'pay.card', name: 'Card takings', kind: 'input', type: 'money', group: 'payments' });
  return addFigure(d, { id: 'cardFees', name: 'Card fees', kind: 'calc', type: 'money', formula: '[Card takings] × 1.75%' });
};

describe('starting point', () => {
  it('is today’s rules as v1, live, with the verified test day', () => {
    const rec = seed();
    expect(rec.versions).toHaveLength(1);
    expect(definitionStatus(rec, '2026-11-02')).toBe('live');
    expect(checkDraft(rec.versions[0]!.definition, rec.versions[0]!.testDays).ok).toBe(true);
  });
});

describe('draft → approval → live', () => {
  it('saves a draft without touching the live version', () => {
    const rec = withDraft(seed(), addTips());
    expect(definitionStatus(rec, '2026-11-02')).toBe('draft');
    expect(definitionOn(rec, '2026-11-03')!.version).toBe(1);
    expect(editableDefinition(rec).definition.figures.some((f) => f.name === 'Card fees')).toBe(true);
  });
  it('discards a draft', () => {
    expect(discardDefinitionDraft(withDraft(seed(), addTips())).draft).toBeNull();
  });
  it('needs a summary and passing tests to send for approval', () => {
    const rec = withDraft(seed(), addTips());
    expect(() => submitDefinition(rec, { summary: ' ', by: 'Ana', at: AT })).toThrow('Say what changed');
    const broken = withDraft(seed(), updateFigure(EOD_DEFINITION, 'lunchNet', { formula: '[Lunch gross] −' }));
    expect(() => submitDefinition(broken, { summary: 'x', by: 'Ana', at: AT })).toThrow('Fix the formulas with problems first: Lunch net');
    const moved = withDraft(seed(), updateFigure(EOD_DEFINITION, 'lunchNet', { formula: '[Lunch gross] − [Lunch VAT] − [Lunch discounts]' }));
    expect(() => submitDefinition(moved, { summary: 'x', by: 'Ana', at: AT })).toThrow('5 tests failing');
    expect(() => submitDefinition(seed(), { summary: 'x', by: 'Ana', at: AT })).toThrow('no changes');
    const noTests = saveDefinitionDraft(seed(), { definition: EOD_DEFINITION, testDays: [], by: 'Ana', at: AT });
    expect(() => submitDefinition(noTests, { summary: 'x', by: 'Ana', at: AT })).toThrow('at least one test day');
  });
  it('locks the draft while it waits, and only the drafter can withdraw it', () => {
    const rec = submitDefinition(withDraft(seed(), addTips()), { summary: 'Card fees', by: 'Ana', at: AT });
    expect(definitionStatus(rec, '2026-11-02')).toBe('waiting');
    expect(() => withDraft(rec)).toThrow('waiting for approval');
    expect(() => withdrawDefinition(rec, { by: 'Ben' })).toThrow('Only Ana');
    const back = withdrawDefinition(rec, { by: 'Ana' });
    expect(back.pending).toBeNull();
    expect(back.draft!.definition.figures.some((f) => f.name === 'Card fees')).toBe(true);
  });
  it('whoever made the change can approve it; no second person is needed', () => {
    const rec = submitDefinition(withDraft(seed(), addTips()), { summary: 'Card fees', by: 'Ana', at: AT });
    const done = approveDefinition(rec, { by: 'Ana', today: '2026-11-02', at: AT });
    expect(done.versions.at(-1)).toMatchObject({ version: 2, draftedBy: 'Ana', approvedBy: 'Ana', startsOn: '2026-11-03' });
  });
  it('publishes a draft in one step, live from the next trading day', () => {
    const rec = publishDefinition(withDraft(seed(), addTips()), { summary: 'Card fees', by: 'Ana', today: '2026-11-02', at: AT });
    expect(rec).toMatchObject({ draft: null, pending: null });
    expect(rec.versions.at(-1)).toMatchObject({ version: 2, startsOn: '2026-11-03', summary: 'Card fees', draftedBy: 'Ana', approvedBy: 'Ana' });
    expect(definitionOn(rec, '2026-11-02')!.version).toBe(1);
    expect(definitionOn(rec, '2026-11-03')!.version).toBe(2);
  });
  it('publishing still needs a summary and passing tests, and nothing to publish is refused', () => {
    expect(() => publishDefinition(withDraft(seed(), addTips()), { summary: '', by: 'Ana', today: '2026-11-02', at: AT })).toThrow('Say what changed');
    const moved = withDraft(seed(), updateFigure(EOD_DEFINITION, 'lunchNet', { formula: '[Lunch gross] − [Lunch VAT] − [Lunch discounts]' }));
    expect(() => publishDefinition(moved, { summary: 'x', by: 'Ana', today: '2026-11-02', at: AT })).toThrow(/tests failing/);
    const broken = withDraft(seed(), updateFigure(EOD_DEFINITION, 'lunchNet', { formula: '[Lunch gross] −' }));
    expect(() => publishDefinition(broken, { summary: 'x', by: 'Ana', today: '2026-11-02', at: AT })).toThrow('Fix the formulas with problems first');
    expect(() => publishDefinition(seed(), { summary: 'x', by: 'Ana', today: '2026-11-02', at: AT })).toThrow('no changes');
  });
  it('goes live on the next trading day, and the day before keeps the old version', () => {
    const rec = approveDefinition(submitDefinition(withDraft(seed(), addTips()), { summary: 'Card fees', by: 'Ana', at: AT }), { by: 'Ben', today: '2026-11-02', at: AT });
    expect(rec.versions.at(-1)).toMatchObject({ version: 2, startsOn: '2026-11-03', draftedBy: 'Ana', approvedBy: 'Ben', summary: 'Card fees' });
    expect(definitionStatus(rec, '2026-11-02')).toBe('starts-tomorrow');
    expect(definitionOn(rec, '2026-11-02')!.version).toBe(1);
    expect(definitionOn(rec, '2026-11-03')!.version).toBe(2);
    expect(definitionOn(rec, '2026-09-30')).toBeNull();
  });
  it('can be turned down with a reason, which sends it back as a draft', () => {
    const rec = submitDefinition(withDraft(seed(), addTips()), { summary: 'Card fees', by: 'Ana', at: AT });
    expect(() => rejectDefinition(rec, { by: 'Ben', reason: '', at: AT })).toThrow('Say why');
    expect(() => rejectDefinition(rec, { by: 'Ana', reason: 'x', at: AT })).toThrow('Withdraw your own');
    const back = rejectDefinition(rec, { by: 'Ben', reason: 'Use 1.5%', at: AT });
    expect(back).toMatchObject({ pending: null, rejected: { by: 'Ben', reason: 'Use 1.5%' } });
    expect(back.draft).not.toBeNull();
  });
  it('rolls back as a new version, keeping history', () => {
    const v2 = approveDefinition(submitDefinition(withDraft(seed(), addTips()), { summary: 'Card fees', by: 'Ana', at: AT }), { by: 'Ben', today: '2026-11-02', at: AT });
    expect(() => rollbackDefinition(v2, { to: 2, by: 'Ben', reason: 'x', today: '2026-11-05', at: AT })).toThrow('already the newest');
    expect(() => rollbackDefinition(v2, { to: 9, by: 'Ben', reason: 'x', today: '2026-11-05', at: AT })).toThrow('no v9');
    const v3 = rollbackDefinition(v2, { to: 1, by: 'Ben', reason: 'Fees were wrong', today: '2026-11-05', at: AT });
    expect(v3.versions).toHaveLength(3);
    expect(v3.versions[2]).toMatchObject({ version: 3, startsOn: '2026-11-06', summary: 'Back to v1: Fees were wrong' });
    expect(v3.versions[2]!.definition.figures).toEqual(EOD_DEFINITION.figures);
  });
  it('throws ReviewError for rule breaks, so the server can return 422', () => {
    expect(() => approveDefinition(seed(), { by: 'Ben', today: '2026-11-02', at: AT })).toThrow(ReviewError);
  });
});

describe('official figures for a submitted EOD', () => {
  it('match every figure computeDay works out, on the verified example', () => {
    const d = verifiedDraft();
    const day = computeDay(d, settings, { netSales: 250000 });
    const f = officialFigures(seed(), d, settings, {}, 250000);
    expect(f.errors).toEqual({});
    expect(f.version).toBe(1);
    for (const k of ['lunch', 'dinner'] as const) {
      const s = day.sessions[k];
      expect(f.byId[`${k}Net`]).toBe(s.net);
      expect(f.byId[`${k}Covers`]).toBe(s.covers);
      expect(f.byId[`${k}Head`]).toBe(s.perHead);
      expect(Math.round(f.byId[`${k}FoodPct`]! * 1000) / 10).toBe(s.foodDrink.foodPct);
      expect(Math.round(f.byId[`${k}DrinkPct`]! * 1000) / 10).toBe(s.foodDrink.drinkPct);
      expect(f.byId[`${k}CashTaken`]).toBe(s.cash.taken);
      expect(f.byId[`${k}CashDiff`]).toBe(s.cash.difference);
      expect(f.byId[`${k}FoodDrinkCheck`]).toBe(s.foodDrink.matches ? 0 : 1);
      expect(f.byId[`${k}CashCheck`]).toBe(s.cash.status === 'balanced' ? 0 : 1);
    }
    expect(f.byId.delNet).toBe(day.delivery.find((x) => x.platformId === 'deliveroo')!.net);
    expect(f.byId.dineInNet).toBe(day.dineInNet);
    expect(f.byId.deliveryNet).toBe(day.deliveryNet);
    expect(f.byId.dayNet).toBe(day.totalNet);
    expect(f.byId.dayGross).toBe(day.totalGross);
    expect(f.byId.covers).toBe(day.covers);
    expect(f.byId.headNet).toBe(day.perHeadDineIn);
    expect(Math.round(f.byId.wagePct! * 1000) / 10).toBe(day.wagePct);
    expect(f.byId.tipsTotal).toBe(day.tips);
    expect(f.byId.vsTarget).toBe(day.netVsTarget);
    expect(f.byId.check).toBe(day.wageRag === 'red' ? 1 : 0);
    expect(f.byId.amber).toBe(day.wageRag === 'green' ? 0 : 1);
  });
  it('match computeDay when the cash is short and food and drink don’t add up', () => {
    const d = verifiedDraft();
    d.sessions.lunch.cash.tillCash = 24000;
    d.sessions.dinner.food = 100000;
    const day = computeDay(d, settings);
    const f = officialFigures(seed(), d, settings);
    expect(f.byId.lunchCashDiff).toBe(day.sessions.lunch.cash.difference);
    expect(f.byId.lunchCashCheck).toBe(1);
    expect(f.byId.cashCheck).toBe(1);
    expect(f.byId.dinnerFoodDrinkCheck).toBe(day.sessions.dinner.foodDrink.matches ? 0 : 1);
  });
  it('match computeDay with wages in the amber and red bands', () => {
    for (const cost of [81000, 95000]) {
      const d = verifiedDraft(); d.wages.wageCost = cost;
      const day = computeDay(d, settings);
      const f = officialFigures(seed(), d, settings);
      expect([f.byId.amber, f.byId.check]).toEqual([day.wageRag === 'green' ? 0 : 1, day.wageRag === 'red' ? 1 : 0]);
    }
  });
  it('match computeDay when a service didn’t run or delivery didn’t trade', () => {
    const d = verifiedDraft();
    d.ran.lunch = false;
    d.ran.delivery = false;
    expect(officialFigures(seed(), d, settings).byId.dayNet).toBe(computeDay(d, settings).totalNet);
  });
  it('still work after finance rename the built-in figures', () => {
    let def = renameFigure(EOD_DEFINITION, 'lunch.gross', 'Lunch sales');
    def = renameFigure(def, 'dayNet', 'Net sales');
    const rec = approveDefinition(submitDefinition(withDraft(seed(), def), { summary: 'Names', by: 'Ana', at: AT }), { by: 'Ben', today: '2026-10-01', at: AT });
    const d = verifiedDraft(); d.businessDate = '2026-10-05';
    expect(officialFigures(rec, d, settings)).toMatchObject({ version: 2, byId: { dayNet: 268750 } });
  });
  it('use the extra inputs finance added', () => {
    let def = addTips();
    def = addFigure(def, { id: 'netAfter', name: 'Net after card fees', kind: 'calc', type: 'money', formula: '[Day total net] − [Card fees]' });
    def = connect(def, 'Net after card fees', 'email');
    const rec = approveDefinition(submitDefinition(withDraft(seed(), def), { summary: 'Fees', by: 'Ana', at: AT }), { by: 'Ben', today: '2026-10-01', at: AT });
    const f = officialFigures(rec, verifiedDraft(), settings, { 'pay.card': 290000 });
    expect(f.byId.cardFees).toBe(5075);
    expect(f.byId.netAfter).toBe(263675);
  });
  it('treat a missing extra input as zero, not an error', () => {
    const inputs = inputsFromDraft(addTips(), verifiedDraft(), settings);
    expect(inputs['Card takings']).toBeNull();
  });
  it('use the version for the report’s own trading day', () => {
    const rec = approveDefinition(submitDefinition(withDraft(seed(), addTips()), { summary: 'Fees', by: 'Ana', at: AT }), { by: 'Ben', today: '2026-11-02', at: AT });
    const d = verifiedDraft(); // trading day 2026-10-05, before v2 starts
    expect(officialFigures(rec, d, settings).version).toBe(1);
    d.businessDate = '2026-09-01';
    expect(() => officialFigures(rec, d, settings)).toThrow('no report version for 2026-09-01');
  });
});
