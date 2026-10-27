/**
 * The submit step, shared by the server function and the app's demo mode:
 * validate the draft, re-run the calculations, refuse if anything blocks, then store.
 * The store write is conditional, so when two people press Submit at once exactly one wins.
 */
import { EodDraft } from './schema';
import { computeDay } from './calc';
import { canSubmit, reviewIssues } from './checks';
import type { SiteSettings } from './settings';
import type { EodStore, StoredReport } from './store';
import { alreadySentMessage, describeChanges, isSyncError } from './sync';

export type SubmitErrorCode = 'invalid' | 'blocked' | 'conflict' | 'already-submitted' | 'failed';

export type SubmitResult =
  | { ok: true; report: StoredReport }
  | { ok: false; error: string; code: SubmitErrorCode; issues?: StoredReport['issues']; current?: StoredReport };

export async function submitReport(
  input: unknown,
  deps: {
    store: EodStore; settings: SiteSettings; submittedBy: string; now?: Date; targetNet?: number | null;
    /** The stored version this person reviewed. Left out = don't check (single device). */
    baseVersion?: string | null;
    /** One per press of Submit; a retry of the same press reuses it. */
    submitId?: string;
  },
): Promise<SubmitResult> {
  const parsed = EodDraft.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'invalid', error: 'The report is missing information or has a value in the wrong format.' };
  const draft = parsed.data;
  if (draft.siteCode !== deps.settings.siteCode) return { ok: false, code: 'invalid', error: 'This report is for a different site.' };

  const official = computeDay(draft, deps.settings, { netSales: deps.targetNet ?? null });
  const issues = reviewIssues(draft, official, deps.settings);
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
    const stored = await deps.store.submit(report, { baseVersion: deps.baseVersion, submitId: deps.submitId, now });
    return { ok: true, report: stored };
  } catch (e) {
    if (isSyncError(e)) {
      if (e.code === 'conflict') return { ok: false, code: 'conflict', error: `${describeChanges(draft, e.current)}. Check it, then submit again.`, current: e.current };
      return { ok: false, code: 'already-submitted', error: alreadySentMessage(e.current), current: e.current };
    }
    return { ok: false, code: 'failed', error: e instanceof Error ? e.message : 'Could not save the report.' };
  }
}
