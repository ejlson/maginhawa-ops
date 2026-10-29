/**
 * Sends finance any EOD summary whose email didn't go out when it was submitted (mail was down,
 * or the function stopped between storing the report and sending). Runs every 15 minutes.
 *
 * A report is left alone for EMAIL_GRACE_MS after it was submitted, so this job never races the
 * submit's own email. Only the last two trading days are checked, so it stays cheap.
 */
import { addDays, tradingDate, type EmailMessage, type EodStore, type SiteSettings } from '@maginhawa/core';
import { emailFinance } from './handler';

export const EMAIL_GRACE_MS = 5 * 60_000;

export interface EmailRetryDeps {
  sites: () => Promise<SiteSettings[]>;
  store: EodStore;
  sendEmail: (msg: EmailMessage) => Promise<void>;
  now?: () => Date;
}

export interface EmailRetryResult { sent: string[]; failed: string[] }

export function createEmailRetryJob(deps: EmailRetryDeps) {
  return async (): Promise<EmailRetryResult> => {
    const now = deps.now?.() ?? new Date();
    const result: EmailRetryResult = { sent: [], failed: [] };
    const sites = new Map((await deps.sites()).map((s) => [s.siteCode, s]));
    const dates = new Set([...sites.values()].flatMap((s) => { const d = tradingDate(now, s); return [d, addDays(d, -1)]; }));
    for (const date of dates) {
      for (const r of await deps.store.listByDate(date)) {
        const settings = sites.get(r.draft.siteCode);
        // null = submitted since emails were stamped and not sent yet. Older reports have no stamp at all and are left alone.
        if (!settings || r.emailedAt !== null || (r.status !== 'submitted' && r.status !== 'approved')) continue;
        if (!r.submittedAt || now.getTime() - Date.parse(r.submittedAt) < EMAIL_GRACE_MS) continue;
        const key = `${r.draft.siteCode}|${date}`;
        (await emailFinance({ ...deps, now: () => now }, r, settings) ? result.sent : result.failed).push(key);
      }
    }
    return result;
  };
}
