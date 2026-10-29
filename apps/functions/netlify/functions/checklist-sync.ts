/**
 * Netlify Function: /.netlify/functions/checklist-sync
 * Batches of checklist answers in (one Graph $batch per batch), changes since a cursor out
 * (Responses and ChecklistRuns filtered on Modified).
 */
import { createChecklistSyncHandler } from '../../src/sync-handlers';
import { notConnected, notReady } from '../../src/not-connected';
import { blobsVersionIndex } from '../../src/version-index';
import { sharedDev } from '../../src/dev-shared';

export default async (req: Request): Promise<Response> => {
  // Shared test mode (local only, never deployed): see README.
  const dev = sharedDev();
  if (dev) return createChecklistSyncHandler({ authenticate: dev.authenticate, store: dev.checklists, index: dev.index })(req);
  const off = notConnected();
  if (off) return off;
  // Connection point: authenticate → Entra ID token; store → a SharePoint ChecklistBackend.
  return createChecklistSyncHandler({ authenticate: async () => null, store: { apply: notReady, changes: notReady }, index: blobsVersionIndex() })(req);
};
