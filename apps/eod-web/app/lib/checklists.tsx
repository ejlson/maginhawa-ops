/**
 * Today's checklists for the signed-in site. Available all day, separate from the
 * end-of-day report. Saved on the device as each answer is given.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  activeTemplates, addDays, PHASE_LABELS, PHASES, runKey, summariseRun, tasksForDay, taskStatus, tradingDate,
  type AnswerValue, type ChecklistRun, type Phase, type ChecklistTemplate, type CorrectiveAction, type Task, type TaskStatus,
} from '@maginhawa/core';
import { storage } from './storage';
import { settingsFor } from './draft';
import { now } from './clock';
import { useTemplates } from './templates';

const keyFor = (siteCode: string, date: string) => `mgh.runs.v1.${siteCode}|${date}`;

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
  finish: (key: string, by: string) => void;
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
  const storeKey = keyFor(siteCode, businessDate);
  const [runs, setRuns] = useState<Record<string, ChecklistRun>>(() => storage.get(storeKey, {}));

  const save = useCallback((change: (r: Record<string, ChecklistRun>) => void) => {
    setRuns((prev) => {
      const next = structuredClone(prev);
      change(next);
      storage.set(storeKey, next);
      return next;
    });
  }, [storeKey]);

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

  const ensure = (r: Record<string, ChecklistRun>, key: string) => {
    if (!r[key]) {
      const task = baseTasks.find((t) => t.key === key);
      r[key] = { key, templateId: task?.templateId ?? '', businessDate, dueTime: task?.dueTime ?? null, answers: {}, fixes: {}, completedAt: null, completedBy: null };
    }
    return r[key]!;
  };

  const answer = useCallback((key: string, checkpointId: string, value: AnswerValue) => {
    save((r) => {
      const run = ensure(r, key);
      if (run.completedAt) return;
      run.answers[checkpointId] = value;
      // A changed answer may no longer fail, so its old fix no longer applies.
      delete run.fixes[checkpointId];
    });
  }, [save, baseTasks, businessDate]);

  const fix = useCallback((key: string, checkpointId: string, action: Omit<CorrectiveAction, 'at'>) => {
    save((r) => {
      const run = ensure(r, key);
      const at = now();
      run.fixes[checkpointId] = { ...action, at: at.toISOString() };
      const rcKey = `${businessDate}|recheck|${key}|${checkpointId}`;
      r[rcKey] = {
        key: rcKey, templateId: run.templateId, businessDate, dueTime: null, answers: {}, fixes: {}, completedAt: null, completedBy: null,
        recheckOf: { runKey: key, checkpointId, dueAt: new Date(at.getTime() + action.recheckInMinutes * 60_000).toISOString() },
      };
    });
  }, [save, baseTasks, businessDate]);

  const finish = useCallback((key: string, by: string) => {
    save((r) => {
      const run = ensure(r, key);
      run.completedAt = now().toISOString();
      run.completedBy = by;
    });
  }, [save, baseTasks, businessDate]);

  const missedYesterday = useMemo(() => {
    const day = addDays(businessDate, -1);
    const used = activeTemplates(records, siteCode, day);
    const old = Object.values(storage.get<Record<string, ChecklistRun>>(keyFor(siteCode, day), {}));
    // Nothing saved at all means this device wasn't in use that day, not that every list was missed.
    if (!old.length) return [];
    const at = now();
    return tasksForDay(used, old, day, settings)
      .filter((t) => !t.recheckOf && taskStatus(t, old.find((r) => r.key === t.key), at, used.find((x) => x.id === t.templateId), day) === 'missed');
  }, [records, siteCode, businessDate, settings]);

  const value = useMemo<ChecklistsValue>(() => ({
    businessDate, tasks, runFor: (k) => runs[k], templateFor, answer, fix, finish, missedYesterday,
  }), [businessDate, tasks, runs, templateFor, answer, fix, finish, missedYesterday]);
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
