/**
 * Forecast v1: per site, service and metric, 1–14 days ahead, with an 80% likely range.
 * Chosen in reports/Restaurant sales forecasting algorithms.md. Every figure can be explained in a sentence:
 *   1. median of the last 6 same weekdays (cleaned data only)
 *   2. a small, capped nudge for the recent trend
 *   3. bank holidays from past bank holidays, else treated like a Sunday
 *   4. little history: the site's level × the group's weekday pattern, marked low confidence
 *   5. covers: bookings already made + the usual pickup for that weekday and lead time
 *   6. likely range from this method's own past misses at each horizon (no leakage)
 */
import { addDays, mean, median, quantile, weekday, WEEKDAY_NAMES, type CleanDay } from './data-quality';

export const FORECAST_VERSION = 'forecast-v1.0';

export interface ForecastPoint {
  date: string;
  horizon: number;
  p50: number;
  /** 80% likely range. Null until there are past misses to base it on. */
  p10: number | null;
  p90: number | null;
  confidence: 'normal' | 'low';
  reasons: string[];
}

/** How far out forecasts were at each horizon: log(actual ÷ forecast). */
export type ResidualBank = Map<number, number[]>;

export interface BookingPickup {
  /** Weekday of the booked day, lead in days, covers on the books then, final covers. */
  weekday: number;
  leadDays: number;
  booked: number;
  final: number;
}

export interface ForecastOptions {
  horizons?: number;
  holidays?: Set<string>;
  /** Weeks of same-weekday history to take the median of. */
  weeks?: number;
  /** Group's weekday pattern (index by weekday, average 1), for sites with little history. */
  groupWeekdayIndex?: number[];
  /** Share of the measured trend to apply, and the most it can move the forecast. */
  trendDamping?: number;
  trendCap?: number;
  /** Past misses, for the likely range. */
  residuals?: ResidualBank;
  /** Miss rate the range aims for (0.2 = 80% range). Adjusted over time by updateAlpha. */
  alpha?: number;
  /** Covers on the books now, by date (covers forecasts only). */
  bookings?: Map<string, number>;
  /** Past bookings against what actually came, for pickup. */
  pickupHistory?: BookingPickup[];
}

const pct = (r: number) => `${r >= 1 ? '+' : '−'}${Math.round(Math.abs(r - 1) * 100)}%`;
const usableBefore = (clean: CleanDay[], originIdx: number) => clean.slice(0, originIdx + 1);

/** Weekday-matched ratio of the last 2 weeks to the 4 weeks before. Null without 6 weeks. */
export function recentTrend(hist: CleanDay[]): number | null {
  if (hist.length < 42) return null;
  const recent = hist.slice(-14);
  const before = hist.slice(-42, -14);
  const ratios: number[] = [];
  for (let wd = 0; wd < 7; wd++) {
    const ok = (c: CleanDay) => c.value !== null && weekday(c.date) === wd && !c.flags.includes('bank-holiday');
    const a = recent.filter(ok).map((c) => c.value!);
    const b = before.filter(ok).map((c) => c.value!);
    if (a.length && b.length >= 2 && mean(b) > 0) ratios.push(mean(a) / mean(b));
  }
  return ratios.length >= 4 ? median(ratios) : null;
}

/** The usual extra covers after `booked` were on the books, for a weekday and lead time. */
export function pickupForecast(booked: number, wd: number, leadDays: number, history: BookingPickup[]): { covers: number; pickup: number; n: number } | null {
  const same = history.filter((h) => h.weekday === wd && h.leadDays === leadDays);
  if (same.length < 3) return null;
  const pickup = median(same.map((h) => h.final - h.booked));
  return { covers: Math.max(booked, booked + pickup), pickup, n: same.length };
}

/** The 80% (or 1 − alpha) range from past misses at this horizon, or all horizons if too few. */
export function likelyRange(p50: number, horizon: number, bank: ResidualBank | undefined, alpha = 0.2): [number, number] | null {
  if (!bank) return null;
  let rs = bank.get(horizon) ?? [];
  if (rs.length < 8) rs = [...bank.values()].flat();
  // Split-conformal needs at least ceil(2/alpha) − 1 misses before the range is finite (9 for 80%).
  if (rs.length < Math.ceil(2 / alpha) - 1) return null;
  return [p50 * Math.exp(quantile(rs, alpha / 2)), p50 * Math.exp(quantile(rs, 1 - alpha / 2))];
}

/**
 * Adaptive conformal update (Gibbs & Candès 2021): after each actual, widen the range a little if it
 * missed, narrow it a little if it held, so coverage stays near the target over time.
 */
export function updateAlpha(alpha: number, missed: boolean, target = 0.2, gamma = 0.005): number {
  return Math.min(0.5, Math.max(0.02, alpha + gamma * (target - (missed ? 1 : 0))));
}

/** Forecast v1 for the days after `origin`, using only days on or before it. */
export function forecastV1(clean: CleanDay[], origin: string, opts: ForecastOptions = {}): ForecastPoint[] {
  const originIdx = clean.findIndex((c) => c.date === origin);
  if (originIdx < 0) return [];
  const hist = usableBefore(clean, originIdx);
  const usable = hist.filter((c) => c.value !== null);
  if (usable.length === 0) return [];

  const horizons = opts.horizons ?? 14;
  const weeks = opts.weeks ?? 6;
  const holidays = opts.holidays ?? new Set<string>();
  const trend = recentTrend(hist);
  const nudge = trend === null ? 1 : Math.min(1 + (opts.trendCap ?? 0.1), Math.max(1 - (opts.trendCap ?? 0.1), 1 + (opts.trendDamping ?? 0.5) * (trend - 1)));

  const sameWeekday = (wd: number) => hist
    .filter((c) => c.value !== null && weekday(c.date) === wd && !c.flags.includes('bank-holiday'))
    .slice(-weeks)
    .map((c) => c.value!);

  const out: ForecastPoint[] = [];
  for (let h = 1; h <= horizons; h++) {
    const date = addDays(origin, h);
    const wd = weekday(date);
    const reasons: string[] = [];
    let confidence: ForecastPoint['confidence'] = 'normal';
    let base: number;

    const pastHolidays = hist.filter((c) => c.flags.includes('bank-holiday') && c.raw !== null && c.raw > 0 && !c.flags.includes('closed')).slice(-6).map((c) => c.raw!);
    const same = sameWeekday(wd);
    if (holidays.has(date) && pastHolidays.length >= 2) {
      base = median(pastHolidays);
      reasons.push(`Bank holiday: median of the last ${pastHolidays.length} bank holidays`);
    } else if (holidays.has(date) && sameWeekday(0).length >= 3) {
      base = median(sameWeekday(0).slice(-weeks));
      reasons.push('Bank holiday: treated like a Sunday');
    } else if (same.length >= 3) {
      base = median(same);
      reasons.push(`Median of the last ${same.length} ${WEEKDAY_NAMES[wd]}s`);
    } else {
      // Little history: this site's recent level, shaped by the group's weekday pattern.
      const recent = usable.slice(-28);
      const level = median(recent.map((c) => c.value!));
      const idx = opts.groupWeekdayIndex;
      if (idx) {
        const avgIdx = mean(recent.map((c) => idx[weekday(c.date)] ?? 1));
        base = (level / avgIdx) * (idx[wd] ?? 1);
        reasons.push('Little history: site level × group weekday pattern');
      } else {
        base = level;
        reasons.push('Little history: recent median');
      }
      confidence = 'low';
    }

    let p50 = base * nudge;
    if (Math.abs(nudge - 1) >= 0.01) reasons.push(`Recent trend ${pct(nudge)}`);

    const booked = opts.bookings?.get(date);
    if (booked !== undefined && opts.pickupHistory) {
      const pu = pickupForecast(booked, wd, h, opts.pickupHistory);
      if (pu) {
        p50 = pu.covers;
        reasons.push(`${booked} booked + usual ${Math.round(pu.pickup)} more`);
      }
    }

    const range = likelyRange(p50, h, opts.residuals, opts.alpha);
    if (!range) confidence = 'low';
    out.push({ date, horizon: h, p50, p10: range?.[0] ?? null, p90: range?.[1] ?? null, confidence, reasons });
  }
  return out;
}

// ---- comparison methods (kept alongside v1 and logged, never shown to managers) ----

/** Same weekday last week (the benchmark everything must beat). Falls back up to 4 weeks for gaps. */
export function seasonalNaive(clean: CleanDay[], origin: string, horizons = 14): ForecastPoint[] {
  const idx = new Map(clean.map((c, i) => [c.date, i]));
  const at = idx.get(origin);
  if (at === undefined) return [];
  const out: ForecastPoint[] = [];
  for (let h = 1; h <= horizons; h++) {
    const date = addDays(origin, h);
    let v: number | null = null;
    for (let back = 7; back <= 28 && v === null; back += 7) {
      const d = addDays(date, -back);
      const j = idx.get(d);
      if (j !== undefined && j <= at) v = clean[j]!.value;
    }
    if (v !== null) out.push({ date, horizon: h, p50: v, p10: null, p90: null, confidence: 'normal', reasons: ['Same weekday last week'] });
  }
  return out;
}

/**
 * Additive Holt-Winters with a weekly season and no trend (ETS(A,N,A) with fixed smoothing).
 * The hidden challenger: if it beats v1 in the backtest, it joins the forecast in v2.
 */
export function holtWinters(clean: CleanDay[], origin: string, horizons = 14, a = 0.2, g = 0.15): ForecastPoint[] {
  const originIdx = clean.findIndex((c) => c.date === origin);
  if (originIdx < 13) return [];
  const hist = clean.slice(0, originIdx + 1);
  const first = hist.slice(0, 14).filter((c) => c.value !== null).map((c) => c.value!);
  if (first.length < 7) return [];
  let level = mean(first);
  const season = new Array<number>(7).fill(0);
  for (let wd = 0; wd < 7; wd++) {
    const xs = hist.slice(0, 14).filter((c) => c.value !== null && weekday(c.date) === wd).map((c) => c.value!);
    season[wd] = xs.length ? mean(xs) - level : 0;
  }
  for (const c of hist.slice(14)) {
    const wd = weekday(c.date);
    if (c.value === null) continue; // a gap just carries the state forward
    const prevLevel = level;
    level = a * (c.value - season[wd]!) + (1 - a) * level;
    season[wd] = g * (c.value - prevLevel) + (1 - g) * season[wd]!;
  }
  const out: ForecastPoint[] = [];
  for (let h = 1; h <= horizons; h++) {
    const date = addDays(origin, h);
    out.push({ date, horizon: h, p50: Math.max(0, level + season[weekday(date)]!), p10: null, p90: null, confidence: 'normal', reasons: ['Holt-Winters'] });
  }
  return out;
}

// ---- backtest and accuracy ----

export type Method = (clean: CleanDay[], origin: string, residuals: ResidualBank) => ForecastPoint[];

export interface BacktestRow { origin: string; date: string; horizon: number; actual: number; p50: number; p10: number | null; p90: number | null }

export interface Accuracy {
  n: number;
  /** Mean absolute error ÷ in-sample error of "same weekday last week". Below 1 beats it. */
  mase: number | null;
  /** Total absolute error ÷ total actual. What managers would call "% out". */
  wape: number | null;
  /** Total (forecast − actual) ÷ total actual. Positive = forecasts too high. */
  bias: number | null;
  /** Share of actuals inside the likely range (aim: 0.8). */
  coverage: number | null;
  /** Average range width as a share of the forecast. */
  width: number | null;
  /** Average pinball loss over the 10th, 50th and 90th percentiles (lower is better). */
  pinball: number | null;
}

/** Average absolute change from the same weekday a week earlier: MASE's yardstick (Hyndman & Koehler 2006). */
export function naiveScale(clean: CleanDay[]): number | null {
  const diffs: number[] = [];
  for (let i = 7; i < clean.length; i++) {
    const a = clean[i]!.value;
    const b = clean[i - 7]!.value;
    if (a !== null && b !== null) diffs.push(Math.abs(a - b));
  }
  return diffs.length ? mean(diffs) : null;
}

export function accuracy(rows: BacktestRow[], scale: number | null): Accuracy {
  const n = rows.length;
  if (!n) return { n, mase: null, wape: null, bias: null, coverage: null, width: null, pinball: null };
  const absErr = rows.reduce((s, r) => s + Math.abs(r.p50 - r.actual), 0);
  const total = rows.reduce((s, r) => s + r.actual, 0);
  const ranged = rows.filter((r) => r.p10 !== null && r.p90 !== null);
  const pin = (q: number, f: number, y: number) => (y >= f ? q * (y - f) : (1 - q) * (f - y));
  return {
    n,
    mase: scale ? absErr / n / scale : null,
    wape: total ? absErr / total : null,
    bias: total ? rows.reduce((s, r) => s + r.p50 - r.actual, 0) / total : null,
    coverage: ranged.length ? ranged.filter((r) => r.actual >= r.p10! && r.actual <= r.p90!).length / ranged.length : null,
    width: ranged.length ? mean(ranged.map((r) => (r.p90! - r.p10!) / (r.p50 || 1))) : null,
    pinball: ranged.length ? mean(ranged.map((r) => (pin(0.1, r.p10!, r.actual) + pin(0.5, r.p50, r.actual) + pin(0.9, r.p90!, r.actual)) / 3)) : null,
  };
}

/**
 * Walk-forward backtest: forecast from every day after `warmUp`, 1–14 days ahead, then score each
 * against what happened. Misses feed the likely range only once their day has passed, so nothing
 * from the future leaks in. Days left out by cleaning aren't scored.
 */
export function backtest(clean: CleanDay[], method: Method, opts: { warmUp?: number; horizons?: number } = {}) {
  const warmUp = opts.warmUp ?? 42;
  const rows: BacktestRow[] = [];
  const residuals: ResidualBank = new Map();
  const pending: { due: string; horizon: number; r: number }[] = [];
  const byDate = new Map(clean.map((c) => [c.date, c]));

  for (let i = warmUp; i < clean.length - 1; i++) {
    const origin = clean[i]!.date;
    // Misses whose day is now known join the bank.
    for (let k = pending.length - 1; k >= 0; k--) {
      const p = pending[k]!;
      if (p.due <= origin) {
        const list = residuals.get(p.horizon) ?? [];
        list.push(p.r);
        if (list.length > 56) list.shift(); // the last 8 weeks of misses at this horizon
        residuals.set(p.horizon, list);
        pending.splice(k, 1);
      }
    }
    for (const f of method(clean, origin, residuals)) {
      if ((opts.horizons ?? 14) < f.horizon) continue;
      const actual = byDate.get(f.date)?.value;
      if (actual === null || actual === undefined || f.p50 <= 0) continue;
      rows.push({ origin, date: f.date, horizon: f.horizon, actual, p50: f.p50, p10: f.p10, p90: f.p90 });
      pending.push({ due: f.date, horizon: f.horizon, r: Math.log(actual / f.p50) });
    }
  }
  const scale = naiveScale(clean.slice(0, warmUp + 1));
  const byHorizon = new Map<number, Accuracy>();
  for (let h = 1; h <= (opts.horizons ?? 14); h++) byHorizon.set(h, accuracy(rows.filter((r) => r.horizon === h), scale));
  return { rows, overall: accuracy(rows, scale), byHorizon, residuals };
}

/** v1 as a backtest method, using the misses known at each origin for its range. */
export const v1Method = (opts: Omit<ForecastOptions, 'residuals'> = {}): Method =>
  (clean, origin, residuals) => forecastV1(clean, origin, { ...opts, residuals });
export const naiveMethod: Method = (clean, origin) => seasonalNaive(clean, origin);
export const holtWintersMethod: Method = (clean, origin) => holtWinters(clean, origin);

/** The group's weekday pattern from several sites' cleaned series (average 1), for new sites. */
export function groupWeekdayIndex(series: CleanDay[][]): number[] | undefined {
  const idx = new Array<number>(7).fill(0);
  let used = 0;
  for (const s of series) {
    const meds: number[] = [];
    for (let wd = 0; wd < 7; wd++) {
      const xs = s.filter((c) => c.value !== null && weekday(c.date) === wd && !c.flags.includes('bank-holiday')).map((c) => c.value!);
      if (xs.length < 3) break;
      meds.push(median(xs));
    }
    if (meds.length < 7) continue;
    const m = mean(meds);
    if (!m) continue;
    meds.forEach((v, wd) => { idx[wd] = (idx[wd] ?? 0) + v / m; });
    used++;
  }
  return used ? idx.map((v) => v / used) : undefined;
}
