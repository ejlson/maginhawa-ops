import { describe, expect, it } from 'vitest';
import {
  dueDate, evaluate, EXAMPLE_TEMPLATES, ruleText, runKey, summariseRun, tasksForDay, taskStatus, validFix,
  type ChecklistRun, type Checkpoint,
} from '../src/checklists';

const today = '2026-10-05';
const opts = { dayCloseTime: '04:00', timezone: 'Europe/London' };
const opening = EXAMPLE_TEMPLATES.find((t) => t.id === 'opening')!;
const bar = EXAMPLE_TEMPLATES.find((t) => t.id === 'bar')!;
const cp = (over: Partial<Checkpoint>): Checkpoint => ({ id: 'x', title: 'X', type: 'yesno', required: true, ...over });
const run = (over: Partial<ChecklistRun> = {}): ChecklistRun => ({ key: 'k', templateId: 'opening', businessDate: today, dueTime: '09:30', answers: {}, fixes: {}, completedAt: null, completedBy: null, ...over });

describe('answers', () => {
  it('temperature: above the limit fails, at the limit passes', () => {
    const fridge = cp({ type: 'temp', max: 8 });
    expect(evaluate(fridge, 9.2, today)).toEqual({ answered: true, passed: false, reason: 'Too warm: 9.2°C' });
    expect(evaluate(fridge, 8, today).passed).toBe(true);
  });
  it('temperature: hot holding below the minimum fails', () => {
    expect(evaluate(cp({ type: 'temp', min: 63 }), 52, today)).toMatchObject({ passed: false, reason: 'Too cold: 52°C' });
  });
  it('freezer limits handle negatives', () => {
    const f = cp({ type: 'temp', max: -18 });
    expect(evaluate(f, -19, today).passed).toBe(true);
    expect(evaluate(f, -15, today)).toMatchObject({ passed: false, reason: 'Too warm: −15°C' });
  });
  it('number with an exact target', () => {
    const fl = cp({ type: 'number', min: 150, max: 150, unit: '£' });
    expect(evaluate(fl, 150, today).passed).toBe(true);
    expect(evaluate(fl, 140, today).passed).toBe(false);
  });
  it('yes/no fails on the chosen answer only', () => {
    const c = cp({ failOn: 'no' });
    expect(evaluate(c, true, today).passed).toBe(true);
    expect(evaluate(c, false, today)).toMatchObject({ passed: false, reason: 'Answered No' });
    expect(evaluate(cp({}), false, today).passed).toBeNull();
  });
  it('a use-by date in the past fails', () => {
    const d = cp({ type: 'date', failIfPast: true });
    expect(evaluate(d, '2026-10-04', today).passed).toBe(false);
    expect(evaluate(d, '2026-10-05', today).passed).toBe(true);
  });
  it('text, photo, choice and signature have no pass rule', () => {
    expect(evaluate(cp({ type: 'text' }), 'All good', today)).toMatchObject({ answered: true, passed: null });
    expect(evaluate(cp({ type: 'photo' }), ['data:image/jpeg;base64,x'], today).passed).toBeNull();
    expect(evaluate(cp({ type: 'choice' }), ['Limes'], today).passed).toBeNull();
  });
  it('blank is unanswered, never a fail', () => {
    for (const v of [null, undefined, '', []]) expect(evaluate(cp({ type: 'temp', max: 8 }), v as never, today)).toMatchObject({ answered: false, passed: null });
  });
  it('rule text in plain English', () => {
    expect(ruleText(cp({ type: 'temp', max: 8 }))).toBe('8°C or below');
    expect(ruleText(cp({ type: 'temp', min: 11, max: 13 }))).toBe('11°C to 13°C');
    expect(ruleText(cp({ type: 'number', min: 150, max: 150, unit: '£' }))).toBe('Should be 150 £');
    expect(ruleText(cp({ type: 'temp', max: -18 }))).toBe('−18°C or below');
  });
});

describe('finishing a checklist', () => {
  const allGood = { walkin: 4, reachin: 4, freezer: -19, seals: true, covered: true, basins: true, probe: true };
  it('can finish when everything required is answered and nothing failed', () => {
    expect(summariseRun(opening, run({ answers: allGood }), today)).toMatchObject({ answered: 7, requiredLeft: 0, unfixed: 0, canFinish: true });
  });
  it('cannot finish with required checks left', () => {
    expect(summariseRun(opening, run({ answers: { walkin: 4 } }), today)).toMatchObject({ requiredLeft: 6, canFinish: false });
  });
  it('a failure blocks finishing until it has a fix', () => {
    const r = run({ answers: { ...allGood, walkin: 9.2 } });
    expect(summariseRun(opening, r, today)).toMatchObject({ unfixed: 1, canFinish: false });
    r.fixes.walkin = { actions: ['Moved food to another fridge'], foodDisposed: false, note: '', recheckInMinutes: 30, reportFault: true, at: '' };
    expect(summariseRun(opening, r, today)).toMatchObject({ unfixed: 0, canFinish: true });
  });
  it('optional checks can be left blank', () => {
    const hot = EXAMPLE_TEMPLATES.find((t) => t.id === 'hothold')!;
    expect(summariseRun(hot, run({ answers: { pass: 70, bain: 68 } }), today).canFinish).toBe(true);
  });
  it('a fix needs at least one action and a re-check time', () => {
    expect(validFix({ actions: [], recheckInMinutes: 30 })).toBe(false);
    expect(validFix({ actions: ['Called the manager'], recheckInMinutes: 30 })).toBe(true);
  });
  it('the bar list uses all eight answer types', () => {
    expect(new Set(bar.checkpoints.map((c) => c.type)).size).toBe(8);
  });
});

describe('the day\'s schedule', () => {
  it('due times are site-local (BST in October)', () => {
    expect(dueDate(today, '09:30', '04:00', 'Europe/London').toISOString()).toBe('2026-10-05T08:30:00.000Z');
  });
  it('and GMT in winter', () => {
    expect(dueDate('2026-12-01', '09:30', '04:00', 'Europe/London').toISOString()).toBe('2026-12-01T09:30:00.000Z');
  });
  it('times after midnight belong to the trading day', () => {
    expect(dueDate(today, '01:00', '04:00', 'Europe/London').toISOString()).toBe('2026-10-06T00:00:00.000Z');
  });
  it('one task per due time, in time order, with anytime lists last', () => {
    const tasks = tasksForDay(EXAMPLE_TEMPLATES, [], today, opts);
    expect(tasks.map((t) => t.title)).toEqual([
      'Opening checks', 'Hot holding · 12:00', 'Hot holding · 15:00', 'Bar opening', 'Hot holding · 18:00', 'Closing checks', 'Delivery check',
    ]);
  });
  it('a fix adds a re-check task', () => {
    const recheck = run({ key: 'rc', templateId: 'opening', dueTime: null, recheckOf: { runKey: runKey('opening', today, '09:30'), checkpointId: 'walkin', dueAt: '2026-10-05T09:00:00.000Z' } });
    const parent = run({ key: runKey('opening', today, '09:30') });
    const tasks = tasksForDay(EXAMPLE_TEMPLATES, [parent, recheck], today, opts);
    expect(tasks.find((t) => t.key === 'rc')?.title).toBe('Re-check walk-in fridge');
  });
});

describe('task status through the day', () => {
  const task = tasksForDay([opening], [], today, opts)[0]!;
  const at = (iso: string) => new Date(iso);
  it('upcoming, then due 30 minutes before, then late, then missed after the window', () => {
    expect(taskStatus(task, undefined, at('2026-10-05T07:00:00Z'), opening, today)).toBe('upcoming');
    expect(taskStatus(task, undefined, at('2026-10-05T08:10:00Z'), opening, today)).toBe('due');
    expect(taskStatus(task, undefined, at('2026-10-05T08:45:00Z'), opening, today)).toBe('late');
    expect(taskStatus(task, undefined, at('2026-10-05T09:31:00Z'), opening, today)).toBe('missed');
  });
  it('done, or failed when something failed (even if fixed)', () => {
    const answers = { walkin: 4, reachin: 4, freezer: -19, seals: true, covered: true, basins: true, probe: true };
    expect(taskStatus(task, run({ answers, completedAt: 'x' }), at('2026-10-05T12:00:00Z'), opening, today)).toBe('done');
    expect(taskStatus(task, run({ answers: { ...answers, walkin: 9 }, completedAt: 'x' }), at('2026-10-05T12:00:00Z'), opening, today)).toBe('failed');
  });
  it('lists without a time are available any time', () => {
    const delivery = EXAMPLE_TEMPLATES.find((t) => t.id === 'delivery')!;
    const t = tasksForDay([delivery], [], today, opts)[0]!;
    expect(taskStatus(t, undefined, at('2026-10-05T12:00:00Z'), delivery, today)).toBe('anytime');
  });
});

describe('phases', () => {
  it('every example list belongs to opening, mid-shift or closing', () => {
    expect(EXAMPLE_TEMPLATES.map((t) => `${t.id}:${t.phase}`)).toEqual([
      'opening:opening', 'hothold:mid-shift', 'bar:mid-shift', 'closing:closing', 'delivery:mid-shift',
    ]);
  });
});
