/**
 * Netlify Function: /.netlify/functions/eod-draft
 * Conditional draft saves (If-Match on the TradingDays item ETag) and cheap polling (If-None-Match).
 */
import { createEodDraftHandler } from '../../src/sync-handlers';
import { notConnected, notReady } from '../../src/not-connected';
import { blobsVersionIndex } from '../../src/version-index';

export default async (req: Request): Promise<Response> => {
  const off = notConnected();
  if (off) return off;
  // Connection point: authenticate → Entra ID token; store → the SharePoint EodStore (PATCH with If-Match: <ETag>).
  return createEodDraftHandler({
    authenticate: async () => null,
    store: { get: notReady, saveDraft: notReady, submit: notReady, listByDate: notReady, setStatus: notReady },
    index: blobsVersionIndex(),
  })(req);
};
