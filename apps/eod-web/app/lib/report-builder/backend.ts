/**
 * Where the report builder saves. The builder only sees DefinitionBackend; this file picks what sits behind it:
 *
 * - Connected: /report-definition (apps/functions/src/report-definition-handler.ts), every write with If-Match.
 * - Demo: the same core rules on this device, saved under 'mgh.definitions', the key the managers' EOD reads
 *   (lib/definition.ts). So an approved change reaches the EOD on this device from the next trading day.
 */
import {
  ReviewError, approveDefinition, definitionOn, definitionStatus, discardDefinitionDraft, rejectDefinition, rollbackDefinition,
  publishDefinition, saveDefinitionDraft, submitDefinition, tradingDate, withdrawDefinition,
  type DefinitionRecord, type DefinitionStatus, type ReportDefinition, type TestDay,
} from '@maginhawa/core';
import { config, isConnected } from '../config';
import { now } from '../clock';
import { settingsFor } from '../draft';
import { storage } from '../storage';
import { demoDefinitions, setDemoDefinitions } from '../definition';

/** What the server answers with (GET, and after every write). */
export interface DefinitionView {
  record: DefinitionRecord;
  etag: string;
  /** Today's trading day (YYYY-MM-DD). */
  today: string;
  status: DefinitionStatus;
  /** The version live today. */
  live: number | null;
}

export type DefinitionAction =
  | { action: 'publish'; summary: string }
  | { action: 'submit'; summary: string }
  | { action: 'approve' }
  | { action: 'reject'; reason: string }
  | { action: 'withdraw' }
  | { action: 'discard' }
  | { action: 'rollback'; to: number; reason: string };

/** Someone else saved first. `current` is what they saved, when the server sent it. */
export class DefinitionConflict extends Error {
  constructor(message: string, readonly current: DefinitionView | null) { super(message); }
}
/** A rule said no (e.g. "Someone else needs to approve this"). The message is written for finance. */
export class DefinitionRefused extends Error {}

export interface DefinitionBackend {
  load(): Promise<DefinitionView>;
  saveDraft(body: { definition: ReportDefinition; testDays: TestDay[] }, etag: string): Promise<DefinitionView>;
  act(body: DefinitionAction, etag: string): Promise<DefinitionView>;
}

/* ------------------------------------------------------------------ connected */

const url = () => `${config.apiBase}/report-definition`;
async function send(init: RequestInit & { etag?: string }): Promise<DefinitionView> {
  const res = await fetch(url(), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.etag ? { 'If-Match': init.etag } : {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as DefinitionView;
  const msg = body.error ?? `The server answered ${res.status}. Try again in a moment.`;
  if (res.status === 409) throw new DefinitionConflict(msg, body.current ?? null);
  if (res.status === 422 || res.status === 403 || res.status === 400 || res.status === 413 || res.status === 428) throw new DefinitionRefused(msg);
  throw new Error(msg);
}

export const httpDefinitions: DefinitionBackend = {
  load: () => send({ method: 'GET' }),
  saveDraft: (body, etag) => send({ method: 'PUT', body: JSON.stringify(body), etag }),
  act: (body, etag) => send({ method: 'POST', body: JSON.stringify(body), etag }),
};

/* ---------------------------------------------------------------------- demo */

/** A short fingerprint of the saved record, standing in for SharePoint's item version. Two tabs see the same one. */
function fingerprint(rec: DefinitionRecord): string {
  const s = JSON.stringify(rec);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `"d${(h >>> 0).toString(36)}-${s.length.toString(36)}"`;
}

/** The demo "server": the same rules as the endpoint, run on this device for whoever is signed in. */
export function deviceDefinitions(by: () => string, siteCode: string): DefinitionBackend {
  const today = () => tradingDate(now(), settingsFor(siteCode));
  const view = (record: DefinitionRecord): DefinitionView => ({
    record, etag: fingerprint(record), today: today(), status: definitionStatus(record, today()), live: definitionOn(record, today())?.version ?? null,
  });
  const write = (etag: string, change: (r: DefinitionRecord) => DefinitionRecord): DefinitionView => {
    const cur = demoDefinitions();
    if (fingerprint(cur) !== etag) throw new DefinitionConflict('Someone else changed the report. Reload to see their changes.', view(cur));
    let next: DefinitionRecord;
    try { next = change(cur); } catch (e) {
      if (e instanceof ReviewError) throw new DefinitionRefused(e.message);
      throw e;
    }
    setDemoDefinitions(next);
    return view(next);
  };
  const at = () => now().toISOString();
  return {
    async load() { return view(demoDefinitions()); },
    async saveDraft(body, etag) {
      return write(etag, (r) => saveDefinitionDraft(r, { ...body, by: by(), at: at() }));
    },
    async act(b, etag) {
      return write(etag, (r) => {
        switch (b.action) {
          case 'publish': return publishDefinition(r, { summary: b.summary, by: by(), today: today(), at: at() });
          case 'submit': return submitDefinition(r, { summary: b.summary, by: by(), at: at() });
          case 'withdraw': return withdrawDefinition(r, { by: by() });
          case 'discard': return discardDefinitionDraft(r);
          case 'approve': return approveDefinition(r, { by: by(), today: today(), at: at() });
          case 'reject': return rejectDefinition(r, { by: by(), reason: b.reason, at: at() });
          case 'rollback': return rollbackDefinition(r, { to: b.to, by: by(), reason: b.reason, today: today(), at: at() });
        }
      });
    },
  };
}

export const definitionBackend = (by: () => string, siteCode: string): DefinitionBackend => (isConnected() ? httpDefinitions : deviceDefinitions(by, siteCode));

/** How long the builder waits after the last change before saving the draft. */
export const autosaveDelayMs = () => (isConnected() ? 1200 : 300);

/* --------------------------------------------- what stays on this device only */

/** Card positions someone arranged by hand. A screen preference, so it isn't part of the draft. */
const LAYOUT_KEY = 'mgh.builder.layout';
export interface SavedLayout { tidy: boolean; pos: Record<string, { x: number; y: number }>; layers?: boolean; panel?: boolean }
export const loadLayout = (): SavedLayout | null => storage.get<SavedLayout | null>(LAYOUT_KEY, null);
export const saveLayout = (l: Partial<SavedLayout>) => storage.set(LAYOUT_KEY, { ...(loadLayout() ?? { tidy: true, pos: {} }), ...l });
