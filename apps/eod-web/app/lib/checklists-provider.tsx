import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  activeTemplates, addDays, buildRuns, ChecklistSyncClient, runKey, summariseRun, tasksForDay, taskStatus, tradingDate, type AnswerValue, type ChecklistRun, type FinishOutcome, type ChecklistTemplate, type CorrectiveAction, type RunStart,
} from '@maginhawa/core';
import { storage } from './storage';
import { settingsFor } from './draft';
import { now } from './clock';
import { useTemplates } from './templates';
import { useAuth } from './auth';
import { batchDelayMs, checklistBackend, deviceId, presenceRemote, useLive } from './sync';
import { usesServer } from './config';
import { deviceChecklistStore } from './store';
import { type TaskView, type ChecklistsValue, Ctx } from './checklists';

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
    initial: usesServer() ? undefined : deviceChecklistStore().changesNow(siteCode, businessDate, 0),
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
      return { ...task, template, run, status: taskStatus(task, run, at, template, businessDate), done: s?.answered ?? 0, total: template.checkpoints.length, ready: Boolean(run && !run.completedAt && s?.canFinish) };
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
  const submitReady = useCallback(async () => {
    const ready = tasks.filter((t) => t.ready);
    // One at a time, so each list is locked by its own conditional update.
    const out: { title: string; outcome: FinishOutcome }[] = [];
    for (const t of ready) out.push({ title: t.title, outcome: await client.finish(startOf(t.key)) });
    return out;
  }, [client, startOf, tasks]);
  const correct = useCallback((key: string, checkpointId: string, value: AnswerValue, reason: string) => {
    void client.correct(startOf(key), checkpointId, value, reason);
  }, [client, startOf]);
  const setWhere = useCallback((where: string | null) => client.setWhere(where), [client]);
  const dismissRefused = useCallback((key: string) => client.dismissRefused(key), [client]);

  // Yesterday's runs: read straight away in demo mode, fetched once in connected mode.
  const yesterday = addDays(businessDate, -1);
  const [oldRuns, setOldRuns] = useState<ChecklistRun[]>(() => {
    if (usesServer()) return [];
    const c = deviceChecklistStore().changesNow(siteCode, yesterday, 0);
    return Object.values(buildRuns(c.runs, c.answers));
  });
  useEffect(() => {
    if (!usesServer()) return;
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
    businessDate, tasks, runFor: (k) => runs[k], templateFor, answer, fix, finish, submitReady, correct, sync, setWhere, dismissRefused, missedYesterday,
  }), [businessDate, tasks, runs, templateFor, answer, fix, finish, submitReady, correct, sync, setWhere, dismissRefused, missedYesterday]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
