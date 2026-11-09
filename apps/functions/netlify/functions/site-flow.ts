/**
 * Netlify Function: /.netlify/functions/site-flow
 * Which sites send their EODs to Power Automate.
 */
import { createSiteFlowHandler } from '../../src/site-flow-handler';
import { sharedDev } from '../../src/dev-shared';
import { notConnected, notReady } from '../../src/not-connected';

export default async (req: Request): Promise<Response> => {
  // Shared test mode (local only, never deployed): see README.
  const dev = sharedDev();
  if (dev) return createSiteFlowHandler({ authenticate: dev.authenticate, store: dev.siteFlow, available: true })(req);
  const off = notConnected();
  if (off) return off;
  // Connection point: authenticate → Entra ID token (role from the Head office group);
  // store → the PowerAutomateFrom column on the Sites list.
  return createSiteFlowHandler({
    authenticate: async () => null,
    store: { list: notReady, set: notReady },
    available: process.env.FLOW_OUTBOX === '1',
  })(req);
};
