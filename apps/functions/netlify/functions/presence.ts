/**
 * Netlify Function: /.netlify/functions/presence
 * "Jo is in Dinner". Short-lived, so it belongs in a small key-value store (Netlify Blobs)
 * rather than SharePoint.
 */
import { createPresenceHandler } from '../../src/sync-handlers';
import { notConnected, notReady } from '../../src/not-connected';

export default async (req: Request): Promise<Response> => {
  const off = notConnected();
  if (off) return off;
  // Connection point: authenticate → Entra ID token; presence → Netlify Blobs with a 30-second expiry.
  return createPresenceHandler({ authenticate: async () => null, presence: { beat: notReady } })(req);
};
