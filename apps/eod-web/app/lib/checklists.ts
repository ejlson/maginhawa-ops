/**
 * Today's checklists for the signed-in site. Available all day, separate from the
 * end-of-day report. Several people can work on the same list at once: each answer is
 * its own record, shared live between devices (ChecklistSyncClient in @maginhawa/core).
 */
import { createContext, useContext } from 'react';
import {
  PHASE_LABELS, PHASES, type AnswerValue, type ChecklistRun, type ChecklistSyncState, type FinishOutcome, type Phase, type ChecklistTemplate, type CorrectiveAction, type Task, type TaskStatus,
} from '@maginhawa/core';
import { now } from './clock';

export interface TaskView extends Task {
  status: TaskStatus;
  template: ChecklistTemplate;
  run: ChecklistRun | undefined;
  done: number;
  total: number;
  /** Everything answered and every failure dealt with, but not submitted yet. */
  ready: boolean;
}

export interface ChecklistsValue {
  businessDate: string;
  tasks: TaskView[];
  runFor: (key: string) => ChecklistRun | undefined;
  templateFor: (key: string) => ChecklistTemplate | undefined;
  answer: (key: string, checkpointId: string, value: AnswerValue) => void;
  fix: (key: string, checkpointId: string, action: Omit<CorrectiveAction, 'at'>) => void;
  /** A second Finish (someone got there first) is a no-op; the outcome says who finished. */
  finish: (key: string, by?: string) => Promise<FinishOutcome>;
  /** The one Submit under the lists: locks every list that's ready. Says what happened to each. */
  submitReady: () => Promise<{ title: string; outcome: FinishOutcome }[]>;
  /** Change an answer on a finished list. Supervisors and above; the old answer is kept. */
  correct: (key: string, checkpointId: string, value: AnswerValue, reason: string) => void;
  /** Saving, offline, who else is here. */
  sync: ChecklistSyncState;
  setWhere: (where: string | null) => void;
  /** Clears the "not saved" messages for one list once the person has read them. */
  dismissRefused: (key: string) => void;
  /** Lists from the last trading day that were never done. */
  missedYesterday: Task[];
}

export const Ctx = createContext<ChecklistsValue | null>(null);

export function useChecklists(): ChecklistsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useChecklists must be used inside ChecklistsProvider');
  return v;
}

export const runPath = (key: string) => `/checklists/${encodeURIComponent(key)}`;

export function statusPill(t: Pick<TaskView, 'status' | 'dueAt' | 'done' | 'total'> & { ready?: boolean }, at = now()): { cls: string; text: string } {
  if (t.ready) return { cls: 'p-mut', text: 'Ready to submit' };
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
