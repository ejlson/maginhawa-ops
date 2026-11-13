/**
 * Health and safety beyond food (docs/reports/next-modules-scope.md §1) and planned maintenance (§2).
 * Rules marked (check) come from UK law or guidance as we understand it; confirm with a health and
 * safety consultant or the insurer before launch.
 */
import { addDays, daysBetween, weekday } from './data-quality';

// ── Health and safety checks ──────────────────────────────────────────

export type SafetyCheckKind = 'fire-alarm' | 'emergency-lights' | 'extinguishers' | 'first-aid';

export const SAFETY_CHECKS: Record<SafetyCheckKind, { title: string; sub: string; every: 'week' | 'month' }> = {
  'fire-alarm': { title: 'Fire alarm test', sub: 'One call point a week', every: 'week' },
  'emergency-lights': { title: 'Emergency lights', sub: 'Flick test, every light', every: 'month' },
  extinguishers: { title: 'Fire extinguishers', sub: 'In place, pin in, gauge green', every: 'month' },
  'first-aid': { title: 'First aid kit', sub: 'Stocked and in date', every: 'month' },
};

export interface SafetyCheck {
  id: string;
  siteCode: string;
  kind: SafetyCheckKind;
  businessDate: string;
  at: string;
  by: string;
  /** Fire alarm: which call point was used. */
  callPoint?: string;
  answers: { q: string; yes: boolean }[];
}

export const passed = (c: Pick<SafetyCheck, 'answers'>) => c.answers.every((a) => a.yes);

/** Monday of the week a date is in. */
export const weekStart = (date: string) => addDays(date, -((weekday(date) + 6) % 7));

/** When this period's check is due by: Sunday for weekly checks, the last day of the month for monthly. */
export function dueBy(kind: SafetyCheckKind, today: string): string {
  if (SAFETY_CHECKS[kind].every === 'week') return addDays(weekStart(today), 6);
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return addDays(d.toISOString().slice(0, 10), -1);
}

/** The check done in this period at this site, if any. */
export function doneThisPeriod(kind: SafetyCheckKind, checks: SafetyCheck[], siteCode: string, today: string): SafetyCheck | null {
  const from = SAFETY_CHECKS[kind].every === 'week' ? weekStart(today) : `${today.slice(0, 7)}-01`;
  return checks.filter((c) => c.siteCode === siteCode && c.kind === kind && c.businessDate >= from && c.businessDate <= today)
    .sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
}

/** Call points take turns, one a week, so every one is tested in rotation. */
export const callPointFor = (points: string[], today: string) => points[Math.floor(daysBetween('2026-01-05', weekStart(today)) / 7) % points.length] ?? '';

// ── Accidents ─────────────────────────────────────────────────────────

export const ACCIDENT_WHO = ['Staff', 'Guest', 'Contractor', 'Someone else'] as const;
export const ACCIDENT_WHAT = ['Slip or trip', 'Cut', 'Burn', 'Lifting', 'Hit by something', 'Other'] as const;
export const ACCIDENT_WHERE = ['Hand', 'Arm', 'Head', 'Back', 'Leg or foot', 'Other'] as const;
export const FIRST_AID = ['Yes, plaster', 'Yes, other', 'No'] as const;

export interface Accident {
  id: string;
  siteCode: string;
  businessDate: string;
  at: string;
  who: (typeof ACCIDENT_WHO)[number];
  name: string;
  what: (typeof ACCIDENT_WHAT)[number];
  detail: string;
  injury: (typeof ACCIDENT_WHERE)[number];
  firstAid: (typeof FIRST_AID)[number];
  reportedBy: string;
  /** Set by a manager: days off work, or unable to do their normal job, so far. */
  daysOff: number | null;
  /** When the HSE report was made, and its reference. */
  hse: { at: string; ref: string } | null;
}

/** RIDDOR 2013 (check): a worker off or on light duties for more than 7 days must be reported within 15 days of the accident. */
export const RIDDOR_DAYS_OFF = 7;
export const RIDDOR_DEADLINE_DAYS = 15;

export type AccidentState =
  | { kind: 'check'; on: string }          // manager asked how they are after a week
  | { kind: 'report'; by: string; late: boolean }
  | { kind: 'reported' }
  | { kind: 'closed' };

export function accidentState(a: Accident, today: string): AccidentState {
  if (a.hse) return { kind: 'reported' };
  const worker = a.who === 'Staff' || a.who === 'Contractor';
  if (worker && a.daysOff !== null && a.daysOff > RIDDOR_DAYS_OFF) {
    const by = addDays(a.businessDate, RIDDOR_DEADLINE_DAYS);
    return { kind: 'report', by, late: today > by };
  }
  if (a.daysOff === null && daysBetween(a.businessDate, today) < 30) return { kind: 'check', on: addDays(a.businessDate, 7) };
  return { kind: 'closed' };
}

// ── Planned maintenance ───────────────────────────────────────────────

export interface Equipment { id: string; siteCode: string; name: string; make: string; serial: string; contractor: string }

export interface ServiceSchedule {
  id: string;
  siteCode: string;
  name: string;
  /** "Gas", "Extraction"…: the column head office sees. */
  kind: string;
  everyMonths: number;
  contractor: string;
  equipmentId?: string;
  /** Before the app: when it was last done. */
  lastDone: string;
  booked: string | null;
}

export type VisitResult = 'Passed' | 'Passed with advice' | 'Failed';

export interface ServiceVisit {
  id: string;
  scheduleId: string;
  businessDate: string;
  result: VisitResult;
  /** File name of the certificate (demo mode keeps the name only). */
  certificate: string | null;
  by: string;
  at: string;
}

export function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

export function lastDone(s: ServiceSchedule, visits: ServiceVisit[]): string {
  const mine = visits.filter((v) => v.scheduleId === s.id && v.result !== 'Failed').map((v) => v.businessDate).sort();
  return mine[mine.length - 1] ?? s.lastDone;
}

export const serviceNextDue = (s: ServiceSchedule, visits: ServiceVisit[]) => addMonths(lastDone(s, visits), s.everyMonths);

export type DueStatus = 'overdue' | 'soon' | 'ok';

/** Overdue once the date has passed; "soon" within 30 days, when reminders start. */
export function dueStatus(due: string, today: string): DueStatus {
  if (due < today) return 'overdue';
  return daysBetween(today, due) <= 30 ? 'soon' : 'ok';
}

/** 3 or more call-outs in 6 months: worth asking about a replacement. */
export function keepsBreaking(callOutDates: string[], today: string): boolean {
  const from = addMonths(today, -6);
  return callOutDates.filter((d) => d >= from && d <= today).length >= 3;
}
