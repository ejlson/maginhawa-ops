/**
 * What the home screens show about a site's day: who did which checklist, the last seven days,
 * problems reported for repair, and when the end-of-day report is due. Pure rules, no storage.
 */
import { addDays, weekday, WEEKDAY_NAMES } from './data-quality';
import { dayNet, type TradingDayRow } from './trends';
import type { Pence } from './money';

// ---- who did what ----

export interface DoneItem {
  title: string;
  completedAt: string;
  completedBy: string;
}

export interface PersonDone {
  name: string;
  items: DoneItem[];
}

/** Today's finished checklists grouped by who finished them, busiest first, each in time order. */
export function whoDidWhat(items: DoneItem[]): PersonDone[] {
  const by = new Map<string, DoneItem[]>();
  for (const i of items) by.set(i.completedBy, [...(by.get(i.completedBy) ?? []), i]);
  return [...by]
    .map(([name, list]) => ({ name, items: list.sort((a, b) => a.completedAt.localeCompare(b.completedAt)) }))
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
}

// ---- the last seven days ----

export interface WeekSummary {
  /** Seven days, oldest first. `net` is null for a day with no figures (closed or not sent). */
  days: { date: string; label: string; net: Pence | null }[];
  net: Pence;
  /** Change on the seven days before, as a whole percentage; null if there's nothing to compare. */
  netChange: number | null;
  /** Wages as a % of net, one decimal place; null without wage figures. */
  wagePct: number | null;
  covers: number;
  coversChange: number | null;
}

const pct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

/** The seven trading days up to and including `lastDate` for one site, against the seven before. */
export function lastSevenDays(rows: TradingDayRow[], siteCode: string, lastDate: string): WeekSummary | null {
  const mine = new Map(rows.filter((r) => r.siteCode === siteCode).map((r) => [r.date, r]));
  const dates = Array.from({ length: 7 }, (_, i) => addDays(lastDate, i - 6));
  const before = Array.from({ length: 7 }, (_, i) => addDays(lastDate, i - 13));
  const week = dates.map((d) => mine.get(d)).filter((r): r is TradingDayRow => Boolean(r));
  if (!week.length) return null;
  const prev = before.map((d) => mine.get(d)).filter((r): r is TradingDayRow => Boolean(r));
  const sum = (rs: TradingDayRow[], f: (r: TradingDayRow) => number) => rs.reduce((s, r) => s + f(r), 0);
  const covers = (r: TradingDayRow) => r.covers.lunch + r.covers.dinner;
  const net = sum(week, dayNet);
  const withWages = week.filter((r) => r.wages !== null);
  const wageNet = sum(withWages, dayNet);
  return {
    days: dates.map((date) => ({ date, label: WEEKDAY_NAMES[weekday(date)]!.slice(0, 2), net: mine.has(date) ? dayNet(mine.get(date)!) : null })),
    net,
    netChange: prev.length ? pct(net, sum(prev, dayNet)) : null,
    wagePct: wageNet > 0 ? Math.round((sum(withWages, (r) => r.wages ?? 0) / wageNet) * 1000) / 10 : null,
    covers: sum(week, covers),
    coversChange: prev.length ? pct(sum(week, covers), sum(prev, covers)) : null,
  };
}

// ---- repairs ----

export const REPAIR_PLACES = ['Kitchen', 'Bar', 'Front of house', 'Toilets', 'Outside', 'Other'] as const;
export type RepairPlace = (typeof REPAIR_PLACES)[number];

export interface Repair {
  id: string;
  siteCode: string;
  title: string;
  place: RepairPlace;
  note: string;
  urgent: boolean;
  reportedBy: string;
  reportedAt: string;
  /** Set when it came from a failed checklist item. */
  from?: { runKey: string; checkpointId: string };
  fixedAt: string | null;
  fixedBy: string | null;
}

export function repairIssues(r: Pick<Repair, 'title'>): string[] {
  return r.title.trim() ? [] : ["Say what's wrong"];
}

/** A site's open repairs: urgent first, then oldest first. */
export function openRepairs(all: Repair[], siteCode: string): Repair[] {
  return all
    .filter((r) => r.siteCode === siteCode && !r.fixedAt)
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.reportedAt.localeCompare(b.reportedAt));
}

/** "Reported 22:10 yesterday", "Reported 09:15", "Reported Mon 26 Oct". Times are shown in UK time. */
export function reportedText(reportedAt: string, now: Date): string {
  const tz = 'Europe/London';
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: tz });
  const at = new Date(reportedAt);
  const time = at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz });
  const today = day(now);
  if (day(at) === today) return `Reported ${time}`;
  if (day(at) === addDays(today, -1)) return `Reported ${time} yesterday`;
  return `Reported ${at.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz })}`;
}

// ---- when the end-of-day report is due ----

/**
 * What the EOD card says about the deadline: nothing urgent for most of the day, "Due after close"
 * once the evening starts, then a countdown in the last few hours, orange in the last hour.
 */
export function eodDueText(due: Date, now: Date): { tone: 'none' | 'warn' | 'bad'; text: string } {
  const mins = Math.ceil((due.getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return { tone: 'bad', text: 'Overdue' };
  if (mins > 6 * 60) return { tone: 'none', text: 'Due after close' };
  const h = Math.floor(mins / 60), m = mins % 60;
  return { tone: mins <= 60 ? 'warn' : 'none', text: `Due in ${h ? `${h}h ${m}m` : `${m}m`}` };
}
