import { describe, expect, it } from 'vitest';
import { buildTimeline, checklistEvents, dayBounds, eodEvents, repairEvents, type Repair, type TimelineTask } from '../src';

// Example day only. 27 Oct 2026 is after the clocks go back, so London is on GMT (UTC+0).
const TZ = 'Europe/London';
const bounds = dayBounds('2026-10-27', '04:00', TZ);
const NOW = new Date('2026-10-27T15:30:00Z');
const run = (over: Partial<NonNullable<TimelineTask['run']>> = {}): NonNullable<TimelineTask['run']> => ({
  key: 'k', templateId: 't', businessDate: '2026-10-27', dueTime: null, answers: {}, fixes: {}, completedAt: null, completedBy: null, ...over,
});

const tasks: TimelineTask[] = [
  { key: 'open', title: 'Opening checks', dueAt: new Date('2026-10-27T09:00:00Z'), status: 'done', run: run({ completedAt: '2026-10-27T09:12:00Z', completedBy: 'Sam' }) },
  {
    key: 'hot12', title: 'Hot holding · 12:00', dueAt: new Date('2026-10-27T12:00:00Z'), status: 'failed',
    template: { checkpoints: [{ id: 'c1', title: 'Curry above 63°C', type: 'temp', required: true }] },
    run: run({ completedAt: '2026-10-27T12:20:00Z', completedBy: 'Jo', answeredBy: { c1: { by: 'Jo', at: '2026-10-27T12:05:00Z' } },
      fixes: { c1: { actions: ['Reheated to 75°C'], foodDisposed: false, note: '', recheckInMinutes: 30, reportFault: false, at: '2026-10-27T12:06:00Z' } } }),
  },
  { key: 'temps', title: 'Fridge temps', dueAt: new Date('2026-10-27T10:00:00Z'), status: 'missed' },
  { key: 'close', title: 'Closing checks', dueAt: new Date('2026-10-27T23:00:00Z'), status: 'upcoming' },
];
const repairs: Repair[] = [
  { id: 'r1', siteCode: 'BUN', title: 'Freezer door seal', place: 'Kitchen', note: '', urgent: true, reportedBy: 'Sam', reportedAt: '2026-10-27T10:40:00Z', fixedAt: '2026-10-27T14:00:00Z', fixedBy: 'Ana' },
  { id: 'r2', siteCode: 'BUN', title: 'Yesterday’s tap', place: 'Bar', note: '', urgent: false, reportedBy: 'Sam', reportedAt: '2026-10-26T18:00:00Z', fixedAt: null, fixedBy: null },
];

describe('day timeline', () => {
  it('runs from day-close to day-close in local hours', () => {
    expect(bounds.start.toISOString()).toBe('2026-10-27T04:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-10-28T04:00:00.000Z');
    const t = buildTimeline([], bounds, NOW, TZ);
    expect(t.hours).toHaveLength(24);
    expect(t.hours[0]!.label).toBe('04:00');
    expect(t.hours[11]).toMatchObject({ label: '15:00', current: true, past: false });
    expect(t.hours[10]!.past).toBe(true);
  });

  it('turns checklists into done, failed with fixes, missed and coming up', () => {
    const ev = checklistEvents(tasks, (k) => `/checklists/${k}`);
    expect(ev.find((e) => e.title === 'Opening checks')).toMatchObject({ kind: 'checklist', tone: 'ok', by: 'Sam', at: '2026-10-27T09:12:00Z' });
    expect(ev.find((e) => e.title === 'Hot holding · 12:00')).toMatchObject({ tone: 'warn', detail: 'Done with 1 fix' });
    expect(ev.find((e) => e.kind === 'fix')).toMatchObject({ title: 'Curry above 63°C failed', by: 'Jo', detail: 'Reheated to 75°C · re-check in 30 min' });
    expect(ev.find((e) => e.kind === 'missed')).toMatchObject({ title: 'Fridge temps', tone: 'bad', at: '2026-10-27T10:00:00.000Z' });
    expect(ev.find((e) => e.title === 'Closing checks')).toMatchObject({ kind: 'due', tone: 'mut' });
  });

  it('keeps only repairs reported or fixed during the day', () => {
    const ev = repairEvents(repairs, bounds.start, bounds.end);
    expect(ev.map((e) => `${e.kind}:${e.title}`)).toEqual(['repair:Freezer door seal', 'fixed:Freezer door seal']);
    expect(ev[0]!.tone).toBe('bad');
  });

  it('shows EOD section changes and the send', () => {
    const ev = eodEvents({ status: 'submitted', submittedAt: '2026-10-28T00:10:00Z', submittedBy: 'Ana', sections: { lunch: { by: 'Ana', at: '2026-10-27T16:00:00Z' } } });
    expect(ev.map((e) => e.title)).toEqual(['EOD · Lunch', 'EOD sent to head office']);
    expect(eodEvents(null)).toEqual([]);
  });

  it('puts events in their hour, sorted, with counts, and filters by kind', () => {
    const all = [...checklistEvents(tasks, (k) => k), ...repairEvents(repairs, bounds.start, bounds.end), ...eodEvents({ status: 'submitted', submittedAt: '2026-10-28T00:10:00Z', submittedBy: 'Ana', sections: {} })];
    const t = buildTimeline(all, bounds, NOW, TZ);
    const noon = t.hours.find((h) => h.label === '12:00')!;
    expect(noon.events.map((e) => e.kind)).toEqual(['fix', 'checklist']);
    expect(t.hours.find((h) => h.label === '00:00')!.events[0]!.title).toBe('EOD sent to head office');
    expect(t).toMatchObject({ done: 2, missed: 1, fixes: 1, repairs: 1 });
    const rep = buildTimeline(all, bounds, NOW, TZ, 'repairs');
    expect(rep.hours.flatMap((h) => h.events).map((e) => e.kind)).toEqual(['repair', 'fixed']);
  });
});
