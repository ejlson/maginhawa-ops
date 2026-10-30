/**
 * Any site's trading day, for head office: its checklists (with answers), repairs and EOD, as a
 * list and as timeline events. Reads what's saved on this device. In demo mode, a site with nothing
 * saved here gets made-up activity (done, late, failed-and-fixed, missed) and an example close, so
 * head office can see what a full day looks like. Past days' example closes match Reports and Trends.
 * Once connected, this reads ChecklistRuns, Repairs and EodReports for the site from SharePoint.
 */
import { useMemo } from 'react';
import {
  activeTemplates, addDays, buildRuns, checklistEvents, dayBounds, eodEvents, repairEvents, taskStatus, tasksForDay, tradingDate,
  type AnswerValue, type Checkpoint, type ChecklistRun, type ChecklistTemplate, type DayEvent, type Repair, type SiteSettings,
  type StoredReport, type TaskStatus, type TemplateRecord, type TradingDayRow,
} from '@maginhawa/core';
import { settingsFor } from './draft';
import { deviceChecklistStore, deviceStore } from './store';
import { storage } from './storage';
import { useTemplates } from './templates';
import { showExampleData } from './config';
import { demoReportFromHistory, demoReports } from './demo';
import { demoHash, demoHistory } from './demo-history';
import { now } from './clock';

const PEOPLE = ['Jo', 'Sam', 'Ali', 'Mei', 'Tom', 'Bea'];
const ACTIONS = ['Reheated to 75°C', 'Moved stock to the back-up fridge', 'Re-cleaned and re-checked', 'Called the supplier'];

export interface SiteTask {
  key: string;
  title: string;
  dueAt: Date | null;
  dueTime: string | null;
  status: TaskStatus;
  run: ChecklistRun | undefined;
  template: ChecklistTemplate | undefined;
}

export interface SiteDay {
  siteCode: string;
  businessDate: string;
  settings: SiteSettings;
  bounds: { start: Date; end: Date };
  tasks: SiteTask[];
  report: StoredReport | null;
  events: DayEvent[];
  /** Made-up activity, shown only in demo mode. */
  example: boolean;
}

/** A made-up answer: one that passes, or one that fails for the check that went wrong. */
function exampleAnswer(c: Checkpoint, fail: boolean, date: string, by: string, h: number): AnswerValue {
  switch (c.type) {
    case 'yesno': return fail ? c.failOn === 'yes' : c.failOn !== 'yes';
    case 'temp':
    case 'number': {
      if (fail) return c.max !== undefined ? c.max + 3 : (c.min ?? 0) - 4;
      if (c.min !== undefined && c.max !== undefined) return c.min === c.max ? c.min : Math.round(((c.min + c.max) / 2) * 10) / 10;
      if (c.max !== undefined) return c.max - 2 - (h % 4);
      if (c.min !== undefined) return c.min + 4 + (h % 6);
      return 10;
    }
    case 'choice': return c.multi ? (c.options ?? []).slice(0, 3) : c.options?.[0] ?? null;
    case 'date': return addDays(date, 2);
    case 'sign': return by;
    case 'text': return c.required ? 'All fine' : null;
    default: return null; // Example photos aren't made up.
  }
}

let historyIndex: { lastDate: string; rows: Map<string, TradingDayRow> } | null = null;
function historyRow(siteCode: string, date: string, lastDate: string): TradingDayRow | undefined {
  if (historyIndex?.lastDate !== lastDate) historyIndex = { lastDate, rows: new Map(demoHistory(lastDate).map((r) => [r.siteCode + r.date, r])) };
  return historyIndex.rows.get(siteCode + date);
}

/** One site's trading day. `at` is now; days before today are over, so anything undone shows as missed. */
export function siteDay(records: TemplateRecord[], siteCode: string, businessDate: string, at: Date, example: boolean, repairs?: Repair[]): SiteDay {
  const settings = settingsFor(siteCode);
  const bounds = dayBounds(businessDate, settings.dayCloseTime, settings.timezone);
  const today = tradingDate(at, settings);
  const templates = activeTemplates(records, siteCode, businessDate);
  const saved = deviceChecklistStore().changesNow(siteCode, businessDate, 0);
  const realRuns = buildRuns(saved.runs, saved.answers);
  const base = tasksForDay(templates, Object.values(realRuns), businessDate, settings);
  const fake = example && !Object.keys(realRuns).length && businessDate <= today;

  const tasks = base.map((task): SiteTask => {
    const template = templates.find((t) => t.id === task.templateId);
    let run: ChecklistRun | undefined = realRuns[task.key];
    if (fake && task.dueAt && task.dueAt < at) {
      const h = demoHash(siteCode + task.key);
      if (h % 7 !== 0) {
        const doneAt = new Date(task.dueAt.getTime() + ((h >>> 3) % 40) * 60_000);
        if (doneAt < at) {
          const by = PEOPLE[(h >>> 6) % PEOPLE.length]!;
          const failing = h % 5 === 0 ? template?.checkpoints.find((c) => c.type === 'temp' || c.failOn) : undefined;
          const answers = Object.fromEntries((template?.checkpoints ?? []).map((c) => [c.id, exampleAnswer(c, c === failing, businessDate, by, h)]));
          run = {
            key: task.key, templateId: task.templateId, businessDate, dueTime: task.dueTime, answers, completedAt: doneAt.toISOString(), completedBy: by,
            fixes: failing ? { [failing.id]: { actions: [ACTIONS[(h >>> 9) % ACTIONS.length]!], foodDisposed: false, note: '', recheckInMinutes: 30, reportFault: false, at: new Date(doneAt.getTime() - 4 * 60_000).toISOString() } } : {},
            answeredBy: Object.fromEntries((template?.checkpoints ?? []).map((c, i) => [c.id, { by, at: new Date(doneAt.getTime() - (template!.checkpoints.length - i) * 60_000).toISOString() }])),
          };
        }
      }
    }
    const status = fake && run?.completedAt
      ? (Object.keys(run.fixes).length ? 'failed' as const : 'done' as const)
      : taskStatus(task, run, at, template, businessDate);
    return { key: task.key, title: task.title, dueAt: task.dueAt, dueTime: task.dueTime, status, run, template };
  });

  let report = deviceStore().peek(siteCode, businessDate);
  if (!report && example) {
    if (businessDate === today) report = demoReports(businessDate, new Set()).find((r) => r.draft.siteCode === siteCode) ?? null;
    else if (businessDate < today) {
      const row = historyRow(siteCode, businessDate, addDays(today, -1));
      // Finance approves within a couple of days in the example.
      if (row) report = demoReportFromHistory(row, businessDate < addDays(today, -2));
    }
  }
  const siteRepairs = (repairs ?? storage.get<Repair[]>('mgh.repairs.v1', [])).filter((r) => r.siteCode === siteCode);
  const events = [
    // Head office opens checklists from its own read-only page, not the site's run screen.
    ...checklistEvents(tasks, (key) => `/head-office/${siteCode.toLowerCase()}/${businessDate}/checklists/${encodeURIComponent(key)}`),
    ...repairEvents(siteRepairs, bounds.start, bounds.end),
    ...eodEvents(report).map((e) => ({ ...e, to: `/head-office/${siteCode.toLowerCase()}/${businessDate}/eod` })),
  ];
  return { siteCode, businessDate, settings, bounds, tasks, report, events, example: fake || Boolean(report?.draft.clientId.startsWith('demo-')) };
}

/** Today at the site, or the day given. Recomputes once a minute so late and missed checklists move on. */
export function useSiteDay(siteCode: string, date?: string) {
  const { records } = useTemplates();
  const at = now();
  const minute = Math.floor(at.getTime() / 60_000);
  const example = showExampleData();
  const today = tradingDate(at, settingsFor(siteCode));
  const businessDate = date ?? today;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const day = useMemo(() => siteDay(records, siteCode, businessDate, now(), example), [records, siteCode, businessDate, example, minute]);
  return { ...day, today };
}
