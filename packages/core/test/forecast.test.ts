import { describe, expect, it } from 'vitest';
import {
  addDays, backtest, cleanSeries, forecastV1, groupWeekdayIndex, holtWinters, holtWintersMethod, likelyRange,
  MemoryForecastStore, naiveMethod, parseGovUkBankHolidays, pickupForecast, pickupHistory, profileSeries,
  qualityNotes, recentTrend, seasonalNaive, seriesFromReports, toSnapshots, updateAlpha, v1Method, weekday,
  computeDay, type DayValue, type StoredReport,
} from '../src';
import { settings, verifiedDraft } from './fixtures';

/** Example history only. A Sunday-to-Saturday shape in pence, like a mid-size dinner service. */
const SHAPE = [140000, 90000, 95000, 100000, 120000, 180000, 200000];
const START = '2026-01-05'; // a Monday

/** Seeded noise so every run is the same. */
function lcg(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}
function history(days: number, opts: { noise?: number; growth?: number; seed?: number } = {}): DayValue[] {
  const r = lcg(opts.seed ?? 7);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(START, i);
    const base = SHAPE[weekday(date)]! * (1 + (opts.growth ?? 0) * i);
    return { date, value: Math.round(base * (1 + (r() - 0.5) * 2 * (opts.noise ?? 0))) };
  });
}

describe('data cleaning', () => {
  it('fills calendar gaps and flags what can\'t be learnt from, keeping the raw figure', () => {
    const c = cleanSeries([
      { date: '2026-01-05', value: 100 },
      { date: '2026-01-07', value: -5 },
      { date: '2026-01-08', value: 0 },
      { date: '2026-01-09', value: 120, closed: true },
      { date: '2026-01-10', value: 90 },
      { date: '2026-01-10', value: 95 },
    ]);
    expect(c.map((d) => d.date)).toEqual(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10']);
    expect(c[1]).toMatchObject({ raw: null, value: null, flags: ['missing'] });
    expect(c[2]).toMatchObject({ raw: -5, value: null, flags: ['negative'] });
    expect(c[3]!.flags).toEqual(['zero']);
    expect(c[4]).toMatchObject({ raw: 120, value: null, flags: ['closed'] });
    expect(c[5]).toMatchObject({ raw: 95, value: 95, flags: ['duplicate'] });
  });

  it('leaves out an unusual night compared with the same weekday around it', () => {
    const h = history(84, { noise: 0.05 });
    h[40] = { ...h[40]!, value: h[40]!.value! * 3 }; // a private hire
    h[50] = { ...h[50]!, value: Math.round(h[50]!.value! * 0.2) }; // a power cut
    const c = cleanSeries(h);
    expect(c[40]!.flags).toContain('outlier-high');
    expect(c[50]!.flags).toContain('outlier-low');
    expect(c[40]!.raw).toBe(h[40]!.value);
    expect(c.filter((d) => d.flags.some((f) => f.startsWith('outlier')))).toHaveLength(2);
  });

  it('doesn\'t flag a recent lasting change as unusual, even before it has many weeks behind it', () => {
    const h = history(70, { noise: 0.04 }).map((d, i) => (i >= 56 ? { ...d, value: Math.round(d.value! * 1.5) } : d));
    expect(cleanSeries(h).filter((d) => d.flags.some((f) => f.startsWith('outlier')))).toHaveLength(0);
  });

  it('doesn\'t flag a lasting change as unusual', () => {
    const h = history(112, { noise: 0.04 }).map((d, i) => (i >= 56 ? { ...d, value: Math.round(d.value! * 1.25) } : d));
    expect(cleanSeries(h).filter((d) => d.flags.some((f) => f.startsWith('outlier')))).toHaveLength(0);
  });

  it('marks bank holidays without judging them against normal days', () => {
    const h = history(84, { noise: 0.03 });
    const bh = h[60]!.date;
    h[60] = { ...h[60]!, value: h[60]!.value! * 3 };
    const c = cleanSeries(h, { holidays: new Set([bh]) });
    expect(c[60]!.flags).toEqual(['bank-holiday']);
    expect(c[60]!.value).toBe(h[60]!.value);
  });
});

describe('data statistics', () => {
  it('profiles history: counts, weekday pattern, trend and readiness', () => {
    const h = history(70, { noise: 0, growth: 0.004 });
    h.splice(20, 3);
    const p = profileSeries(cleanSeries(h));
    expect(p.calendarDays).toBe(70);
    expect(p.usableDays).toBe(67);
    expect(p.counts.missing).toBe(3);
    expect(p.longestGap).toBe(3);
    expect(p.readiness).toBe('ok');
    expect(p.byWeekday[6]!.median).toBeGreaterThan(p.byWeekday[1]!.median!);
    expect(p.weeklySwing).toBeGreaterThan(2);
    expect(p.trend28).toBeGreaterThan(1.1);
    expect(qualityNotes(p)).toEqual(['3 days with no figures.', 'Last 4 weeks are 10% up on the 4 before.']);
  });

  it('says when there isn\'t enough history', () => {
    const p = profileSeries(cleanSeries(history(14)));
    expect(p.readiness).toBe('not-enough');
    expect(qualityNotes(p)[0]).toBe('Only 14 usable days. Forecasts need at least 3 weeks.');
  });

  it('builds a series from stored reports, using official figures only', () => {
    const d = verifiedDraft();
    const official = computeDay(d, settings);
    const report: StoredReport = { draft: d, status: 'submitted', submittedAt: null, submittedBy: null, official, issues: [] };
    expect(seriesFromReports([report], 'BUN', 'lunch', 'net')).toEqual([{ date: '2026-10-05', value: 85000, closed: false }]);
    expect(seriesFromReports([{ ...report, status: 'draft' }], 'BUN', 'lunch', 'net')).toEqual([]);
  });
});

describe('forecast v1', () => {
  const origin = (h: DayValue[]) => h[h.length - 1]!.date;

  it('is the median of the last 6 same weekdays, with the reason', () => {
    const h = history(70);
    const f = forecastV1(cleanSeries(h), origin(h));
    expect(f).toHaveLength(14);
    for (const p of f) expect(p.p50).toBe(SHAPE[weekday(p.date)]);
    expect(f[0]!.reasons).toEqual([`Median of the last 6 ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday(f[0]!.date)]}s`]);
  });

  it('nudges for the recent trend, but no more than 10%', () => {
    const h = history(70).map((d, i) => (i >= 56 ? { ...d, value: d.value! * 1.5 } : d));
    const c = cleanSeries(h);
    expect(recentTrend(c)).toBeCloseTo(1.5);
    const f = forecastV1(c, origin(h));
    expect(f[0]!.reasons).toContain('Recent trend +10%');
  });

  it('forecasts a bank holiday from past bank holidays, else like a Sunday', () => {
    const h = history(70);
    const past = [h[10]!.date, h[40]!.date];
    h[10] = { ...h[10]!, value: 250000 };
    h[40] = { ...h[40]!, value: 270000 };
    const next = addDays(origin(h), 3);
    const withPast = forecastV1(cleanSeries(h, { holidays: new Set([...past, next]) }), origin(h), { holidays: new Set([...past, next]) });
    expect(withPast[2]!.p50).toBe(260000);
    expect(withPast[2]!.reasons[0]).toBe('Bank holiday: median of the last 2 bank holidays');
    const noPast = forecastV1(cleanSeries(h), origin(h), { holidays: new Set([next]) });
    expect(noPast[2]!.p50).toBe(SHAPE[0]);
    expect(noPast[2]!.reasons[0]).toBe('Bank holiday: treated like a Sunday');
  });

  it('uses the group\'s weekday pattern for a new site, marked low confidence', () => {
    const group = groupWeekdayIndex([cleanSeries(history(70))])!;
    const young = history(10).map((d) => ({ ...d, value: Math.round(d.value! / 2) }));
    const f = forecastV1(cleanSeries(young), origin(young), { groupWeekdayIndex: group });
    expect(f.every((p) => p.confidence === 'low')).toBe(true);
    const sat = f.find((p) => weekday(p.date) === 6)!;
    const mon = f.find((p) => weekday(p.date) === 1)!;
    expect(sat.p50 / mon.p50).toBeCloseTo(SHAPE[6]! / SHAPE[1]!, 1);
    expect(sat.reasons[0]).toBe('Little history: site level × group weekday pattern');
  });

  it('covers: bookings on the books plus the usual pickup', () => {
    const hist = [0, 1, 2].map(() => ({ weekday: 5, leadDays: 2, booked: 50, final: 68 }));
    expect(pickupForecast(60, 5, 2, hist)).toEqual({ covers: 78, pickup: 18, n: 3 });
    expect(pickupForecast(60, 5, 3, hist)).toBeNull();
    const h = history(70).map((d) => ({ ...d, value: 80 }));
    const o = origin(h);
    const friday = [1, 2, 3, 4, 5, 6, 7].map((n) => addDays(o, n)).find((d) => weekday(d) === 5)!;
    const lead = [1, 2, 3, 4, 5, 6, 7].find((n) => addDays(o, n) === friday)!;
    const f = forecastV1(cleanSeries(h), o, {
      bookings: new Map([[friday, 60]]),
      pickupHistory: [0, 1, 2].map(() => ({ weekday: 5, leadDays: lead, booked: 50, final: 68 })),
    });
    const p = f.find((x) => x.date === friday)!;
    expect(p.p50).toBe(78);
    expect(p.reasons).toContain('60 booked + usual 18 more');
  });

  it('only gives a likely range once there are enough past misses', () => {
    const bank = new Map([[1, [0, 0.1, -0.1, 0.05, -0.05, 0.2, -0.2, 0.15]]]);
    expect(likelyRange(1000, 1, bank)).toBeNull();
    bank.get(1)!.push(-0.15);
    const [lo, hi] = likelyRange(1000, 1, bank)!;
    expect(lo).toBeLessThan(1000);
    expect(hi).toBeGreaterThan(1000);
    expect(likelyRange(1000, 1, undefined)).toBeNull();
  });

  it('widens the range after a miss and narrows it after a hit', () => {
    expect(updateAlpha(0.2, true)).toBeLessThan(0.2);
    expect(updateAlpha(0.2, false)).toBeGreaterThan(0.2);
  });
});

describe('comparison methods', () => {
  it('same weekday last week, looking back further over a gap', () => {
    const h = history(28);
    h[h.length - 7] = { ...h[h.length - 7]!, value: null };
    const o = h[h.length - 1]!.date;
    const f = seasonalNaive(cleanSeries(h), o);
    expect(f[0]!.p50).toBe(SHAPE[weekday(f[0]!.date)]);
    expect(f).toHaveLength(14);
  });

  it('Holt-Winters learns a steady weekly pattern', () => {
    const h = history(70);
    const f = holtWinters(cleanSeries(h), h[h.length - 1]!.date);
    for (const p of f) expect(Math.abs(p.p50 - SHAPE[weekday(p.date)]!) / SHAPE[weekday(p.date)]!).toBeLessThan(0.02);
  });
});

describe('backtest', () => {
  it('never uses anything after the forecast day', () => {
    const h = history(70, { noise: 0.1 });
    const o = h[55]!.date;
    const before = forecastV1(cleanSeries(h), o);
    const changedFuture = h.map((d, i) => (i > 55 ? { ...d, value: d.value! * 5 } : d));
    expect(forecastV1(cleanSeries(changedFuture), o).map((p) => p.p50)).toEqual(before.map((p) => p.p50));
  });

  it('v1 beats "same weekday last week" on noisy history and its 80% range roughly holds', () => {
    const c = cleanSeries(history(280, { noise: 0.15, seed: 3 }));
    const v1 = backtest(c, v1Method());
    const naive = backtest(c, naiveMethod);
    const hw = backtest(c, holtWintersMethod);
    expect(v1.overall.mase!).toBeLessThan(naive.overall.mase!);
    expect(v1.overall.wape!).toBeLessThan(0.12);
    expect(Math.abs(v1.overall.bias!)).toBeLessThan(0.03);
    expect(v1.overall.coverage!).toBeGreaterThan(0.7);
    expect(v1.overall.coverage!).toBeLessThan(0.9);
    expect(hw.overall.n).toBeGreaterThan(0);
    expect(v1.byHorizon.get(14)!.n).toBeGreaterThan(0);
  });
});

describe('nightly records', () => {
  it('keeps bookings for the next 14 days only, with lead time', () => {
    const rows = toSnapshots('BUN', '2026-10-05', [
      { date: '2026-10-05', session: 'dinner', covers: 70, bookings: 20 },
      { date: '2026-10-06', session: 'dinner', covers: 40, bookings: 12 },
      { date: '2026-10-19', session: 'lunch', covers: 8, bookings: 3 },
      { date: '2026-10-20', session: 'dinner', covers: 5, bookings: 2 },
    ], 'Example system');
    expect(rows.map((r) => [r.forDate, r.leadDays])).toEqual([['2026-10-06', 1], ['2026-10-19', 14]]);
  });

  it('pairs past snapshots with what actually came, for pickup', () => {
    const rows = toSnapshots('BUN', '2026-10-05', [{ date: '2026-10-09', session: 'dinner', covers: 50, bookings: 15 }], 'x');
    expect(pickupHistory(rows, new Map([['2026-10-09', 68]]), 'dinner')).toEqual([{ weekday: 5, leadDays: 4, booked: 50, final: 68 }]);
  });

  it('saving a night twice replaces it rather than doubling up', async () => {
    const store = new MemoryForecastStore();
    const rows = toSnapshots('BUN', '2026-10-05', [{ date: '2026-10-06', session: 'dinner', covers: 40, bookings: 12 }], 'x');
    await store.saveSnapshots(rows);
    await store.saveSnapshots(rows);
    expect(await store.listSnapshots('BUN')).toHaveLength(1);
  });

  it('reads bank holidays from the gov.uk format', () => {
    const json = { 'england-and-wales': { events: [{ date: '2026-12-25' }, { date: 'bad' }] }, scotland: { events: [{ date: '2026-11-30' }] } };
    expect([...parseGovUkBankHolidays(json)]).toEqual(['2026-12-25']);
    expect([...parseGovUkBankHolidays(json, 'scotland')]).toEqual(['2026-11-30']);
    expect(parseGovUkBankHolidays(null).size).toBe(0);
  });
});
