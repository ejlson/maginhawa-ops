/**
 * Cleaning and statistics for daily trading history, before anything is forecast.
 * Every day keeps its raw figure; cleaning only decides whether it is fit to learn from,
 * and says why not. Nothing is silently changed.
 */
import type { StoredReport } from './store';

export type Service = 'lunch' | 'dinner' | 'delivery';
export type Metric = 'net' | 'covers';

/** One trading day's figure for one site, service and metric. Pence for net. */
export interface DayValue {
  date: string;
  value: number | null;
  /** The service didn't run (switched off in the EOD). */
  closed?: boolean;
}

export type CleanFlag =
  | 'missing' | 'closed' | 'zero' | 'negative' | 'duplicate'
  | 'outlier-high' | 'outlier-low' | 'bank-holiday';

export interface CleanDay {
  date: string;
  /** What was recorded (the last entry if there were duplicates). */
  raw: number | null;
  /** The figure to learn from, or null if this day should be left out. */
  value: number | null;
  flags: CleanFlag[];
}

export interface CleanOptions {
  /** Bank holidays (yyyy-mm-dd). Kept, but learnt from separately. */
  holidays?: Set<string>;
  /** Robust z-score beyond which a day is unusual. 3.5 is the usual cut-off (Iglewicz & Hoaglin). */
  outlierZ?: number;
  /** How many weeks either side to compare a day with (same weekday). Local, so a lasting change isn't flagged. */
  outlierWindowWeeks?: number;
  /**
   * Smallest spread to judge against, as a share of the typical figure. Stops a run of very similar
   * nights from making an ordinary one look unusual. 0.05 means a day must be about 26% out to be flagged.
   */
  minSpreadPct?: number;
}

// ---- dates (trading days as yyyy-mm-dd, worked in UTC so DST never shifts a day) ----

export const addDays = (date: string, n: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** 0 = Sunday … 6 = Saturday. */
export const weekday = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();
export const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

// ---- small statistics ----

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}
/** Linear-interpolated quantile, q in [0, 1]. */
export function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}
const mad = (xs: number[], m = median(xs)) => median(xs.map((x) => Math.abs(x - m)));

// ---- cleaning ----

/** Puts the days in order, fills calendar gaps, and flags anything that shouldn't be learnt from. */
export function cleanSeries(input: DayValue[], opts: CleanOptions = {}): CleanDay[] {
  if (input.length === 0) return [];
  const z = opts.outlierZ ?? 3.5;
  const windowWeeks = opts.outlierWindowWeeks ?? 8;
  const minSpread = opts.minSpreadPct ?? 0.05;
  const holidays = opts.holidays ?? new Set<string>();

  const byDate = new Map<string, { entry: DayValue; count: number }>();
  for (const e of input) {
    const prev = byDate.get(e.date);
    byDate.set(e.date, { entry: e, count: (prev?.count ?? 0) + 1 });
  }
  const dates = [...byDate.keys()].sort();
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;

  const out: CleanDay[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const hit = byDate.get(d);
    const flags: CleanFlag[] = [];
    if (!hit) {
      out.push({ date: d, raw: null, value: null, flags: ['missing'] });
      continue;
    }
    const { entry, count } = hit;
    if (count > 1) flags.push('duplicate');
    if (holidays.has(d)) flags.push('bank-holiday');
    let value = entry.value;
    if (entry.closed) { flags.push('closed'); value = null; }
    else if (value === null) { flags.push('missing'); }
    else if (value < 0) { flags.push('negative'); value = null; }
    else if (value === 0) { flags.push('zero'); value = null; }
    out.push({ date: d, raw: entry.value, value, flags });
  }

  // Unusual days: compared with the same weekday in the weeks around them (median and MAD, so one
  // odd night can't hide another). Bank holidays are judged only against other bank holidays later.
  const candidates = out.map((c) => (c.value !== null && !c.flags.includes('bank-holiday') ? c.value : null));
  const scores = out.map((c, i): number | null => {
    if (candidates[i] === null) return null;
    const near: number[] = [];
    for (let w = -windowWeeks; w <= windowWeeks; w++) {
      if (w === 0) continue;
      const v = candidates[i + w * 7];
      if (v !== null && v !== undefined) near.push(v);
    }
    if (near.length < 5) return null;
    const m = median(near);
    const spread = Math.max(mad(near, m), minSpread * m);
    return spread > 0 ? (0.6745 * (c.value! - m)) / spread : null;
  });
  out.forEach((c, i) => {
    const score = scores[i];
    if (score === null || score === undefined || Math.abs(score) <= z) return;
    // Several nights around it moving the same way is a real change (a refurb, a new menu), not one odd night.
    let alike = 0;
    for (let j = i - 6; j <= i + 6; j++) {
      const sj = scores[j];
      if (j !== i && sj !== null && sj !== undefined && Math.sign(sj) === Math.sign(score) && Math.abs(sj) > z / 2) alike++;
    }
    if (alike >= 3) return;
    c.flags.push(score > 0 ? 'outlier-high' : 'outlier-low');
    c.value = null;
  });
  return out;
}

// ---- statistics ----

export interface WeekdayStats { weekday: number; name: string; n: number; median: number | null; mean: number | null; cv: number | null }

export type Readiness = 'not-enough' | 'low' | 'ok' | 'good';

export interface SeriesProfile {
  firstDate: string | null;
  lastDate: string | null;
  calendarDays: number;
  usableDays: number;
  counts: Record<CleanFlag, number>;
  /** Longest run of days with no usable figure. */
  longestGap: number;
  overall: { mean: number; median: number; sd: number; cv: number; min: number; max: number } | null;
  byWeekday: WeekdayStats[];
  /** Busiest weekday's median ÷ quietest weekday's median. */
  weeklySwing: number | null;
  /** Last 28 usable days ÷ the 28 before, same-weekday matched. Null if not enough history. */
  trend28: number | null;
  /** How much forecasting this history supports. */
  readiness: Readiness;
}

const ZERO_COUNTS = (): Record<CleanFlag, number> => ({
  missing: 0, closed: 0, zero: 0, negative: 0, duplicate: 0, 'outlier-high': 0, 'outlier-low': 0, 'bank-holiday': 0,
});

export function profileSeries(clean: CleanDay[]): SeriesProfile {
  const counts = ZERO_COUNTS();
  let gap = 0;
  let longestGap = 0;
  for (const c of clean) {
    for (const f of c.flags) counts[f]++;
    gap = c.value === null ? gap + 1 : 0;
    longestGap = Math.max(longestGap, gap);
  }
  const usable = clean.filter((c) => c.value !== null).map((c) => c.value!);

  const byWeekday: WeekdayStats[] = WEEKDAY_NAMES.map((name, wd) => {
    const xs = clean.filter((c) => c.value !== null && weekday(c.date) === wd && !c.flags.includes('bank-holiday')).map((c) => c.value!);
    const m = xs.length ? mean(xs) : null;
    return { weekday: wd, name, n: xs.length, median: xs.length ? median(xs) : null, mean: m, cv: xs.length > 1 && m ? stdDev(xs) / m : null };
  });
  const medians = byWeekday.map((w) => w.median).filter((m): m is number => m !== null && m > 0);

  let trend28: number | null = null;
  if (clean.length >= 56) {
    const ratios: number[] = [];
    const recent = clean.slice(-28);
    const before = clean.slice(-56, -28);
    for (let wd = 0; wd < 7; wd++) {
      const a = recent.filter((c) => c.value !== null && weekday(c.date) === wd).map((c) => c.value!);
      const b = before.filter((c) => c.value !== null && weekday(c.date) === wd).map((c) => c.value!);
      if (a.length >= 2 && b.length >= 2 && mean(b) > 0) ratios.push(mean(a) / mean(b));
    }
    if (ratios.length >= 4) trend28 = median(ratios);
  }

  const readiness: Readiness = usable.length < 21 ? 'not-enough' : usable.length < 42 ? 'low' : usable.length < 365 ? 'ok' : 'good';
  const m = usable.length ? mean(usable) : 0;
  return {
    firstDate: clean[0]?.date ?? null,
    lastDate: clean[clean.length - 1]?.date ?? null,
    calendarDays: clean.length,
    usableDays: usable.length,
    counts,
    longestGap,
    overall: usable.length
      ? { mean: m, median: median(usable), sd: stdDev(usable), cv: m ? stdDev(usable) / m : 0, min: Math.min(...usable), max: Math.max(...usable) }
      : null,
    byWeekday,
    weeklySwing: medians.length >= 2 ? Math.max(...medians) / Math.min(...medians) : null,
    trend28,
    readiness,
  };
}

/** Plain-English notes for head office about what the data looks like and what was left out. */
export function qualityNotes(p: SeriesProfile): string[] {
  const notes: string[] = [];
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  if (p.readiness === 'not-enough') notes.push(`Only ${plural(p.usableDays, 'usable day')}. Forecasts need at least 3 weeks.`);
  else if (p.readiness === 'low') notes.push(`${plural(p.usableDays, 'usable day')}. Forecasts will be marked low confidence until there are 6 weeks.`);
  if (p.counts.missing) notes.push(`${plural(p.counts.missing, 'day')} with no figures.`);
  if (p.counts.duplicate) notes.push(`${plural(p.counts.duplicate, 'day')} entered more than once. The last entry was kept.`);
  if (p.counts.negative) notes.push(`${plural(p.counts.negative, 'negative figure')} left out.`);
  const odd = p.counts['outlier-high'] + p.counts['outlier-low'];
  if (odd) notes.push(`${plural(odd, 'unusual day')} left out of the averages (${p.counts['outlier-high']} high, ${p.counts['outlier-low']} low). Check they're right.`);
  if (p.longestGap >= 7) notes.push(`Longest gap: ${p.longestGap} days in a row with no usable figure.`);
  if (p.trend28 !== null && Math.abs(p.trend28 - 1) >= 0.1) notes.push(`Last 4 weeks are ${Math.round(Math.abs(p.trend28 - 1) * 100)}% ${p.trend28 > 1 ? 'up on' : 'down on'} the 4 before.`);
  return notes;
}

// ---- from reports ----

/** One site's daily series for a service and metric, from its stored EOD reports (official figures only). */
export function seriesFromReports(reports: StoredReport[], siteCode: string, service: Service, metric: Metric): DayValue[] {
  return reports
    .filter((r) => r.draft.siteCode === siteCode && r.official && (r.status === 'submitted' || r.status === 'approved'))
    .map((r) => {
      const o = r.official!;
      if (service === 'delivery') {
        if (metric === 'covers') return { date: r.draft.businessDate, value: null };
        return { date: r.draft.businessDate, value: o.deliveryNet, closed: !r.draft.ran.delivery };
      }
      const s = o.sessions[service];
      return { date: r.draft.businessDate, value: metric === 'net' ? s.net : s.covers, closed: !s.ran };
    });
}
