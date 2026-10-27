/**
 * A site's trading day hour by hour: checklists done, missed and coming up, failed checks and
 * their fixes, repairs reported and fixed, and the EOD's progress. The day runs from day-close
 * to day-close (04:00 to 04:00 by default), so a late close lands on the right day.
 */
import { dayCloseAt, type ChecklistRun, type ChecklistTemplate, type TaskStatus } from './checklists';
import { addDays } from './data-quality';
import { SECTION_LABELS } from './checks';
import type { SectionKey } from './schema';
import type { Repair } from './site-day';
import type { StoredReport } from './store';

export type DayEventKind = 'checklist' | 'missed' | 'due' | 'fix' | 'repair' | 'fixed' | 'eod';
export type DayEventTone = 'ok' | 'warn' | 'bad' | 'mut';
export type DayFilter = 'all' | 'checklists' | 'repairs' | 'eod';

export interface DayEvent {
  /** ISO time. */
  at: string;
  kind: DayEventKind;
  title: string;
  detail?: string;
  by?: string | null;
  tone: DayEventTone;
  /** Where to go for more: a checklist run, repairs, an EOD section. */
  to?: string;
}

export interface TimelineTask {
  key: string;
  title: string;
  dueAt: Date | null;
  status: TaskStatus;
  run?: ChecklistRun;
  template?: Pick<ChecklistTemplate, 'checkpoints'>;
}

export const DAY_FILTERS: { id: DayFilter; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'checklists', label: 'Checklists' },
  { id: 'repairs', label: 'Repairs' },
  { id: 'eod', label: 'EOD' },
];

const FILTER_KINDS: Record<DayFilter, DayEventKind[] | null> = {
  all: null,
  checklists: ['checklist', 'missed', 'due', 'fix'],
  repairs: ['repair', 'fixed'],
  eod: ['eod'],
};

/** The first and last instant of a trading day. */
export function dayBounds(businessDate: string, dayCloseTime: string, timezone: string): { start: Date; end: Date } {
  return { start: dayCloseAt(addDays(businessDate, -1), dayCloseTime, timezone), end: dayCloseAt(businessDate, dayCloseTime, timezone) };
}

/** Finished, missed and upcoming checklists, plus every failed check that was put right. */
export function checklistEvents(tasks: TimelineTask[], runPath: (key: string) => string): DayEvent[] {
  const out: DayEvent[] = [];
  for (const t of tasks) {
    const to = runPath(t.key);
    if (t.run?.completedAt) {
      const fixes = Object.keys(t.run.fixes ?? {}).length;
      out.push({
        at: t.run.completedAt, kind: 'checklist', title: t.title, by: t.run.completedBy, to,
        tone: t.status === 'failed' ? 'warn' : 'ok',
        detail: t.status === 'failed' ? `Done with ${fixes ? `${fixes} ${fixes === 1 ? 'fix' : 'fixes'}` : 'a failed check'}` : 'Done',
      });
    } else if (t.dueAt && t.status === 'missed') {
      out.push({ at: t.dueAt.toISOString(), kind: 'missed', title: t.title, detail: 'Missed', tone: 'bad', to });
    } else if (t.dueAt && (t.status === 'late' || t.status === 'due')) {
      out.push({ at: t.dueAt.toISOString(), kind: 'due', title: t.title, detail: t.status === 'late' ? 'Late, not done yet' : 'Due now', tone: t.status === 'late' ? 'bad' : 'warn', to });
    } else if (t.dueAt && t.status === 'upcoming') {
      out.push({ at: t.dueAt.toISOString(), kind: 'due', title: t.title, detail: 'Coming up', tone: 'mut', to });
    }
    for (const [id, fix] of Object.entries(t.run?.fixes ?? {})) {
      const check = t.template?.checkpoints.find((c) => c.id === id)?.title ?? 'A check';
      out.push({
        at: fix.at, kind: 'fix', title: `${check} failed`, by: t.run?.answeredBy?.[id]?.by ?? t.run?.completedBy, to, tone: 'warn',
        detail: [fix.actions.join(', '), fix.recheckInMinutes ? `re-check in ${fix.recheckInMinutes} min` : '', fix.reportFault ? 'reported for repair' : ''].filter(Boolean).join(' · ') || 'Put right',
      });
    }
  }
  return out;
}

/** Repairs reported or fixed during the day. */
export function repairEvents(repairs: Repair[], start: Date, end: Date): DayEvent[] {
  const inDay = (iso: string | null) => Boolean(iso) && new Date(iso!) >= start && new Date(iso!) < end;
  const out: DayEvent[] = [];
  for (const r of repairs) {
    if (inDay(r.reportedAt)) out.push({ at: r.reportedAt, kind: 'repair', title: r.title, detail: `${r.urgent ? 'Urgent repair' : 'Repair'} reported · ${r.place}`, by: r.reportedBy, tone: r.urgent ? 'bad' : 'warn', to: '/repairs' });
    if (inDay(r.fixedAt)) out.push({ at: r.fixedAt!, kind: 'fixed', title: r.title, detail: 'Fixed', by: r.fixedBy, tone: 'ok', to: '/repairs' });
  }
  return out;
}

/** The last change to each EOD section, and when it was sent. */
export function eodEvents(report: Pick<StoredReport, 'sections' | 'submittedAt' | 'submittedBy' | 'status'> | null): DayEvent[] {
  if (!report) return [];
  const out: DayEvent[] = Object.entries(report.sections ?? {}).map(([k, s]) => ({
    at: s!.at, kind: 'eod' as const, title: `EOD · ${SECTION_LABELS[k as SectionKey]}`, detail: 'Last changed', by: s!.by, tone: 'mut' as const, to: `/close/${k}`,
  }));
  if (report.submittedAt) out.push({ at: report.submittedAt, kind: 'eod', title: 'EOD sent to head office', detail: report.status === 'approved' ? 'Approved' : 'Submitted', by: report.submittedBy, tone: 'ok', to: '/close/done' });
  return out;
}

export interface TimelineHour {
  /** "04:00", local time. */
  label: string;
  start: string;
  past: boolean;
  current: boolean;
  events: DayEvent[];
}

export interface Timeline {
  hours: TimelineHour[];
  done: number;
  missed: number;
  fixes: number;
  repairs: number;
}

/**
 * The day's events in its 24 hours (23 or 25 when the clocks change), each hour in time order.
 * Events outside the day are left out.
 */
export function buildTimeline(events: DayEvent[], bounds: { start: Date; end: Date }, now: Date, timezone: string, filter: DayFilter = 'all'): Timeline {
  const kinds = FILTER_KINDS[filter];
  const shown = events
    .filter((e) => !kinds || kinds.includes(e.kind))
    .filter((e) => { const t = new Date(e.at); return t >= bounds.start && t < bounds.end; })
    .sort((a, b) => a.at.localeCompare(b.at));
  const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const hours: TimelineHour[] = [];
  for (let t = bounds.start.getTime(); t < bounds.end.getTime(); t += 3_600_000) {
    const end = t + 3_600_000;
    hours.push({
      label: hourFmt.format(new Date(t)),
      start: new Date(t).toISOString(),
      past: end <= now.getTime(),
      current: t <= now.getTime() && now.getTime() < end,
      events: shown.filter((e) => { const at = new Date(e.at).getTime(); return at >= t && at < end; }),
    });
  }
  return {
    hours,
    done: shown.filter((e) => e.kind === 'checklist').length,
    missed: shown.filter((e) => e.kind === 'missed').length,
    fixes: shown.filter((e) => e.kind === 'fix').length,
    repairs: shown.filter((e) => e.kind === 'repair').length,
  };
}
