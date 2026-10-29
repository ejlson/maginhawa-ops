/**
 * Netlify Function: /.netlify/functions/report-definition
 * The report builder's back end: drafts, approval, versions and rollback.
 */
import { createDefinitionHandler } from '../../src/report-definition-handler';
import { notConnected, notReady } from '../../src/not-connected';

export default async (req: Request): Promise<Response> => {
  const off = notConnected();
  if (off) return off;
  // Connection point: authenticate → Entra ID token (role from the Head office group);
  // store → the ReportDefinitions SharePoint list (GET item + PATCH with If-Match: <ETag>).
  return createDefinitionHandler({
    authenticate: async () => null,
    store: { get: notReady, save: notReady },
    groupSettings: async () => ({ dayCloseTime: '04:00', timezone: 'Europe/London' }),
  })(req);
};
