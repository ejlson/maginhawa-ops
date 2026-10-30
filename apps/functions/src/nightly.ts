/**
 * The two nightly jobs, run after the trading day closes. Like the submit handler, every outside
 * service is passed in, so the jobs are fully testable and the real ones plug in later.
 *
 *  nightly-snapshot: saves covers on the books for the next 14 days. Must run from day one: last
 *                    night's bookings can never be fetched again, and the pickup forecast needs them.
 *  nightly-forecast: cleans each series, forecasts it with v1 plus the two comparison methods, and
 *                    logs every forecast so accuracy can be measured on what was really shown.
 */
import {
  addDays, cleanSeries, FORECAST_VERSION, forecastV1, groupWeekdayIndex, holtWinters, pickupHistory, profileSeries,
  seasonalNaive, toSnapshots, tradingDate, type BookedDay, type CleanDay, type DayValue, type ForecastLogEntry,
  type ForecastMethodName, type ForecastPoint, type ForecastStore, type Metric, type ResidualBank, type Service,
  type SiteSettings,
} from '@maginhawa/core';

export interface NightlyDeps {
  sites: () => Promise<SiteSettings[]>;
  store: ForecastStore;
  now?: () => Date;
}

export interface SnapshotDeps extends NightlyDeps {
  /** Reads the site's reservations system. Null = this site isn't connected to one yet. */
  bookingsFor: (siteCode: string, from: string, to: string) => Promise<{ days: BookedDay[]; source: string } | null>;
}

export interface SnapshotResult { takenOn: Record<string, string>; saved: number; notConnected: string[]; failed: { siteCode: string; error: string }[] }

export function createSnapshotJob(deps: SnapshotDeps) {
  return async (): Promise<SnapshotResult> => {
    const result: SnapshotResult = { takenOn: {}, saved: 0, notConnected: [], failed: [] };
    for (const site of await deps.sites()) {
      // The trading day that has just closed, in the site's own time.
      const takenOn = previousTradingDay(deps.now?.() ?? new Date(), site);
      result.takenOn[site.siteCode] = takenOn;
      try {
        const res = await deps.bookingsFor(site.siteCode, addDays(takenOn, 1), addDays(takenOn, 14));
        if (!res) { result.notConnected.push(site.siteCode); continue; }
        const rows = toSnapshots(site.siteCode, takenOn, res.days, res.source);
        await deps.store.saveSnapshots(rows);
        result.saved += rows.length;
      } catch (e) {
        // One site's reservations system being down mustn't stop the others.
        result.failed.push({ siteCode: site.siteCode, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return result;
  };
}

export interface ForecastDeps extends NightlyDeps {
  /** The site's daily history for a service and metric (official figures from submitted EODs). */
  historyFor: (siteCode: string, service: Service, metric: Metric) => Promise<DayValue[]>;
  /** England and Wales bank holidays (gov.uk), as yyyy-mm-dd. */
  holidays: () => Promise<Set<string>>;
}

export const SERIES: { service: Service; metric: Metric }[] = [
  { service: 'lunch', metric: 'net' }, { service: 'lunch', metric: 'covers' },
  { service: 'dinner', metric: 'net' }, { service: 'dinner', metric: 'covers' },
  { service: 'delivery', metric: 'net' },
];

export interface ForecastResult {
  logged: number;
  /** Series skipped because the history isn't ready, with the reason. */
  skipped: { siteCode: string; service: Service; metric: Metric; reason: string }[];
}

export function createForecastJob(deps: ForecastDeps) {
  return async (): Promise<ForecastResult> => {
    const holidays = await deps.holidays();
    const sites = await deps.sites();
    const result: ForecastResult = { logged: 0, skipped: [] };

    // Clean everything first, so new sites can borrow the group's weekday pattern.
    const cleaned = new Map<string, CleanDay[]>();
    for (const site of sites) for (const s of SERIES) {
      cleaned.set(key(site.siteCode, s.service, s.metric), cleanSeries(await deps.historyFor(site.siteCode, s.service, s.metric), { holidays }));
    }

    for (const site of sites) {
      const madeOn = previousTradingDay(deps.now?.() ?? new Date(), site);
      const [snapshots, past] = await Promise.all([deps.store.listSnapshots(site.siteCode), deps.store.listForecasts(site.siteCode)]);
      const rows: ForecastLogEntry[] = [];

      for (const s of SERIES) {
        const clean = cleaned.get(key(site.siteCode, s.service, s.metric))!;
        const profile = profileSeries(clean);
        if (profile.readiness === 'not-enough') {
          result.skipped.push({ ...s, siteCode: site.siteCode, reason: `${profile.usableDays} usable days; needs 21` });
          continue;
        }
        // Forecasts start from the last trading day, even if it hasn't been submitted yet.
        const series = extendTo(clean, madeOn);
        const group = groupWeekdayIndex(sites.map((o) => cleaned.get(key(o.siteCode, s.service, s.metric))!).filter((c) => c.length));
        const bookings = s.metric === 'covers' && s.service !== 'delivery' ? bookingsOn(snapshots, madeOn, s.service) : undefined;
        const finals = new Map(clean.filter((c) => c.value !== null).map((c) => [c.date, c.value!]));
        const pickup = bookings && s.service !== 'delivery' ? pickupHistory(snapshots, finals, s.service) : undefined;

        const residuals = residualsFrom(past, finals, s.service, s.metric);
        const v1 = forecastV1(series, madeOn, { holidays, groupWeekdayIndex: group, residuals, bookings, pickupHistory: pickup });
        rows.push(...entries(site.siteCode, madeOn, s.service, s.metric, 'v1', v1));
        rows.push(...entries(site.siteCode, madeOn, s.service, s.metric, 'holt-winters', holtWinters(series, madeOn)));
        rows.push(...entries(site.siteCode, madeOn, s.service, s.metric, 'same-weekday-last-week', seasonalNaive(series, madeOn)));
      }
      await deps.store.saveForecasts(rows);
      result.logged += rows.length;
    }
    return result;
  };
}

// ---- helpers ----

const key = (siteCode: string, service: Service, metric: Metric) => `${siteCode}|${service}|${metric}`;

/** The jobs run after the day-close time, when a new trading day has begun: the one that just finished is the day before. */
function previousTradingDay(now: Date, site: SiteSettings): string {
  return addDays(tradingDate(now, site), -1);
}

/** Pads the cleaned history with empty days up to the forecast origin. */
function extendTo(clean: CleanDay[], origin: string): CleanDay[] {
  const out = [...clean];
  let last = out[out.length - 1]?.date;
  while (last && last < origin) {
    last = addDays(last, 1);
    out.push({ date: last, raw: null, value: null, flags: ['missing'] });
  }
  return out;
}

function bookingsOn(snapshots: Awaited<ReturnType<ForecastStore['listSnapshots']>>, takenOn: string, session: 'lunch' | 'dinner') {
  const tonight = snapshots.filter((s) => s.takenOn === takenOn && s.session === session);
  return tonight.length ? new Map(tonight.map((s) => [s.forDate, s.covers])) : undefined;
}

/** Past v1 misses at each horizon, from what was really logged and what really happened. */
function residualsFrom(past: ForecastLogEntry[], finals: Map<string, number>, service: Service, metric: Metric): ResidualBank {
  const bank: ResidualBank = new Map();
  const mine = past
    .filter((p) => p.method === 'v1' && p.service === service && p.metric === metric && finals.has(p.forDate) && p.p50 > 0)
    .sort((a, b) => a.forDate.localeCompare(b.forDate));
  for (const p of mine) {
    const list = bank.get(p.horizon) ?? [];
    list.push(Math.log(finals.get(p.forDate)! / p.p50));
    if (list.length > 56) list.shift();
    bank.set(p.horizon, list);
  }
  return bank;
}

function entries(siteCode: string, madeOn: string, service: Service, metric: Metric, method: ForecastMethodName, points: ForecastPoint[]): ForecastLogEntry[] {
  return points.map((p) => ({
    siteCode, madeOn, forDate: p.date, horizon: p.horizon, service, metric, method, version: FORECAST_VERSION,
    p50: Math.round(p.p50), p10: p.p10 === null ? null : Math.round(p.p10), p90: p.p90 === null ? null : Math.round(p.p90),
    confidence: p.confidence, reasons: p.reasons.join(' · '),
  }));
}
