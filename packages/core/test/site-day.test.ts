import { describe, expect, it } from 'vitest';
import { eodDueText, lastSevenDays, openRepairs, repairIssues, reportedText, whoDidWhat, type Repair } from '../src/site-day';
import type { TradingDayRow } from '../src/trends';

const row = (date: string, net: number, over: Partial<TradingDayRow> = {}): TradingDayRow => ({
  siteCode: 'BUN', date, net: { lunch: net / 2, dinner: net / 2, delivery: 0 }, covers: { lunch: 20, dinner: 30 }, wages: net * 0.3, cashDiff: 0, ...over,
});

describe('who did what', () => {
  it('groups finished checklists by person, busiest first, in time order', () => {
    const out = whoDidWhat([
      { title: 'Hot holding · 15:00', completedAt: '2026-10-27T14:04:00Z', completedBy: 'Sam' },
      { title: 'Bar opening', completedAt: '2026-10-27T15:31:00Z', completedBy: 'Alex' },
      { title: 'Opening checks', completedAt: '2026-10-27T08:42:00Z', completedBy: 'Sam' },
    ]);
    expect(out.map((p) => [p.name, p.items.map((i) => i.title)])).toEqual([
      ['Sam', ['Opening checks', 'Hot holding · 15:00']],
      ['Alex', ['Bar opening']],
    ]);
  });
});

describe('the last seven days', () => {
  // Example figures in pence.
  const rows = [
    ...Array.from({ length: 7 }, (_, i) => row(`2026-10-${String(13 + i).padStart(2, '0')}`, 200000)),
    ...Array.from({ length: 7 }, (_, i) => row(`2026-10-${String(20 + i).padStart(2, '0')}`, 220000)),
    row('2026-10-26', 999999, { siteCode: 'GUA' }),
  ];

  it('totals the week for one site and compares it with the week before', () => {
    const w = lastSevenDays(rows, 'BUN', '2026-10-26')!;
    expect(w.days.map((d) => d.label)).toEqual(['Tu', 'We', 'Th', 'Fr', 'Sa', 'Su', 'Mo']);
    expect(w.net).toBe(1540000);
    expect(w.netChange).toBe(10);
    expect(w.wagePct).toBe(30);
    expect(w.covers).toBe(350);
    expect(w.coversChange).toBe(0);
  });

  it('shows a closed day as a gap', () => {
    const w = lastSevenDays(rows.filter((r) => r.date !== '2026-10-25'), 'BUN', '2026-10-26')!;
    expect(w.days[5]).toEqual({ date: '2026-10-25', label: 'Su', net: null });
  });

  it('has nothing to show without figures, and nothing to compare without the week before', () => {
    expect(lastSevenDays([], 'BUN', '2026-10-26')).toBeNull();
    expect(lastSevenDays(rows.filter((r) => r.date >= '2026-10-20'), 'BUN', '2026-10-26')!.netChange).toBeNull();
  });
});

describe('repairs', () => {
  const r = (over: Partial<Repair>): Repair => ({
    id: 'x', siteCode: 'BUN', title: 'Walk-in door sticks', place: 'Kitchen', note: '', urgent: false,
    reportedBy: 'Sam', reportedAt: '2026-10-26T21:10:00Z', fixedAt: null, fixedBy: null, ...over,
  });

  it('lists a site\'s open repairs, urgent first, then oldest', () => {
    const list = [
      r({ id: 'old' }),
      r({ id: 'new', reportedAt: '2026-10-27T09:00:00Z' }),
      r({ id: 'urgent', urgent: true, reportedAt: '2026-10-27T10:00:00Z' }),
      r({ id: 'fixed', fixedAt: '2026-10-27T11:00:00Z', fixedBy: 'Maria' }),
      r({ id: 'elsewhere', siteCode: 'GUA' }),
    ];
    expect(openRepairs(list, 'BUN').map((x) => x.id)).toEqual(['urgent', 'old', 'new']);
  });

  it('needs to say what is wrong', () => {
    expect(repairIssues({ title: '  ' })).toEqual(["Say what's wrong"]);
    expect(repairIssues({ title: 'Leaking tap' })).toEqual([]);
  });

  it('says when it was reported, in UK time', () => {
    const now = new Date('2026-10-27T09:15:00Z');
    expect(reportedText('2026-10-26T21:10:00Z', now)).toBe('Reported 21:10 yesterday');
    expect(reportedText('2026-10-27T08:05:00Z', now)).toBe('Reported 08:05');
    expect(reportedText('2026-10-20T10:00:00Z', now)).toBe('Reported Tue 20 Oct');
  });
});

describe('when the end-of-day report is due', () => {
  const due = new Date('2026-10-28T03:00:00Z'); // 03:00 the next morning
  it('says nothing urgent for most of the day', () => {
    expect(eodDueText(due, new Date('2026-10-27T10:15:00Z'))).toEqual({ tone: 'none', text: 'Due after close' });
  });
  it('counts down in the last few hours, orange in the last hour', () => {
    expect(eodDueText(due, new Date('2026-10-27T22:30:00Z'))).toEqual({ tone: 'none', text: 'Due in 4h 30m' });
    expect(eodDueText(due, new Date('2026-10-28T02:20:00Z'))).toEqual({ tone: 'warn', text: 'Due in 40m' });
    expect(eodDueText(due, new Date('2026-10-28T03:01:00Z'))).toEqual({ tone: 'bad', text: 'Overdue' });
  });
});
