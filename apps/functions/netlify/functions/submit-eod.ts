/**
 * Netlify Function: /.netlify/functions/submit-eod
 *
 * Not connected yet: SharePoint (Graph), Entra ID and the mailbox are set up later.
 * Until the server settings in apps/functions/.env.example are filled in, this answers
 * 503 with a clear message, and the app keeps running in demo mode on the device.
 */
import { createSubmitHandler } from '../../src/handler';

const required = ['ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET', 'SHAREPOINT_SITE_ID', 'MAIL_FROM', 'MAIL_TO'] as const;

export default async (req: Request): Promise<Response> => {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    return new Response(JSON.stringify({ error: 'The server is not connected to SharePoint yet. Your report is saved on this device.', missing }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Connection point: build the real dependencies here once Entra ID and SharePoint exist:
  //   authenticate → verify the Entra ID access token and read the user's sites
  //   store        → a SharePoint EodStore (Graph $batch, Retry-After), using toSharePointFields()
  //   sendEmail    → Graph sendMail from MAIL_FROM to MAIL_TO
  const handler = createSubmitHandler({
    authenticate: async () => null,
    store: { get: notReady, saveDraft: notReady, submit: notReady, listByDate: notReady, setStatus: notReady },
    settingsFor: async () => null,
    sendEmail: notReady,
  });
  return handler(req);
};

async function notReady(): Promise<never> {
  throw new Error('SharePoint store not connected yet.');
}
