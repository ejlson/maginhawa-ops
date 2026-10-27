/**
 * Nightly records the forecast depends on and that can't be rebuilt later:
 * covers on the books for the next 14 days, and every forecast as it was shown.
 * Kept in SharePoint (BookingSnapshots, ForecastLog in docs/tech-plan/sharepoint).
 */
import { addDays, daysBetween, weekday, type Metric, type Service } from './data-quality';
import type { BookingPickup, ForecastPoint } from './forecast';

export type BookedSession = 'lunch' | 'dinner';

export interface BookingSnapshot {
  siteCode: string;
  /** Trading day the snapshot was taken, after close. */
  takenOn: string;
  forDate: string;
  leadDays: number;
  session: BookedSession;
  covers: number;
  bookings: number;
  source: string;
}

export const snapshotKey = (s: Pick<BookingSnapshot, 'siteCode' | 'takenOn' | 'forDate' | 'session'>) =>
  `${s.siteCode}|${s.takenOn}|${s.forDate}|${s.session}`;

export type ForecastMethodName = 'v1' | 'holt-winters' | 'same-weekday-last-week';

export interface ForecastLogEntry {
  siteCode: string;
  madeOn: string;
  forDate: string;
  horizon: number;
  service: Service;
  metric: Metric;
  method: ForecastMethodName;
  version: string;
  p50: number;
  p10: number | null;
  p90: number | null;
  confidence: ForecastPoint['confidence'];
  reasons: string;
}

export const forecastKey = (e: Pick<ForecastLogEntry, 'siteCode' | 'madeOn' | 'forDate' | 'service' | 'metric' | 'method'>) =>
  `${e.siteCode}|${e.madeOn}|${e.forDate}|${e.service}|${e.metric}|${e.method}`;

/** What a reservations system returns for one day and session. */
export interface BookedDay { date: string; session: BookedSession; covers: number; bookings: number }

/** Turns a reservations system's answer into snapshot rows for days 1–14 after `takenOn`. */
export function toSnapshots(siteCode: string, takenOn: string, days: BookedDay[], source: string, horizon = 14): BookingSnapshot[] {
  const last = addDays(takenOn, horizon);
  return days
    .filter((d) => d.date > takenOn && d.date <= last && d.covers >= 0)
    .map((d) => ({ siteCode, takenOn, forDate: d.date, leadDays: daysBetween(takenOn, d.date), session: d.session, covers: Math.round(d.covers), bookings: Math.round(d.bookings), source }));
}

/** Pairs past snapshots with the covers that actually came, for the pickup forecast. */
export function pickupHistory(snapshots: BookingSnapshot[], finalCovers: Map<string, number>, session: BookedSession): BookingPickup[] {
  return snapshots
    .filter((s) => s.session === session && finalCovers.has(s.forDate))
    .map((s) => ({ weekday: weekday(s.forDate), leadDays: s.leadDays, booked: s.covers, final: finalCovers.get(s.forDate)! }));
}

/** Store for the two nightly records. The SharePoint version comes with the Graph connection. */
export interface ForecastStore {
  saveSnapshots(rows: BookingSnapshot[]): Promise<void>;
  listSnapshots(siteCode: string): Promise<BookingSnapshot[]>;
  saveForecasts(rows: ForecastLogEntry[]): Promise<void>;
  listForecasts(siteCode: string): Promise<ForecastLogEntry[]>;
}

/** In-memory store for tests and demo mode. Saving the same key twice replaces it (safe to re-run a night). */
export class MemoryForecastStore implements ForecastStore {
  private snaps = new Map<string, BookingSnapshot>();
  private logs = new Map<string, ForecastLogEntry>();
  async saveSnapshots(rows: BookingSnapshot[]) { for (const r of rows) this.snaps.set(snapshotKey(r), { ...r }); }
  async listSnapshots(siteCode: string) { return [...this.snaps.values()].filter((s) => s.siteCode === siteCode); }
  async saveForecasts(rows: ForecastLogEntry[]) { for (const r of rows) this.logs.set(forecastKey(r), { ...r }); }
  async listForecasts(siteCode: string) { return [...this.logs.values()].filter((s) => s.siteCode === siteCode); }
}

/** Bank holidays from https://www.gov.uk/bank-holidays.json for one part of the UK. */
export function parseGovUkBankHolidays(json: unknown, division: 'england-and-wales' | 'scotland' | 'northern-ireland' = 'england-and-wales'): Set<string> {
  const events = (json as Record<string, { events?: { date?: unknown }[] }> | null)?.[division]?.events ?? [];
  return new Set(events.map((e) => e.date).filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)));
}
