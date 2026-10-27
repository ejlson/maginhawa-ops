/**
 * Collects a site's checklist records for an inspector's pack (HANDOFF.md §8a, item 2): every finished
 * list with its answers, failures and what was done, and any corrections with the original answer.
 * Reads day by day through the same backend the app syncs with. Connected mode should move this to a
 * single range query on ChecklistRuns/Responses (indexed on Site + BusinessDate) once it's in use.
 */
import { activeTemplates, addDays, buildRuns, evaluate, type ChecklistRun, type ChecklistTemplate, type DateRange, type TemplateRecord } from '@maginhawa/core';
import { checklistBackend } from './sync';

export interface PackRun {
  date: string;
  run: ChecklistRun;
  template: ChecklistTemplate;
  failures: { title: string; reason: string; fix: string | null }[];
}

export async function loadChecklistRecords(siteCode: string, range: DateRange, templates: TemplateRecord[]): Promise<PackRun[]> {
  const backend = checklistBackend();
  const out: PackRun[] = [];
  for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
    const c = await backend.changes(siteCode, date, 0);
    if (!c.runs.length) continue;
    const used = activeTemplates(templates, siteCode, date);
    const runs = Object.values(buildRuns(c.runs, c.answers));
    for (const run of runs) {
      const t = used.find((x) => x.id === run.templateId);
      if (!t || !Object.keys(run.answers).length) continue;
      const template = run.recheckOf ? { ...t, title: `Re-check · ${t.title}`, checkpoints: t.checkpoints.filter((x) => x.id === run.recheckOf!.checkpointId) } : t;
      const failures = template.checkpoints.flatMap((cp) => {
        const e = evaluate(cp, run.answers[cp.id], date);
        if (e.passed !== false) return [];
        const f = run.fixes[cp.id];
        return [{ title: cp.title, reason: e.reason, fix: f ? [f.actions.join(', '), f.note, f.foodDisposed ? 'food thrown away' : '', `re-check in ${f.recheckInMinutes} min`].filter(Boolean).join('; ') : null }];
      });
      out.push({ date, run, template, failures });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.run.dueTime ?? '').localeCompare(b.run.dueTime ?? ''));
}
