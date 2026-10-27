/**
 * Today's checklists for the signed-in site. Available all day, separate from the
 * end-of-day report. Several people can work on the same list at once: each answer is
 * its own record, shared live between devices (ChecklistSyncClient in @maginhawa/core).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  activeTemplates, addDays, buildRuns, ChecklistSyncClient, PHASE_LABELS, PHASES, runKey, summariseRun, tasksForDay, taskStatus, tradingDate,
  type AnswerValue, type ChecklistRun, type ChecklistSyncState, type FinishOutcome, type Phase, type ChecklistTemplate, type CorrectiveAction, type RunStart, type Task, type TaskStatus,
} from '@maginhawa/core';
import { storage } from './storage';
import { settingsFor } from './draft';
import { now } from './clock';
import { useTemplates } from './templates';
import { useAuth } from './auth';
import { batchDelayMs, checklistBackend, deviceId, presenceRemote, useLive } from './sync';
import { isConnected } from './config';
import { deviceChecklistStore } from './store';

export interface TaskView extends Task {
  status: TaskStatus;
  template: ChecklistTemplate;
  run: ChecklistRun | undefined;
  done: number;
  total: number;
}

interface ChecklistsValue {
  businessDate: string;
  tasks: TaskView[];
  runFor: (key: string) => ChecklistRun | undefined;
  templateFor: (key: string) => ChecklistTemplate | undefined;
  answer: (key: string, checkpointId: string, value: AnswerValue) => void;
  fix: (key: string, checkpointId: string, action: Omit<CorrectiveAction, 'at'>) => void;
  /** A second Finish (someone got there first) is a no-op; the outcome says who finished. */
  finish: (key: string, by?: string) => Promise<FinishOutcome>;
  /** Change an answer on a finished list. Supervisors and above; the old answer is kept. */
  correct: (key: string, checkpointId: string, value: AnswerValue, reason: string) => void;
  /** Saving, offline, who else is here. */
  sync: ChecklistSyncState;
  setWhere: (where: string | null) => void;
  /** Lists from the last trading day that were never done. */
  missedYesterday: Task[];
}

const Ctx = createContext<ChecklistsValue | null>(null);

/** Runs today's published lists for the site. Changes made in the builder start the next trading day. */
export function ChecklistsProvider({ siteCode, children }: { siteCode: string; children: ReactNode }) {
  const settings = useMemo(() => settingsFor(siteCode), [siteCode]);
  const businessDate = tradingDate(now(), settings);
  const { records } = useTemplates();
  const templates = useMemo(() => activeTemplates(records, siteCode, businessDate), [records, siteCode, businessDate]);
  const { user } = useAuth();
  const who = user?.name ?? 'Manager';
  const client = useMemo(() => new ChecklistSyncClient({
    backend: checklistBackend(), siteCode, businessDate, user: who, deviceId: deviceId(),
    storage, presence: presenceRemote(), now, batchDelayMs: batchDelayMs(),
    // Demo mode: the "server" is on this device, so today's answers can show straight away.
    initial: isConnected() ? undefined : deviceChecklistStore().changesNow(siteCode, businessDate, 0),
  }), [siteCode, businessDate, who]);
  useLive(client, `checklists:${siteCode}|${businessDate}`);
  const sync = useSyncExternalStore(client.subscribe, client.getState, client.getState);
  const runs = sync.runs;

  const baseTasks = useMemo(() => tasksForDay(templates, Object.values(runs), businessDate, settings), [templates, runs, businessDate, settings]);

  /** A re-check only asks the one item again. */
  const templateFor = useCallback((key: string): ChecklistTemplate | undefined => {
    const task = baseTasks.find((t) => t.key === key);
    const t = templates.find((x) => x.id === (task?.templateId ?? runs[key]?.templateId));
    if (!t) return undefined;
    const rc = task?.recheckOf ?? runs[key]?.recheckOf;
    return rc ? { ...t, title: task?.title ?? t.title, checkpoints: t.checkpoints.filter((c) => c.id === rc.checkpointId).map((c) => ({ ...c, faultOnFail: false })) } : t;
  }, [baseTasks, templates, runs]);

  const tasks: TaskView[] = useMemo(() => {
    const at = now();
    return baseTasks.map((task) => {
      const template = templateFor(task.key)!;
      const run = runs[task.key];
      const s = run ? summariseRun(template, run, businessDate) : null;
      return { ...task, template, run, status: taskStatus(task, run, at, template, businessDate), done: s?.answered ?? 0, total: template.checkpoints.length };
    });
  }, [baseTasks, runs, templateFor, businessDate]);

  const startOf = useCallback((key: string): RunStart => {
    const task = baseTasks.find((t) => t.key === key);
    const run = runs[key];
    return { key, templateId: task?.templateId ?? run?.templateId ?? '', businessDate, dueTime: task?.dueTime ?? run?.dueTime ?? null, ...(task?.recheckOf ?? run?.recheckOf ? { recheckOf: task?.recheckOf ?? run?.recheckOf } : {}) };
  }, [baseTasks, runs, businessDate]);

  const answer = useCallback((key: string, checkpointId: string, value: AnswerValue) => {
    void client.answer(startOf(key), checkpointId, value);
  }, [client, startOf]);

  const fix = useCallback((key: string, checkpointId: string, action: Omit<CorrectiveAction, 'at'>) => {
    const run = startOf(key);
    void client.fix(run, checkpointId, action, (at) => ({
      key: `${businessDate}|recheck|${key}|${checkpointId}`, templateId: run.templateId, businessDate, dueTime: null,
      recheckOf: { runKey: key, checkpointId, dueAt: new Date(at.getTime() + action.recheckInMinutes * 60_000).toISOString() },
    }));
  }, [client, startOf, businessDate]);

  const finish = useCallback((key: string) => client.finish(startOf(key)), [client, startOf]);
  const correct = useCallback((key: string, checkpointId: string, value: AnswerValue, reason: string) => {
    void client.correct(startOf(key), checkpointId, value, reason);
  }, [client, startOf]);
  const setWhere = useCallback((where: string | null) => client.setWhere(where), [client]);

  // Yesterday's runs: read straight away in demo mode, fetched once in connected mode.
  const yesterday = addDays(businessDate, -1);
  const [oldRuns, setOldRuns] = useState<ChecklistRun[]>(() => {
    if (isConnected()) return [];
    const c = deviceChecklistStore().changesNow(siteCode, yesterday, 0);
    return Object.values(buildRuns(c.runs, c.answers));
  });
  useEffect(() => {
    if (!isConnected()) return;
    let live = true;
    checklistBackend().changes(siteCode, yesterday, 0)
      .then((c) => { if (live) setOldRuns(Object.values(buildRuns(c.runs, c.answers))); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [siteCode, yesterday]);

  const missedYesterday = useMemo(() => {
    const used = activeTemplates(records, siteCode, yesterday);
    // Nothing saved at all means nobody used the app that day, not that every list was missed.
    if (!oldRuns.length) return [];
    const at = now();
    return tasksForDay(used, oldRuns, yesterday, settings)
      .filter((t) => !t.recheckOf && taskStatus(t, oldRuns.find((r) => r.key === t.key), at, used.find((x) => x.id === t.templateId), yesterday) === 'missed');
  }, [records, siteCode, yesterday, settings, oldRuns]);

  const value = useMemo<ChecklistsValue>(() => ({
    businessDate, tasks, runFor: (k) => runs[k], templateFor, answer, fix, finish, correct, sync, setWhere, missedYesterday,
  }), [businessDate, tasks, runs, templateFor, answer, fix, finish, correct, sync, setWhere, missedYesterday]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChecklists(): ChecklistsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useChecklists must be used inside ChecklistsProvider');
  return v;
}

export const runPath = (key: string) => `/checklists/${encodeURIComponent(key)}`;

export function statusPill(t: Pick<TaskView, 'status' | 'dueAt' | 'done' | 'total'>, at = now()): { cls: string; text: string } {
  const mins = t.dueAt ? Math.round((t.dueAt.getTime() - at.getTime()) / 60_000) : 0;
  switch (t.status) {
    case 'done': return { cls: 'p-ok', text: 'Completed' };
    case 'failed': return { cls: 'p-warn', text: 'Completed · fixed' };
    case 'late': return { cls: 'p-bad', text: `${-mins} min late` };
    case 'missed': return { cls: 'p-bad', text: 'Missed' };
    case 'due': return { cls: 'p-warn', text: mins <= 0 ? 'Due now' : `Due in ${mins} min` };
    case 'anytime': return { cls: 'p-mut', text: 'When needed' };
    default: return { cls: 'p-mut', text: t.done ? `${t.done} of ${t.total}` : t.dueAt ? t.dueAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : '' };
  }
}

export const isUrgent = (s: TaskStatus) => s === 'late' || s === 'due';

export interface PhaseSummary {
  phase: Phase;
  label: string;
  tasks: TaskView[];
  scheduled: TaskView[];
  done: number;
  /** The task to show the status of: the most urgent, else the next one, else the last done. */
  lead: TaskView | undefined;
  status: 'done' | 'started' | 'todo';
  /** Where a tap goes: straight into the list if there's only one. */
  to: string;
}

/** Groups today's lists into opening, mid-shift and closing for the home screen. */
export function phaseSummaries(tasks: TaskView[]): PhaseSummary[] {
  return PHASES.map((phase) => {
    const mine = tasks.filter((t) => t.template.phase === phase);
    const scheduled = mine.filter((t) => t.status !== 'anytime');
    const done = scheduled.filter((t) => t.status === 'done' || t.status === 'failed').length;
    const order: TaskView['status'][] = ['late', 'due', 'missed', 'upcoming'];
    const lead = order.map((s) => scheduled.find((t) => t.status === s)).find(Boolean) ?? scheduled[scheduled.length - 1];
    const status: PhaseSummary['status'] = scheduled.length > 0 && done === scheduled.length ? 'done' : done > 0 || mine.some((t) => t.done > 0) ? 'started' : 'todo';
    const to = scheduled.length === 1 && mine.length === 1 ? runPath(scheduled[0]!.key) : `/checklists?phase=${phase}`;
    return { phase, label: PHASE_LABELS[phase], tasks: mine, scheduled, done, lead, status, to };
  }).filter((p) => p.tasks.length > 0);
}
