/**
 * How this device talks to the others at the site. The screens only see the sync
 * clients from @maginhawa/core; this file picks what sits behind them:
 *
 * - Connected: the Netlify Functions (eod-draft, submit-eod, checklist-sync, presence).
 * - Demo: the same rules on this device (lib/store.ts), so two tabs act as two devices.
 *
 * Live updates come through a LiveTransport: polling every 10 s (30 s when idle) and on focus for now.
 * A push service (e.g. Azure Web PubSub) can replace it here without touching the screens.
 */
import { useEffect } from 'react';
import {
  ManualTransport, PollingTransport, SyncError, storeRemote, submitReport,
  type ChecklistBackend, type ChecklistOp, type EodDraft, type EodRemote, type LiveTransport, type PresenceRemote, type SiteSettings, type SubmitResult,
} from '@maginhawa/core';
import { config, isConnected } from './config';
import { now } from './clock';
import { deviceChecklistStore, devicePresence, deviceStore } from './store';

export const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0').slice(-12));

/** One id per open app (per tab), so presence can tell the iPad from a phone, and two demo tabs apart. */
let tabId: string | null = null;
export function deviceId(): string {
  if (tabId) return tabId;
  try {
    tabId = globalThis.sessionStorage?.getItem('mgh.device') ?? null;
    if (!tabId) { tabId = uuid(); globalThis.sessionStorage?.setItem('mgh.device', tabId); }
  } catch {
    tabId = uuid();
  }
  return tabId;
}

// ── connected: the Netlify Functions ───────────────────────────────────

/** Sign-in token goes here once Entra ID is connected. */
const headers = (): Record<string, string> => ({ 'Content-Type': 'application/json' });

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${config.apiBase}/${path}`, { ...init, headers: { ...headers(), ...(init.headers as Record<string, string> | undefined) } });
  // 503 = server not connected yet; treat like no signal so the work stays on the device.
  if (res.status >= 500) throw new Error(`Server ${res.status}`);
  return res;
}

const httpEod: EodRemote = {
  async get(siteCode, businessDate, ifNoneMatch) {
    const res = await call(`eod-draft?site=${encodeURIComponent(siteCode)}&date=${businessDate}`, { headers: ifNoneMatch ? { 'If-None-Match': `"${ifNoneMatch}"` } : {} });
    if (res.status === 304) return 'not-modified';
    if (!res.ok) throw new Error(`Server ${res.status}`);
    return (await res.json()).report;
  },
  async saveDraft(draft, opts) {
    const res = await call('eod-draft', { method: 'PUT', body: JSON.stringify({ draft, baseVersion: opts.baseVersion }) });
    const body = await res.json();
    if (res.status === 409) throw new SyncError(body.code, body.error, body.current);
    if (!res.ok) throw new Error(body.error ?? `Server ${res.status}`);
    return body.report;
  },
  async submit(draft, opts): Promise<SubmitResult> {
    const res = await call('submit-eod', { method: 'POST', body: JSON.stringify({ draft, baseVersion: opts.baseVersion, submitId: opts.submitId }) });
    const body = await res.json();
    if (res.ok) return { ok: true, report: body.report };
    return { ok: false, code: body.code ?? 'failed', error: body.error ?? 'Could not send.', issues: body.issues, current: body.current };
  },
};

const httpChecklists: ChecklistBackend = {
  async apply(siteCode, ops: ChecklistOp[]) {
    const res = await call('checklist-sync', { method: 'POST', body: JSON.stringify({ siteCode, ops }) });
    if (!res.ok) throw new Error(`Server ${res.status}`);
    return (await res.json()).outcomes;
  },
  async changes(siteCode, businessDate, since) {
    const res = await call(`checklist-sync?site=${encodeURIComponent(siteCode)}&date=${businessDate}&since=${since}`);
    if (!res.ok) throw new Error(`Server ${res.status}`);
    return res.json();
  },
};

const httpPresence: PresenceRemote = {
  async beat(scope, me) {
    const res = await call('presence', { method: 'POST', body: JSON.stringify({ scope, deviceId: me.deviceId, where: me.where }) });
    return res.ok ? (await res.json()).others : [];
  },
};

// ── what the screens use ───────────────────────────────────────────────

export function eodRemote(settingsFor: (siteCode: string) => SiteSettings): EodRemote {
  if (isConnected()) return httpEod;
  const store = deviceStore();
  return storeRemote(
    store,
    (draft: EodDraft, o) => submitReport(draft, { store, settings: settingsFor(draft.siteCode), submittedBy: o.by, baseVersion: o.baseVersion, submitId: o.submitId, now: now() }),
    now,
  );
}

export const checklistBackend = (): ChecklistBackend => (isConnected() ? httpChecklists : deviceChecklistStore());
export const presenceRemote = (): PresenceRemote => (isConnected() ? httpPresence : devicePresence());
/** Answers are batched for a second in connected mode (scalability rule 1), sent straight away in demo mode. */
export const batchDelayMs = () => (isConnected() ? 1000 : 0);

/** Tests poke this to simulate "another device changed something". */
export const testTransport = new ManualTransport();

let transport: LiveTransport | null = null;
export function liveTransport(): LiveTransport {
  if (import.meta.env.MODE === 'test') return testTransport;
  return (transport ??= new PollingTransport({
    addEventListener: (t, fn) => (t === 'visibilitychange' ? document : window).addEventListener(t, fn),
    removeEventListener: (t, fn) => (t === 'visibilitychange' ? document : window).removeEventListener(t, fn),
    isVisible: () => document.visibilityState !== 'hidden',
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (id) => window.clearInterval(id as number),
  }, 10_000));
}

/** While a screen is open: refresh now, then whenever the transport says something may have changed. */
export function useLive(client: { refresh(): Promise<void> }, topic: string) {
  useEffect(() => {
    void client.refresh();
    const refresh = () => { void client.refresh(); };
    // Another tab on this device (demo mode) changed shared storage: refresh at once.
    const shared = ['mgh.reports.v1', 'mgh.checklists.v2'];
    const onStorage = (e: StorageEvent) => { if (e.key && shared.includes(e.key)) refresh(); };
    window.addEventListener('storage', onStorage);
    const off = liveTransport().subscribe(topic, refresh);
    return () => { off(); window.removeEventListener('storage', onStorage); };
  }, [client, topic]);
}
