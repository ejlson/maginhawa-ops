/**
 * Trends for head office: one site or the whole group, over a period from a day to all time.
 * Turns daily trading rows into chart points, headline figures and the stat tiles, so the screens
 * only draw. Forecasts come from forecast v1 and cover the next 14 days, so they only appear on the
 * daily views (1D, 1W, 1M).
 */
import { addDays, cleanSeries, daysBetween, weekday, WEEKDAY_NAMES, type DayValue } from './data-quality';
import { backtest, forecastV1, v1Method, type ForecastPoint } from './forecast';
import { percent, type Pence } from './money';

/** One site's trading day, from its submitted EOD (official figures). */
export interface TradingDayRow {
  siteCode: string;
  date: string;
  net: { lunch: Pence; dinner: Pence; delivery: Pence };
  covers: { lunch: number; dinner: number };
  wages: Pence | null;
  /** Cash over (+) or short (−) across the day. */
  cashDiff: Pence;
}

export type Period = '1D' | '1W' | '1M' | '3M' | '6M' | '9M' | '1Y' | 'All';
export const PERIODS: Period[] = ['1D', '1W', '1M', '3M', '6M', '9M', '1Y', 'All'];
export const PERIOD_NAMES: Record<Period, string> = {
  '1D': 'Day', '1W': 'Week', '1M': 'Month', '3M': '3 months', '6M': '6 months', '9M': '9 months', '1Y': 'Year', All: 'All time',
};

export const dayNet = (r: TradingDayRow): Pence => r.net.lunch + r.net.dinner + r.net.delivery;

/** Daily net totals for the rows given (one site, or several added together). */
export function dailyNet(rows: TradingDayRow[]): DayValue[] {
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.date, (by.get(r.date) ?? 0) + dayNet(r));
  return [...by].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

export interface ChartPoint {
  /** First day the point covers. */
  date: string;
  label: string;
  /** Longer label for the scrub readout. */
  detail: string;
  value: number;
  forecast: boolean;
  p10: number | null;
  p90: number | null;
}

export interface PeriodRange { from: string; to: string; prevFrom: string | null; prevTo: string | null }

const short = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const long = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthLabel = (d: string, withYear: boolean) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', withYear ? { month: 'short', year: '2-digit', timeZone: 'UTC' } : { month: 'short', timeZone: 'UTC' });

const LENGTH: Record<Exclude<Period, '1D' | 'All'>, number> = { '1W': 7, '1M': 31, '3M': 91, '6M': 182, '9M': 273, '1Y': 365 };

/** The days a period covers, ending on `last`, and the same length before it. */
export function periodRange(period: Period, last: string, first: string): PeriodRange {
  if (period === '1D') return { from: last, to: last, prevFrom: addDays(last, -7), prevTo: addDays(last, -7) };
  if (period === 'All') return { from: first, to: last, prevFrom: null, prevTo: null };
  const n = LENGTH[period];
  const from = addDays(last, -(n - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(n - 1));
  return { from, to: last, prevFrom: prevFrom >= first ? prevFrom : null, prevTo: prevFrom >= first ? prevTo : null };
}

const sumBetween = (daily: DayValue[], from: string, to: string) =>
  daily.filter((d) => d.date >= from && d.date <= to).reduce((s, d) => s + (d.value ?? 0), 0);

export interface PeriodView {
  title: string;
  points: ChartPoint[];
  headline: number;
  /** Headline ÷ the same length before − 1. Null if there's nothing to compare with. */
  change: number | null;
  vs: string;
  note: string;
}

/**
 * Chart points for a period. Daily views show each day (1D shows the same weekday over 8 weeks);
 * 3M and 6M show 7-day blocks ending on the last day; longer views show complete calendar months.
 */
export function periodView(daily: DayValue[], period: Period, forecast: ForecastPoint[] = []): PeriodView {
  const usable = daily.filter((d) => d.value !== null);
  if (!usable.length) return { title: PERIOD_NAMES[period], points: [], headline: 0, change: null, vs: '', note: '' };
  const first = usable[0]!.date;
  const last = usable[usable.length - 1]!.date;
  const byDate = new Map(daily.map((d) => [d.date, d.value ?? 0]));
  const range = periodRange(period, last, first);
  const headline = sumBetween(daily, range.from, range.to);
  const prev = range.prevFrom && range.prevTo ? sumBetween(daily, range.prevFrom, range.prevTo) : null;
  const change = prev ? headline / prev - 1 : null;
  const fc = (f: ForecastPoint): ChartPoint => ({ date: f.date, label: short(f.date), detail: `${long(f.date)} · forecast`, value: f.p50, forecast: true, p10: f.p10, p90: f.p90 });
  const day = (d: string): ChartPoint => ({ date: d, label: short(d), detail: long(d), value: byDate.get(d) ?? 0, forecast: false, p10: null, p90: null });

  let points: ChartPoint[] = [];
  let title = '';
  let vs = '';
  let note = '';
  if (period === '1D') {
    const wd = weekday(last);
    for (let w = 7; w >= 0; w--) { const d = addDays(last, -7 * w); if (d >= first) points.push(day(d)); }
    const next = forecast.find((f) => f.date === addDays(last, 7));
    if (next) points.push(fc(next));
    title = `${WEEKDAY_NAMES[wd]}s, last 8 weeks`;
    vs = `vs last ${WEEKDAY_NAMES[wd]}`;
    note = `Each point is a ${WEEKDAY_NAMES[wd]}, so busy weekends don't skew it.`;
  } else if (period === '1W' || period === '1M') {
    const span = period === '1W' ? 14 : 31;
    for (let i = span - 1; i >= 0; i--) { const d = addDays(last, -i); if (d >= first) points.push(day(d)); }
    points.push(...forecast.slice(0, 7).map(fc));
    title = period === '1W' ? 'Last 7 days' : 'Last 31 days';
    vs = period === '1W' ? 'vs previous 7 days' : 'vs previous 31 days';
    note = period === '1W' ? 'Daily totals, with the 7 days before for context. Forecast: next 7 days.' : 'Daily totals, so the weekend peaks show. Forecast: next 7 days.';
  } else if (period === '3M' || period === '6M') {
    const weeks = period === '3M' ? 13 : 26;
    for (let w = weeks - 1; w >= 0; w--) {
      const to = addDays(last, -7 * w);
      const from = addDays(to, -6);
      if (from < first) continue;
      points.push({ date: from, label: short(from), detail: `Week of ${short(from)}`, value: sumBetween(daily, from, to), forecast: false, p10: null, p90: null });
    }
    title = period === '3M' ? 'Last 3 months' : 'Last 6 months';
    vs = `vs previous ${PERIOD_NAMES[period]}`;
    note = 'Weekly totals (7-day blocks). Forecasts cover the next 14 days: see 1W or 1M.';
  } else {
    // Complete calendar months only, so a half-finished month never looks like a fall.
    const months = period === '9M' ? 9 : period === '1Y' ? 12 : Infinity;
    const lastComplete = addDays(addDays(last, 1).slice(0, 8) + '01', -1) === last ? last : addDays(last.slice(0, 8) + '01', -1);
    const out: ChartPoint[] = [];
    let end = lastComplete;
    while (out.length < months) {
      const start = end.slice(0, 8) + '01';
      if (start < first.slice(0, 8) + '01') break;
      const fromDay = start < first ? first : start;
      out.unshift({ date: start, label: monthLabel(start, period === 'All'), detail: new Date(`${start}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }), value: sumBetween(daily, fromDay, end), forecast: false, p10: null, p90: null });
      end = addDays(start, -1);
    }
    points = out;
    title = period === 'All' ? `Since ${monthLabel(first, true)}` : period === '9M' ? 'Last 9 months' : 'Last 12 months';
    vs = period === '1Y' ? 'vs year before' : period === '9M' ? 'vs previous 9 months' : '';
    note = 'Complete months only. Forecasts cover the next 14 days: see 1W or 1M.';
  }
  const shownHeadline = period === '1D' ? byDate.get(last) ?? 0 : headline;
  const shownChange = period === '1D' ? (() => { const p = byDate.get(addDays(last, -7)); return p ? (byDate.get(last) ?? 0) / p - 1 : null; })() : change;
  return { title, points, headline: shownHeadline, change: shownChange, vs, note };
}

/** Forecast v1 for a daily net series, with its likely range from a backtest over the last 200 days. */
export function forecastNet(daily: DayValue[], holidays: Set<string> = new Set()): ForecastPoint[] {
  const clean = cleanSeries(daily, { holidays });
  if (clean.length < 21) return [];
  const recent = clean.slice(-200);
  const { residuals } = backtest(recent, v1Method({ holidays }), { warmUp: Math.min(42, recent.length - 15) });
  return forecastV1(clean, clean[clean.length - 1]!.date, { holidays, residuals });
}

// ---- stat tiles and breakdown ----

export interface PeriodStats {
  net: Pence;
  covers: number;
  spendPerHead: Pence | null;
  wagePct: number | null;
  cashShortNights: number;
  cashDiff: Pence;
  split: { lunch: Pence; dinner: Pence; delivery: Pence };
  days: number;
}

export function periodStats(rows: TradingDayRow[], from: string, to: string): PeriodStats {
  const inRange = rows.filter((r) => r.date >= from && r.date <= to);
  const split = { lunch: 0, dinner: 0, delivery: 0 };
  let covers = 0;
  let wages = 0;
  let wagedNet = 0;
  let cashDiff = 0;
  const shortDays = new Set<string>();
  for (const r of inRange) {
    split.lunch += r.net.lunch; split.dinner += r.net.dinner; split.delivery += r.net.delivery;
    covers += r.covers.lunch + r.covers.dinner;
    if (r.wages !== null) { wages += r.wages; wagedNet += dayNet(r); }
    cashDiff += r.cashDiff;
    if (r.cashDiff < 0) shortDays.add(`${r.siteCode}|${r.date}`);
  }
  const net = split.lunch + split.dinner + split.delivery;
  const dineIn = split.lunch + split.dinner;
  return {
    net, covers, split, cashDiff, cashShortNights: shortDays.size,
    spendPerHead: covers ? Math.round(dineIn / covers) : null,
    wagePct: percent(wages, wagedNet),
    days: new Set(inRange.map((r) => r.date)).size,
  };
}

export interface BreakdownRow { label: string; sub: string; net: Pence }

/** What the period is made of: the day's services, the week's days, or the weeks and months. */
export function breakdown(rows: TradingDayRow[], period: Period, last: string): BreakdownRow[] {
  const net = (from: string, to: string) => rows.filter((r) => r.date >= from && r.date <= to).reduce((s, r) => s + dayNet(r), 0);
  if (period === '1D') {
    const day = rows.filter((r) => r.date === last);
    const cov = (k: 'lunch' | 'dinner') => day.reduce((s, r) => s + r.covers[k], 0);
    return [
      { label: 'Lunch', sub: `${cov('lunch')} covers`, net: day.reduce((s, r) => s + r.net.lunch, 0) },
      { label: 'Dinner', sub: `${cov('dinner')} covers`, net: day.reduce((s, r) => s + r.net.dinner, 0) },
      { label: 'Delivery', sub: 'All platforms', net: day.reduce((s, r) => s + r.net.delivery, 0) },
    ];
  }
  if (period === '1W') {
    return Array.from({ length: 7 }, (_, i) => addDays(last, -i)).map((d) => ({ label: long(d), sub: `${rows.filter((r) => r.date === d).reduce((s, r) => s + r.covers.lunch + r.covers.dinner, 0)} covers`, net: net(d, d) }));
  }
  if (period === '1M' || period === '3M') {
    const weeks = period === '1M' ? 5 : 13;
    return Array.from({ length: weeks }, (_, w) => {
      const to = addDays(last, -7 * w);
      const from = addDays(to, -6);
      return { label: `Week of ${short(from)}`, sub: `${short(from)} to ${short(to)}`, net: net(from, to) };
    });
  }
  const first = rows.reduce((m, r) => (r.date < m ? r.date : m), last);
  const months = period === '6M' ? 6 : period === '9M' ? 9 : period === '1Y' ? 12 : Math.ceil(daysBetween(first, last) / 30.4) + 1;
  const out: BreakdownRow[] = [];
  let end = last;
  for (let i = 0; i < months; i++) {
    const start = end.slice(0, 8) + '01';
    if (end < first) break;
    const days = daysBetween(start, end) + 1;
    const full = new Date(Date.UTC(+start.slice(0, 4), +start.slice(5, 7), 0)).getUTCDate();
    out.push({
      label: new Date(`${start}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      sub: days < full ? `${days} of ${full} days so far` : `${full} days`,
      net: net(start, end),
    });
    end = addDays(start, -1);
  }
  return out;
}
