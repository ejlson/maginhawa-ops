/**
 * Netlify Function: /.netlify/functions/submit-eod
 *
 * Not connected yet: SharePoint (Graph), Entra ID and the mailbox are set up later.
 * Until the server settings in apps/functions/.env.example are filled in, this answers
 * 503 with a clear message, and the app keeps running in demo mode on the device.
 */
import { createSubmitHandler } from '../../src/handler';
import { blobsVersionIndex } from '../../src/version-index';
import { devSendEmail, devSettingsFor, sharedDev } from '../../src/dev-shared';
import { eodStoreNotReady, notConnected, notReady, SERVER_SETTINGS } from '../../src/not-connected';

const required = [...SERVER_SETTINGS, 'MAIL_FROM', 'MAIL_TO'] as const;

export default async (req: Request): Promise<Response> => {
  // Shared test mode (local only, never deployed): see README.
  const dev = sharedDev();
  if (dev) return createSubmitHandler({ authenticate: dev.authenticate, store: dev.eod, settingsFor: devSettingsFor, sendEmail: devSendEmail, index: dev.index, flow: dev.flow })(req);
  const off = notConnected(required, 'The server is not connected to SharePoint yet. Your report is saved on this device.');
  if (off) return off;
  // Connection point: build the real dependencies here once Entra ID and SharePoint exist:
  //   authenticate → verify the Entra ID access token and read the user's sites
  //   store        → a SharePoint EodStore (Graph $batch, Retry-After), using toSharePointFields()
  //   sendEmail    → Graph sendMail from MAIL_FROM to MAIL_TO
  //   definitions  → the ReportDefinitions list (the report builder's approved versions)
  //   flow         → only when FLOW_OUTBOX=1: the FlowOutbox list, one row per message using
  //                  toFlowOutboxFields(); a 409 on the unique Title means 'exists'
  //   settingsFor  → must include flowFrom (Sites: PowerAutomateFrom), the site's own switch
  const handler = createSubmitHandler({
    authenticate: async () => null,
    store: eodStoreNotReady,
    settingsFor: async () => null,
    sendEmail: notReady,
    index: blobsVersionIndex(),
  });
  return handler(req);
};
