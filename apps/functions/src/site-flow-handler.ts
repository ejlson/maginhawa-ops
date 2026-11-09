/**
 * /site-flow: which sites send their EODs to Power Automate.
 *   GET                       → { available, sites }
 *   POST { siteCode, on }     → switch one site on or off, straight away
 * Head office only. Switching on stores the moment it happened, so older reports stay out of the flow.
 */
import { isOpenSite, type SiteFlowStore } from '@maginhawa/core';
import { json, type Authenticate } from './handler';

export interface SiteFlowDeps {
  authenticate: Authenticate;
  store: SiteFlowStore;
  /** False until the flow is set up (FLOW_OUTBOX=1): the switches can't be changed yet. */
  available: boolean;
  now?: () => Date;
}

export function createSiteFlowHandler(deps: SiteFlowDeps) {
  return async (req: Request): Promise<Response> => {
    const caller = await deps.authenticate(req);
    if (!caller) return json(401, { error: 'Sign in again.' });
    if (caller.role !== 'headoffice') return json(403, { error: 'Only head office can change this.' });

    const view = async () => json(200, { available: deps.available, sites: await deps.store.list() });
    if (req.method === 'GET') return view();
    if (req.method !== 'POST') return json(405, { error: 'Use GET or POST.' });
    if (!deps.available) return json(409, { error: 'Power Automate isn’t set up yet.' });

    let body: { siteCode?: unknown; on?: unknown };
    try { body = await req.json(); } catch { return json(400, { error: 'The change could not be read.' }); }
    const { siteCode, on } = body ?? {};
    if (typeof siteCode !== 'string' || !isOpenSite(siteCode) || typeof on !== 'boolean') return json(400, { error: 'The change could not be read.' });

    const sites = await deps.store.list();
    // Already on: keep the original date, so a double tap can't drop anything.
    if (on !== !!sites[siteCode]) await deps.store.set(siteCode, on ? (deps.now?.() ?? new Date()).toISOString() : null);
    return view();
  };
}
