import { describe, expect, it } from 'vitest';
import { addDays, breakdown, dailyNet, forecastNet, periodRange, periodStats, periodView, weekday, type TradingDayRow } from '../src';

/** Example rows only: £1,000 a day at one site (£200 lunch, £700 dinner, £100 delivery), Saturdays double. */
function rows(from: string, days: number, site = 'BUN'): TradingDayRow[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    const k = weekday(date) === 6 ? 2 : 1;
    return { siteCode: site, date, net: { lunch: 20000 * k, dinner: 70000 * k, delivery: 10000 * k }, covers: { lunch: 10 * k, dinner: 30 * k }, wages: 28000 * k, cashDiff: i === 3 ? -2000 : 0 };
  });
}

describe('trends', () => {
  const r = rows('2026-01-01', 400);
  const last = r[r.length - 1]!.date; // 2027-02-04

  it('adds sites together by day', () => {
    const both = dailyNet([...rows('2026-01-01', 2), ...rows('2026-01-01', 2, 'BEL')]);
    expect(both).toEqual([{ date: '2026-01-01', value: 200000 }, { date: '2026-01-02', value: 200000 }]);
  });

  it('works out each period and the one before it', () => {
    expect(periodRange('1W', last, '2026-01-01')).toEqual({ from: '2027-01-29', to: last, prevFrom: '2027-01-22', prevTo: '2027-01-28' });
    expect(periodRange('1D', last, '2026-01-01')).toMatchObject({ from: last, prevFrom: '2027-01-28' });
    expect(periodRange('All', last, '2026-01-01')).toEqual({ from: '2026-01-01', to: last, prevFrom: null, prevTo: null });
    expect(periodRange('1Y', '2026-06-01', '2026-01-01').prevFrom).toBeNull();
  });

  it('1W: 14 daily points plus a 7-day forecast, headline is the last 7 days', () => {
    const daily = dailyNet(r);
    const v = periodView(daily, '1W', forecastNet(daily));
    expect(v.points.filter((p) => !p.forecast)).toHaveLength(14);
    expect(v.points.filter((p) => p.forecast)).toHaveLength(7);
    expect(v.headline).toBe(800000); // 6 × £1,000 + 1 Saturday × £2,000
    expect(v.change).toBe(0);
  });

  it('1D: the same weekday over 8 weeks', () => {
    const v = periodView(dailyNet(r), '1D');
    expect(v.points).toHaveLength(8);
    expect(v.points.every((p) => weekday(p.date) === weekday(last))).toBe(true);
    expect(v.title).toBe('Thursdays, last 8 weeks');
  });

  it('3M: 13 seven-day blocks ending on the last day', () => {
    const v = periodView(dailyNet(r), '3M');
    expect(v.points).toHaveLength(13);
    expect(v.points.every((p) => p.value === 800000)).toBe(true);
  });

  it('monthly views show complete months only', () => {
    const v = periodView(dailyNet(r), '1Y');
    expect(v.points).toHaveLength(12);
    expect(v.points[v.points.length - 1]!.date).toBe('2027-01-01');
  });

  it('stat tiles: covers, spend per head, wage % and cash', () => {
    const s = periodStats(r, '2026-01-01', '2026-01-07');
    expect(s.covers).toBe(320); // 6 × 40 + 80
    expect(s.spendPerHead).toBe(2250); // dine-in £7,200 ÷ 320
    expect(s.wagePct).toBe(28);
    expect(s).toMatchObject({ cashShortNights: 1, cashDiff: -2000, days: 7 });
  });

  it('breaks a week into days and a year into months', () => {
    expect(breakdown(r, '1W', last)).toHaveLength(7);
    const months = breakdown(r, '1Y', last);
    expect(months[0]).toMatchObject({ label: 'February 2027', sub: '4 of 28 days so far' });
    expect(months).toHaveLength(12);
  });
});
