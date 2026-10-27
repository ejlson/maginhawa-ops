import { describe, expect, it } from 'vitest';
import {
  alertMatches, allergenChange, backToWorkAt, batchMatches, calibrationResult, certStatus, changeText, complaintForInspector, complaintProblem,
  coolingStatus, coreTempResult, correctionProblem, currentRating, DEFAULT_KEEP, deliveryProblems, dueToClear, fridgeBand, hasRead, keepText,
  keepUntil, nextVersion, noticeDeadlines, packRange, probeStatus, readCount, repeatFaults, reviewDue, usableProbe, validRange,
  type Complaint, type Delivery, type Dish, type DishVersion, type Notice,
} from '../src/food-safety';
import { EXAMPLE_TEMPLATES, type ChecklistRun } from '../src/checklists';
import { buildRuns, MemoryChecklistStore, type RunStart } from '../src/checklist-sync';
import { ChecklistSyncClient } from '../src/checklist-client';

const today = '2026-10-27';

describe('1 · corrections to a finished checklist', () => {
  const run: RunStart = { key: '2026-10-27|opening|09:30', templateId: 'opening', businessDate: today, dueTime: '09:30' };
  const serverNow = new Date('2026-10-27T09:05:00Z');

  async function finished() {
    const store = new MemoryChecklistStore(() => serverNow);
    await store.apply('BUN', [
      { kind: 'answer', run, checkpointId: 'freezer', value: -1.9, by: 'Maria', at: '2026-10-27T08:40:00Z' },
      { kind: 'finish', run, by: 'Maria', at: '2026-10-27T08:42:00Z' },
    ]);
    return store;
  }

  it('needs a different value and a reason', () => {
    expect(correctionProblem({ previous: -1.9, value: -19, reason: 'Typed the decimal in the wrong place' })).toBeNull();
    expect(correctionProblem({ previous: -1.9, value: -1.9, reason: 'Typo here' })).toMatch(/same/);
    expect(correctionProblem({ previous: -1.9, value: -19, reason: ' ' })).toMatch(/why/);
    expect(correctionProblem({ previous: -1.9, value: null, reason: 'Typo here' })).toMatch(/right answer/);
  });

  it('a normal answer still cannot change a finished run', async () => {
    const store = await finished();
    const [out] = await store.apply('BUN', [{ kind: 'answer', run, checkpointId: 'freezer', value: -19, by: 'Jun', at: '2026-10-27T09:00:00Z' }]);
    expect(out).toMatchObject({ ok: false, reason: 'finished' });
  });

  it('a correction keeps the old answer, the reason, who and the server time', async () => {
    const store = await finished();
    // The device says 07:00 (wrong clock): the record uses the server's 09:05.
    const [out] = await store.apply('BUN', [{ kind: 'correct', run, checkpointId: 'freezer', value: -19, reason: 'Typed the decimal in the wrong place', by: 'Jun', at: '2026-10-27T07:00:00Z' }]);
    expect(out!.ok).toBe(true);
    const c = store.changesNow('BUN', today, 0);
    const built = buildRuns(c.runs, c.answers)[run.key]!;
    expect(built.answers.freezer).toBe(-19);
    expect(built.answeredBy!.freezer).toEqual({ by: 'Maria', at: '2026-10-27T08:40:00Z' });
    expect(built.corrections!.freezer).toEqual([{ previous: -1.9, value: -19, reason: 'Typed the decimal in the wrong place', by: 'Jun', at: '2026-10-27T09:05:00.000Z' }]);
    expect(built.completedBy).toBe('Maria');
  });

  it('a correction is refused before the run is finished, or without a reason', async () => {
    const store = new MemoryChecklistStore(() => serverNow);
    await store.apply('BUN', [{ kind: 'answer', run, checkpointId: 'freezer', value: -1.9, by: 'Maria', at: '2026-10-27T08:40:00Z' }]);
    const [early] = await store.apply('BUN', [{ kind: 'correct', run, checkpointId: 'freezer', value: -19, reason: 'Typed it wrong', by: 'Jun', at: '' }]);
    expect(early).toMatchObject({ ok: false, reason: 'not-finished' });
    const done = await finished();
    const [blank] = await done.apply('BUN', [{ kind: 'correct', run, checkpointId: 'freezer', value: -19, reason: '', by: 'Jun', at: '' }]);
    expect(blank).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('the device shows the correction straight away and keeps the history', async () => {
    const store = await finished();
    const client = new ChecklistSyncClient({ backend: store, siteCode: 'BUN', businessDate: today, user: 'Jun', deviceId: 'ipad', now: () => serverNow });
    await client.refresh();
    await client.correct(run, 'freezer', -19, 'Typed the decimal in the wrong place');
    const r = client.getState().runs[run.key]!;
    expect(r.answers.freezer).toBe(-19);
    expect(r.corrections!.freezer).toHaveLength(1);
    expect(r.corrections!.freezer![0]).toMatchObject({ previous: -1.9, by: 'Jun' });
  });
});

describe('2 · records for an inspector', () => {
  it('date presets end today and include it', () => {
    expect(packRange('4w', today)).toEqual({ from: '2026-09-30', to: today });
    expect(packRange('3m', today).from).toBe('2026-07-29');
  });
  it('checks a custom range', () => {
    expect(validRange({ from: '2026-10-01', to: today }, today)).toBeNull();
    expect(validRange({ from: '2026-10-10', to: '2026-10-01' }, today)).toMatch(/after/);
    expect(validRange({ from: '2026-10-01', to: '2026-11-01' }, today)).toMatch(/future/);
    expect(validRange({ from: '', to: today }, today)).toMatch(/both/);
  });
});

describe('3 · how long records are kept', () => {
  it('counts months from the record, or from leaving for training', () => {
    expect(keepUntil('checks', '2024-02-29', DEFAULT_KEEP)).toBe('2026-02-28');
    expect(keepUntil('training', '2020-01-01', DEFAULT_KEEP, null)).toBeNull();
    expect(keepUntil('training', '2020-01-01', DEFAULT_KEEP, '2025-06-30')).toBe('2027-06-30');
    expect(keepUntil('fitness', '2026-03-01', DEFAULT_KEEP)).toBe('2026-09-01');
  });
  it('lists records past their date, never ones still needed', () => {
    const records = [
      { id: 'a', type: 'checks' as const, date: '2024-10-01' },
      { id: 'b', type: 'checks' as const, date: '2025-10-01' },
      { id: 'c', type: 'fitness' as const, date: '2026-03-01' },
      { id: 'd', type: 'training' as const, date: '2019-01-01', leftOn: null },
    ];
    expect(dueToClear(records, DEFAULT_KEEP, today).map((r) => r.id)).toEqual(['a', 'c']);
  });
  it('says periods in words', () => {
    expect(keepText({ months: 24 })).toBe('2 years');
    expect(keepText({ months: 12 })).toBe('1 year');
    expect(keepText({ months: 6 })).toBe('6 months');
    expect(keepText({ months: 24, fromLeaving: true })).toBe('Leaves + 2 years');
  });
});

describe('4 · allergens', () => {
  const v1: DishVersion = { version: 1, allergens: ['Cereals with gluten', 'Soya'], note: '', by: 'Chef', at: '2026-09-02T10:00:00Z' };
  const dish: Dish = { id: 'adobo', name: 'Pork adobo', course: 'Mains', siteCode: null, versions: [v1], readBy: { Maria: 1, Jun: 1 } };

  it('a change needs a reason and becomes a new version in the standard order', () => {
    expect(nextVersion(dish, ['Soya', 'Cereals with gluten'], '', 'Chef', 'x')).toBe('Nothing has changed.');
    expect(nextVersion(dish, ['Soya', 'Cereals with gluten', 'Sulphites'], '', 'Chef', 'x')).toMatch(/why/);
    const v2 = nextVersion(dish, ['Sulphites', 'Soya', 'Cereals with gluten'], 'New vinegar supplier', 'Chef', '2026-10-21T10:00:00Z');
    expect(v2).toMatchObject({ version: 2, allergens: ['Cereals with gluten', 'Soya', 'Sulphites'] });
  });

  it('a new dish needs no reason', () => {
    expect(nextVersion({ versions: [] }, ['Milk'], '', 'Chef', 'x')).toMatchObject({ version: 1, allergens: ['Milk'] });
  });

  it('describes the change and who still needs to read it', () => {
    expect(changeText(allergenChange(['Milk', 'Soya'], ['Soya', 'Eggs']))).toBe('Removed milk, added eggs');
    const after: Dish = { ...dish, versions: [v1, { ...v1, version: 2, allergens: [...v1.allergens, 'Sulphites'] }] };
    expect(hasRead(after, 'Maria')).toBe(false);
    expect(readCount({ ...after, readBy: { Maria: 2, Jun: 1 } }, ['Maria', 'Jun', 'Sam'])).toBe(1);
  });
});

describe('5 · cooking, cooling and fridges', () => {
  it('core temperature must reach 75°C', () => {
    expect(coreTempResult(76.4).safe).toBe(true);
    expect(coreTempResult(75).safe).toBe(true);
    expect(coreTempResult(72).text).toMatch(/Too low/);
  });
  it('fridges warn above 5°C and fail above 8°C', () => {
    expect([fridgeBand(4), fridgeBand(5), fridgeBand(6), fridgeBand(8), fridgeBand(8.1)]).toEqual(['ok', 'ok', 'warn', 'warn', 'fail']);
  });
  it('cooling has 90 minutes to reach the fridge', () => {
    const start = '2026-10-27T11:20:00Z';
    expect(coolingStatus(start, new Date('2026-10-27T12:18:00Z'))).toMatchObject({ state: 'cooling', minutesLeft: 32, dueAt: '2026-10-27T12:50:00.000Z' });
    expect(coolingStatus(start, new Date('2026-10-27T13:00:00Z')).state).toBe('late');
    expect(coolingStatus(start, new Date(), '2026-10-27T12:40:00Z').state).toBe('done');
    expect(coolingStatus(start, new Date(), '2026-10-27T12:55:00Z').state).toBe('done-late');
  });
});

describe('6 · probe calibration', () => {
  it('iced water −1 to 1°C and boiling water 99 to 101°C', () => {
    expect(calibrationResult(0.3, 99.6).passed).toBe(true);
    expect(calibrationResult(2.4, 100)).toEqual({ passed: false, iceOk: false, boilOk: true });
    expect(calibrationResult(-1, 101).passed).toBe(true);
    expect(calibrationResult(Number.NaN, 100).passed).toBe(false);
  });
  it('a pass lasts a week; a fail takes the probe out of use', () => {
    const pass = { date: '2026-10-20', ice: 0.3, boil: 99.6, by: 'Maria' };
    expect(probeStatus({ calibrations: [] }, today).state).toBe('never');
    expect(probeStatus({ calibrations: [pass] }, '2026-10-26').state).toBe('ok');
    expect(probeStatus({ calibrations: [pass] }, today)).toMatchObject({ state: 'due', dueOn: today });
    const fail = { date: '2026-10-22', ice: 2.4, boil: 100, by: 'Maria' };
    expect(probeStatus({ calibrations: [pass, fail] }, today).state).toBe('failed');
    expect(usableProbe({ calibrations: [pass, fail] }, today)).toBe(false);
    expect(usableProbe({ calibrations: [fail, { ...pass, date: '2026-10-23' }] }, today)).toBe(true);
  });
});

describe('7 · deliveries and recalls', () => {
  const delivery: Delivery = {
    id: 'd1', siteCode: 'BUN', supplier: 'Brakes', receivedAt: '2026-10-27T06:42:00Z', receivedBy: 'Maria', chilledC: 4.2, packagingOk: true, rejected: [],
    items: [{ name: 'Chicken thighs', batch: 'L2611', useBy: '2026-10-31' }, { name: 'Coconut milk', batch: 'CM-4471', useBy: '2027-03-01' }],
  };
  it('matches exact codes and ranges with the same prefix', () => {
    expect(batchMatches('cm-4471', 'CM-4460 to CM-4479')).toBe(true);
    expect(batchMatches('CM-4480', 'CM-4460 to CM-4479')).toBe(false);
    expect(batchMatches('XX-4471', 'CM-4460 to CM-4479')).toBe(false);
    expect(batchMatches('L2611', 'L2611')).toBe(true);
  });
  it('finds received items an alert covers', () => {
    const m = alertMatches({ batches: ['CM-4460 to CM-4479'] }, [delivery]);
    expect(m.map((x) => x.item.name)).toEqual(['Coconut milk']);
  });
  it('flags unapproved suppliers, warm goods, damage, missing batches and past dates', () => {
    expect(deliveryProblems(delivery, ['Brakes'], today)).toEqual([]);
    const bad = { ...delivery, supplier: 'Market stall', chilledC: 9, packagingOk: false, items: [{ name: 'Prawns', batch: '', useBy: '2026-10-26' }] };
    expect(deliveryProblems(bad, ['Brakes'], today)).toEqual([
      "Market stall isn't on the approved list", 'Chilled goods too warm: 9°C', 'Packaging damaged', 'Prawns has no batch code', 'Prawns is past its use-by date',
    ]);
  });
});

describe('8 · complaints', () => {
  const base = { kind: 'Foreign body', details: 'Blue plastic in the soup', actions: ['Refunded'], contactConsent: false, customerContact: '' };
  it('needs what happened, details and an action; contact only with consent', () => {
    expect(complaintProblem(base)).toBeNull();
    expect(complaintProblem({ ...base, kind: '' })).toMatch(/what happened/);
    expect(complaintProblem({ ...base, actions: [] })).toMatch(/did/);
    expect(complaintProblem({ ...base, customerContact: '07700 900000' })).toMatch(/yes/);
    expect(complaintProblem({ ...base, customerContact: '07700 900000', contactConsent: true })).toBeNull();
  });
  it("an inspector's pack never includes the customer's details", () => {
    const c: Complaint = { id: 'c', siteCode: 'BUN', at: '', kind: 'Foreign body', dish: 'Sinigang', batch: 'Pot 2', details: '', photos: 2, itemKept: true, actions: [], customerContact: '07700 900000', by: 'Jun' };
    expect(complaintForInspector(c)).not.toHaveProperty('customerContact');
  });
});

describe('9 · training and fitness to work', () => {
  it('certificates: missing, expired, expiring within 30 days, fine', () => {
    expect(certStatus(undefined, today).state).toBe('missing');
    expect(certStatus({ expires: '2026-10-03' }, today)).toEqual({ state: 'expired', days: -24 });
    expect(certStatus({ expires: '2026-11-14' }, today)).toEqual({ state: 'expiring', days: 18 });
    expect(certStatus({ expires: '2027-06-01' }, today).state).toBe('ok');
  });
  it('off until 48 hours after symptoms stop', () => {
    const now = new Date('2026-10-27T08:55:00Z');
    expect(backToWorkAt({ person: 'Rico', at: '', ill: false, stoppedAt: null }, now)).toBeNull();
    expect(backToWorkAt({ person: 'Rico', at: '', ill: true, stoppedAt: '2026-10-27T06:00:00Z' }, now)!.toISOString()).toBe('2026-10-29T06:00:00.000Z');
    expect(backToWorkAt({ person: 'Rico', at: '', ill: true, stoppedAt: null }, now)!.toISOString()).toBe('2026-10-29T08:55:00.000Z');
    expect(backToWorkAt({ person: 'Rico', at: '', ill: true, stoppedAt: '2026-10-24T06:00:00Z' }, now)).toBeNull();
  });
});

describe('10 · inspections and notices', () => {
  const n: Notice = { id: 'n', kind: 'Improvement notice', title: 'Hand-wash basin', servedOn: '2026-10-01', fixBy: '2026-11-15', appealBy: '2026-10-30', closedOn: null };
  it('counts days and reminds 7 days before a deadline', () => {
    expect(noticeDeadlines(n, today)).toEqual({ fixDays: 19, appealDays: 3, remind: true, overdue: false });
    expect(noticeDeadlines({ ...n, appealBy: null }, today).remind).toBe(false);
    expect(noticeDeadlines(n, '2026-11-16').overdue).toBe(true);
    expect(noticeDeadlines({ ...n, closedOn: '2026-11-02' }, '2026-11-16')).toMatchObject({ overdue: false, remind: false });
  });
  it('the rating is the latest rated visit', () => {
    expect(currentRating({ visits: [
      { id: 'a', date: '2024-02-04', who: 'Environmental health', rating: 5, outcome: '' },
      { id: 'b', date: '2026-03-12', who: 'Environmental health', rating: 4, outcome: '' },
      { id: 'c', date: '2026-05-08', who: 'Trading standards', rating: null, outcome: '' },
    ] })?.rating).toBe(4);
  });
});

describe('11 · 4-weekly review', () => {
  const run = (date: string, walkin: number): ChecklistRun => ({
    key: `${date}|opening|09:30`, templateId: 'opening', businessDate: date, dueTime: '09:30', answers: { walkin }, fixes: {}, completedAt: 'x', completedBy: 'x',
  });
  it('finds a check failing 3 or more times in the last 7 days', () => {
    const runs = [run('2026-10-21', 9), run('2026-10-23', 3), run('2026-10-24', 9.5), run('2026-10-26', 8.4), run('2026-10-10', 10)];
    expect(repeatFaults(runs, EXAMPLE_TEMPLATES, today)).toEqual([
      { templateId: 'opening', checkpointId: 'walkin', title: 'Walk-in fridge', count: 3, dates: ['2026-10-21', '2026-10-24', '2026-10-26'] },
    ]);
    expect(repeatFaults(runs.slice(1), EXAMPLE_TEMPLATES, today)).toEqual([]);
  });
  it('is due every 28 days', () => {
    expect(reviewDue(undefined, today)).toBe(true);
    expect(reviewDue({ on: '2026-10-01' }, today)).toBe(false);
    expect(reviewDue({ on: '2026-09-29' }, today)).toBe(true);
  });
});
