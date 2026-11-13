/**
 * Sends finance any EOD summary whose email didn't go out when it was submitted (mail was down,
 * or the function stopped between storing the report and sending). Runs every 15 minutes.
 * With Power Automate switched on, it also adds any flow message the submit couldn't (FlowOutbox):
 * adding is a no-op when the message is already there.
 *
 * A report is left alone for EMAIL_GRACE_MS after it was submitted, so this job never races the
 * submit's own email. Only the last two trading days are checked, so it stays cheap.
 */
import { addDays, tradingDate, type EmailMessage, type EodStore, type FlowOutbox, type SiteSettings } from '@maginhawa/core';
import { emailFinance, queueFlow } from './handler';

export const EMAIL_GRACE_MS = 5 * 60_000;

export interface EmailRetryDeps {
  sites: () => Promise<SiteSettings[]>;
  store: EodStore;
  sendEmail: (msg: EmailMessage) => Promise<void>;
  now?: () => Date;
  flow?: FlowOutbox;
}

export interface EmailRetryResult {
  sent: string[];
  failed: string[];
  /** Only with Power Automate on: flow messages this run added, and ones it couldn't. */
  queued?: string[];
  queueFailed?: string[];
}

export function createEmailRetryJob(deps: EmailRetryDeps) {
  return async (): Promise<EmailRetryResult> => {
    const now = deps.now?.() ?? new Date();
    const result: EmailRetryResult = { sent: [], failed: [], ...(deps.flow ? { queued: [], queueFailed: [] } : {}) };
    const sites = new Map((await deps.sites()).map((s) => [s.siteCode, s]));
    const dates = new Set([...sites.values()].flatMap((s) => { const d = tradingDate(now, s); return [d, addDays(d, -1)]; }));
    for (const date of dates) {
      for (const r of await deps.store.listByDate(date)) {
        const settings = sites.get(r.draft.siteCode);
        if (!settings || (r.status !== 'submitted' && r.status !== 'approved')) continue;
        if (!r.submittedAt || now.getTime() - Date.parse(r.submittedAt) < EMAIL_GRACE_MS) continue;
        const key = `${r.draft.siteCode}|${date}`;
        if (deps.flow) {
          const q = await queueFlow(deps, r, settings);
          if (q === 'added') result.queued!.push(key);
          if (q === 'failed') result.queueFailed!.push(key);
        }
        // null = submitted since emails were stamped and not sent yet. Older reports have no stamp at all and are left alone.
        if (r.emailedAt !== null) continue;
        (await emailFinance({ ...deps, now: () => now }, r, settings) ? result.sent : result.failed).push(key);
      }
    }
    return result;
  };
}
