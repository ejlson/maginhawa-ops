/**
 * Today's checklists for the signed-in site. Available all day, separate from the
 * end-of-day report. Saved on the device as each answer is given.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  EXAMPLE_TEMPLATES, runKey, summariseRun, tasksForDay, taskStatus, tradingDate,
  type AnswerValue, type ChecklistRun, type ChecklistTemplate, type CorrectiveAction, type Task, type TaskStatus,
} from '@maginhawa/core';
import { storage } from './storage';
import { settingsFor } from './draft';
import { now } from './clock';

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
}

const Ctx = createContext<ChecklistsValue | null>(null);

export function ChecklistsProvider({ siteCode, children, templates = EXAMPLE_TEMPLATES }: { siteCode: string; children: ReactNode; templates?: ChecklistTemplate[] }) {
  const settings = useMemo(() => settingsFor(siteCode), [siteCode]);
  const businessDate = tradingDate(now(), settings);
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

  const value = useMemo<ChecklistsValue>(() => ({
    businessDate, tasks, runFor: (k) => runs[k], templateFor, answer, fix, finish,
  }), [businessDate, tasks, runs, templateFor, answer, fix, finish]);
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
    case 'done': return { cls: 'p-ok', text: 'Done' };
    case 'failed': return { cls: 'p-warn', text: 'Done · fixed' };
    case 'late': return { cls: 'p-bad', text: `${-mins} min late` };
    case 'missed': return { cls: 'p-bad', text: 'Missed' };
    case 'due': return { cls: 'p-warn', text: mins <= 0 ? 'Due now' : `Due in ${mins} min` };
    case 'anytime': return { cls: 'p-mut', text: 'When needed' };
    default: return { cls: 'p-mut', text: t.done ? `${t.done} of ${t.total}` : t.dueAt ? t.dueAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : '' };
  }
}

export const isUrgent = (s: TaskStatus) => s === 'late' || s === 'due';
