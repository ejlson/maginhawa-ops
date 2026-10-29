/**
 * Scheduled Netlify Function: resends any EOD summary finance didn't get at submit time.
 * Runs every 15 minutes.
 *
 * Not connected yet: SharePoint (Graph) and the mailbox come later. Until then it logs that it
 * ran and sends nothing, so switching it on is only a matter of filling in the deps.
 */
import { createEmailRetryJob } from '../../src/email-retry';

export const config = { schedule: '*/15 * * * *' };

export default async (): Promise<void> => {
  if (!process.env.SHAREPOINT_SITE_ID || !process.env.MAIL_FROM) {
    console.log('email-retry: SharePoint or the mailbox is not connected yet; nothing sent.');
    return;
  }
  // Connection point:
  //   sites     → Sites list (active sites, with their settings)
  //   store     → the SharePoint EodStore
  //   sendEmail → Graph sendMail from MAIL_FROM to MAIL_TO
  //   flow      → only when FLOW_OUTBOX=1: the FlowOutbox list (see submit-eod)
  const job = createEmailRetryJob({
    sites: async () => [],
    store: { get: notReady, saveDraft: notReady, submit: notReady, listByDate: notReady, setStatus: notReady, markEmailed: notReady },
    sendEmail: notReady,
  });
  console.log('email-retry', JSON.stringify(await job()));
};

async function notReady(): Promise<never> {
  throw new Error('SharePoint store not connected yet.');
}
