/**
 * The timed jobs, run by the "maginhawa-jobs" Worker's Cron Triggers (worker/jobs.ts).
 * Cloudflare Pages can't run timed jobs, so they live in their own small Worker.
 *
 *   "15 5 * * *"    nightly-snapshot  covers on the books for the next 14 days
 *   "30 5 * * *"    nightly-forecast  forecasts 1–14 days ahead, after the snapshot
 *   every 15 min   email-retry       resends EOD summaries finance didn't get
 *
 * Times are UTC: 05:15 is after the 04:00 day close in both GMT and BST.
 * Not connected yet: until SharePoint (and the mailbox) are, each job logs that it ran and does nothing.
 */
import { parseGovUkBankHolidays } from '@maginhawa/core';
import { createEmailRetryJob } from './email-retry';
import { createForecastJob, createSnapshotJob } from './nightly';
import { eodStoreNotReady, forecastStoreNotReady, notReady, type Env } from './not-connected';

export const CRONS = {
  snapshot: '15 5 * * *',
  forecast: '30 5 * * *',
  emailRetry: '*/15 * * * *',
} as const;

export type JobName = keyof typeof CRONS;

export const jobFor = (cron: string): JobName | null =>
  (Object.entries(CRONS).find(([, c]) => c === cron)?.[0] as JobName | undefined) ?? null;

export async function runJob(name: JobName, env: Env, log: (line: string) => void = console.log): Promise<void> {
  if (name === 'emailRetry') {
    if (!env.SHAREPOINT_SITE_ID || !env.MAIL_FROM) return log('email-retry: SharePoint or the mailbox is not connected yet; nothing sent.');
    // Connection point: sites (Sites list), store (SharePoint EodStore), sendEmail (Graph sendMail), flow (FlowOutbox when FLOW_OUTBOX=1).
    const job = createEmailRetryJob({ sites: async () => [], store: eodStoreNotReady, sendEmail: notReady });
    return log(`email-retry ${JSON.stringify(await job())}`);
  }
  if (!env.SHAREPOINT_SITE_ID) return log(`${name === 'snapshot' ? 'nightly-snapshot' : 'nightly-forecast'}: SharePoint not connected yet; nothing done.`);
  if (name === 'snapshot') {
    // Connection point: sites (Sites list), store (BookingSnapshots / ForecastLog), bookingsFor (the reservations system).
    const job = createSnapshotJob({ sites: async () => [], store: forecastStoreNotReady, bookingsFor: async () => null });
    return log(`nightly-snapshot ${JSON.stringify(await job())}`);
  }
  // Connection point: sites, historyFor (TradingSessions / TradingDays → seriesFromReports()), store.
  const job = createForecastJob({
    sites: async () => [],
    historyFor: async () => [],
    holidays: async () => parseGovUkBankHolidays(await (await fetch('https://www.gov.uk/bank-holidays.json')).json()),
    store: forecastStoreNotReady,
  });
  log(`nightly-forecast ${JSON.stringify(await job())}`);
}
