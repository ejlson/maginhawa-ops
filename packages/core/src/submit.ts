/**
 * The submit step, shared by the server function and the app's demo mode:
 * validate the draft, re-run the calculations, refuse if anything blocks, then store.
 * The store write is conditional, so when two people press Submit at once exactly one wins.
 */
import { EodDraft } from './schema';
import { computeDayWith, definitionIssues } from './report-live';
import type { DefinitionRecord } from './report-versions';
import { canSubmit, reviewIssues } from './checks';
import type { SiteSettings } from './settings';
import type { EodStore, StoredReport } from './store';
import { alreadySentMessage, describeChanges, isSyncError } from './sync';

export type SubmitErrorCode = 'invalid' | 'blocked' | 'conflict' | 'already-submitted' | 'failed';

export type SubmitResult =
  | {
    ok: true; report: StoredReport;
    /** A retry of a press that had already gone through: nothing new was stored, so nothing should be sent again. */
    replayed?: boolean;
  }
  | { ok: false; error: string; code: SubmitErrorCode; issues?: StoredReport['issues']; current?: StoredReport };

export async function submitReport(
  input: unknown,
  deps: {
    store: EodStore; settings: SiteSettings; submittedBy: string; now?: Date; targetNet?: number | null;
    /** The stored version this person reviewed. Left out = don't check (single device). */
    baseVersion?: string | null;
    /** One per press of Submit; a retry of the same press reuses it. */
    submitId?: string;
    /** The report builder's versions. The one approved for this trading day decides the official figures. */
    definitions?: DefinitionRecord | null;
  },
): Promise<SubmitResult> {
  const parsed = EodDraft.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'invalid', error: 'The report is missing information or has a value in the wrong format.' };
  const draft = parsed.data;
  if (draft.siteCode !== deps.settings.siteCode) return { ok: false, code: 'invalid', error: 'This report is for a different site.' };

  const official = computeDayWith(draft, deps.settings, { netSales: deps.targetNet ?? null }, deps.definitions);
  const issues = [...reviewIssues(draft, official, deps.settings), ...definitionIssues(draft, deps.definitions)];
  if (!canSubmit(draft, issues)) {
    return { ok: false, code: 'blocked', error: draft.confirmed ? 'Fix the issues marked in red, then submit again.' : 'Tick the confirmation to submit.', issues };
  }
  const now = deps.now ?? new Date();
  const report: StoredReport = {
    draft,
    status: 'submitted',
    submittedAt: now.toISOString(),
    submittedBy: deps.submittedBy,
    official,
    issues,
  };
  try {
    const { replayed, ...stored } = await deps.store.submit(report, { baseVersion: deps.baseVersion, submitId: deps.submitId, now });
    return { ok: true, report: stored, replayed: Boolean(replayed) };
  } catch (e) {
    if (isSyncError(e)) {
      if (e.code === 'conflict') return { ok: false, code: 'conflict', error: `${describeChanges(draft, e.current)}. Check it, then submit again.`, current: e.current };
      return { ok: false, code: 'already-submitted', error: alreadySentMessage(e.current), current: e.current };
    }
    return { ok: false, code: 'failed', error: e instanceof Error ? e.message : 'Could not save the report.' };
  }
}
