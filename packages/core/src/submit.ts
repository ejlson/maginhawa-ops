/**
 * The submit step, shared by the server function and the app's demo mode:
 * validate the draft, re-run the calculations, refuse if anything blocks, then store.
 */
import { EodDraft } from './schema';
import { computeDay } from './calc';
import { canSubmit, reviewIssues } from './checks';
import type { SiteSettings } from './settings';
import type { EodStore, StoredReport } from './store';

export type SubmitResult =
  | { ok: true; report: StoredReport }
  | { ok: false; error: string; issues?: StoredReport['issues'] };

export async function submitReport(
  input: unknown,
  deps: { store: EodStore; settings: SiteSettings; submittedBy: string; now?: Date; targetNet?: number | null },
): Promise<SubmitResult> {
  const parsed = EodDraft.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'The report is missing information or has a value in the wrong format.' };
  const draft = parsed.data;
  if (draft.siteCode !== deps.settings.siteCode) return { ok: false, error: 'This report is for a different site.' };

  const official = computeDay(draft, deps.settings, { netSales: deps.targetNet ?? null });
  const issues = reviewIssues(draft, official, deps.settings);
  if (!canSubmit(draft, issues)) {
    return { ok: false, error: draft.confirmed ? 'Fix the issues marked in red, then submit again.' : 'Tick the confirmation to submit.', issues };
  }
  const report: StoredReport = {
    draft,
    status: 'submitted',
    submittedAt: (deps.now ?? new Date()).toISOString(),
    submittedBy: deps.submittedBy,
    official,
    issues,
  };
  try {
    await deps.store.submit(report);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save the report.' };
  }
  return { ok: true, report };
}
