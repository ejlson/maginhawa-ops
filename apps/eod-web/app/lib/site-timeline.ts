/**
 * Any site's trading day as timeline events, for head office. Reads that site's checklists, repairs
 * and EOD from this device. In demo mode, a site with nothing saved here gets made-up activity
 * (done, late, failed-and-fixed, missed) so head office can see what a full day looks like.
 * Once connected, this reads ChecklistRuns, Repairs and EodReports for the site from SharePoint.
 */
import { useMemo } from 'react';
import {
  activeTemplates, buildRuns, checklistEvents, dayBounds, eodEvents, repairEvents, taskStatus, tasksForDay, tradingDate,
  type ChecklistRun, type DayEvent, type Repair,
} from '@maginhawa/core';
import { settingsFor } from './draft';
import { deviceChecklistStore, deviceStore } from './store';
import { storage } from './storage';
import { useTemplates } from './templates';
import { showExampleData } from './config';
import { demoReports } from './demo';
import { now } from './clock';

const PEOPLE = ['Jo', 'Sam', 'Ali', 'Mei', 'Tom', 'Bea'];
const ACTIONS = ['Reheated to 75°C', 'Moved stock to the back-up fridge', 'Re-cleaned and re-checked', 'Called the supplier'];

function hash(s: string) {
  return [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 2166136261);
}

export function useSiteDay(siteCode: string) {
  const { records } = useTemplates();
  const settings = useMemo(() => settingsFor(siteCode), [siteCode]);
  const at = now();
  const businessDate = tradingDate(at, settings);
  const bounds = useMemo(() => dayBounds(businessDate, settings.dayCloseTime, settings.timezone), [businessDate, settings]);
  const example = showExampleData();
  const minute = Math.floor(at.getTime() / 60_000);

  const events = useMemo<DayEvent[]>(() => {
    const templates = activeTemplates(records, siteCode, businessDate);
    const saved = deviceChecklistStore().changesNow(siteCode, businessDate, 0);
    const realRuns = buildRuns(saved.runs, saved.answers);
    const base = tasksForDay(templates, Object.values(realRuns), businessDate, settings);
    const fake = example && !Object.keys(realRuns).length;

    const tasks = base.map((task) => {
      const template = templates.find((t) => t.id === task.templateId);
      let run: ChecklistRun | undefined = realRuns[task.key];
      if (fake && task.dueAt && task.dueAt < at) {
        const h = hash(siteCode + task.key);
        if (h % 7 !== 0) {
          const doneAt = new Date(task.dueAt.getTime() + ((h >>> 3) % 40) * 60_000);
          if (doneAt < at) {
            const by = PEOPLE[(h >>> 6) % PEOPLE.length]!;
            const failing = h % 5 === 0 ? template?.checkpoints[0] : undefined;
            run = {
              key: task.key, templateId: task.templateId, businessDate, dueTime: task.dueTime, answers: {}, completedAt: doneAt.toISOString(), completedBy: by,
              fixes: failing ? { [failing.id]: { actions: [ACTIONS[(h >>> 9) % ACTIONS.length]!], foodDisposed: false, note: '', recheckInMinutes: 30, reportFault: false, at: new Date(doneAt.getTime() - 4 * 60_000).toISOString() } } : {},
              answeredBy: failing ? { [failing.id]: { by, at: doneAt.toISOString() } } : undefined,
            };
          }
        }
      }
      const status = fake && run?.completedAt
        ? (Object.keys(run.fixes).length ? 'failed' as const : 'done' as const)
        : taskStatus(task, run, at, template, businessDate);
      return { key: task.key, title: task.title, dueAt: task.dueAt, status, run, template };
    });

    const repairs = storage.get<Repair[]>('mgh.repairs.v1', []).filter((r) => r.siteCode === siteCode);
    const report = deviceStore().peek(siteCode, businessDate) ?? (example ? demoReports(businessDate, new Set()).find((r) => r.draft.siteCode === siteCode) ?? null : null);
    return [
      // Head office can't open a site's checklist runs, so these events don't link anywhere.
      ...checklistEvents(tasks, () => ''),
      ...repairEvents(repairs, bounds.start, bounds.end),
      ...eodEvents(report),
    ];
    // Recompute once a minute so late and missed checklists move on.
  }, [records, siteCode, businessDate, settings, example, bounds, minute]); // eslint-disable-line react-hooks/exhaustive-deps

  return { events, bounds, businessDate, settings, example };
}
