/**
 * Which sites send their EODs to Power Automate, for the report builder.
 * On a server: asked from /site-flow. Demo: kept on this device.
 */
import { useEffect, useState } from 'react';
import type { SiteFlows } from '@maginhawa/core';
import { usesServer } from './config';
import { apiGet, apiPost } from './sync';
import { storage } from './storage';

const DEMO_KEY = 'mgh.siteFlows';

export interface SiteFlowView {
  /** False until the flow is set up. */
  available: boolean;
  sites: SiteFlows;
}

const demoView = (): SiteFlowView => ({ available: true, sites: storage.get<SiteFlows>(DEMO_KEY, {}) });

function withSite(view: SiteFlowView, siteCode: string, on: boolean): SiteFlowView {
  const sites = { ...view.sites };
  if (on) sites[siteCode] = new Date().toISOString();
  else delete sites[siteCode];
  return { ...view, sites };
}

export function useSiteFlows() {
  const [view, setView] = useState<SiteFlowView | null>(() => (usesServer() ? null : demoView()));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!usesServer()) return;
    let live = true;
    apiGet<SiteFlowView>('site-flow')
      .then((r) => { if (!live) return; if (r) setView(r); else setError('Couldn’t load the sites.'); })
      .catch(() => { if (live) setError('Couldn’t load the sites. Check the connection and try again.'); });
    return () => { live = false; };
  }, []);

  const set = async (siteCode: string, on: boolean) => {
    if (!view) return;
    const next = withSite(view, siteCode, on);
    setView(next);
    setError('');
    if (!usesServer()) { storage.set(DEMO_KEY, next.sites); return; }
    try {
      setView(await apiPost<SiteFlowView>('site-flow', { siteCode, on }));
    } catch {
      setView(view);
      setError('Couldn’t save that. Try again.');
    }
  };

  return { view, error, set };
}
