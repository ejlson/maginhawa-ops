/**
 * /report-definition: the report builder's back end.
 *   GET                                  → the record, today's status and the live version
 *   PUT  { definition, testDays }        → save the draft
 *   POST { action: 'submit', summary }   → send for approval
 *   POST { action: 'withdraw' | 'discard' }
 *   POST { action: 'approve' }           → a second person; live from the next trading day
 *   POST { action: 'reject', reason }
 *   POST { action: 'rollback', to, reason }
 * Head office only. Every write is conditional on the ETag the caller last saw, so two
 * people editing at once can't overwrite each other.
 */
import {
  ReviewError, approveDefinition, definitionOn, definitionStatus, discardDefinitionDraft, rejectDefinition,
  rollbackDefinition, saveDefinitionDraft, submitDefinition, tradingDate, withdrawDefinition,
  type DefinitionRecord, type ReportDefinition, type SiteSettings, type TestDay,
} from '@maginhawa/core';
import { json, type Caller } from './handler';

export interface DefinitionStore {
  /** The record and its ETag (SharePoint's item version), or null before the first save. */
  get(key: string): Promise<{ record: DefinitionRecord; etag: string } | null>;
  /** Saves only if the stored ETag still matches; otherwise throws ConflictError. Returns the new ETag. */
  save(record: DefinitionRecord, ifMatch: string | null): Promise<string>;
}

export class ConflictError extends Error {}

export interface DefinitionDeps {
  authenticate: (req: Request) => Promise<Caller | null>;
  store: DefinitionStore;
  /** For the trading day (day-close time and time zone). */
  groupSettings: () => Promise<Pick<SiteSettings, 'dayCloseTime' | 'timezone'>>;
  now?: () => Date;
}

/** Keeps the size of what we accept sensible (SharePoint multi-line text holds ~63k characters). */
const MAX_BODY = 60_000;

function isDefinition(x: unknown): x is ReportDefinition {
  const d = x as ReportDefinition;
  return !!d && typeof d === 'object' && Array.isArray(d.figures) && Array.isArray(d.actions) &&
    d.figures.every((f) => f && typeof f.id === 'string' && typeof f.name === 'string' && ['input', 'setting', 'calc', 'check'].includes(f.kind) && ['money', 'percent', 'number', 'yesno'].includes(f.type)) &&
    d.actions.every((a) => a && typeof a.id === 'string' && typeof a.title === 'string' && Array.isArray(a.shows)) &&
    (d.groups === undefined || (Array.isArray(d.groups) && d.groups.every((g) => g && typeof g.id === 'string' && typeof g.title === 'string')));
}
function isTestDays(x: unknown): x is TestDay[] {
  return Array.isArray(x) && x.every((t) => t && typeof t.name === 'string' && typeof t.values === 'object' && typeof t.expect === 'object');
}

export function createDefinitionHandler(deps: DefinitionDeps, key = 'eod') {
  return async (req: Request): Promise<Response> => {
    const caller = await deps.authenticate(req);
    if (!caller) return json(401, { error: 'Sign in again.' });
    const headOffice = caller.role === 'headoffice';
    if (!headOffice && req.method !== 'GET') return json(403, { error: 'Only head office can change the report.' });

    const now = deps.now?.() ?? new Date();
    const today = tradingDate(now, await deps.groupSettings());
    const at = now.toISOString();
    const current = await deps.store.get(key);
    // Managers' apps read only the version that's live for a trading day; never drafts or history.
    if (!headOffice) {
      const date = new URL(req.url).searchParams.get('date') ?? today;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(400, { error: 'Use a date like 2026-10-05.' });
      return json(200, { date, version: current ? definitionOn(current.record, date) : null });
    }
    if (!current) return json(404, { error: 'The report hasn’t been set up yet.' });

    const view = (record: DefinitionRecord, etag: string) => ({
      record, etag, today, status: definitionStatus(record, today), live: definitionOn(record, today)?.version ?? null,
    });

    if (req.method === 'GET') {
      const res = json(200, view(current.record, current.etag));
      res.headers.set('ETag', current.etag);
      return res;
    }
    if (req.method !== 'PUT' && req.method !== 'POST') return json(405, { error: 'Use GET, PUT or POST.' });

    const ifMatch = req.headers.get('If-Match');
    if (!ifMatch) return json(428, { error: 'Reload the report builder, then try again.' });
    if (ifMatch !== current.etag) return json(409, { error: 'Someone else changed the report. Reload to see their changes.', current: view(current.record, current.etag) });

    const raw = await req.text();
    if (raw.length > MAX_BODY) return json(413, { error: 'That report is too big to save.' });
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return json(400, { error: 'The change could not be read.' }); }

    let next: DefinitionRecord;
    try {
      if (req.method === 'PUT') {
        if (!isDefinition(body.definition) || !isTestDays(body.testDays)) return json(400, { error: 'The change could not be read.' });
        next = saveDefinitionDraft(current.record, { definition: body.definition, testDays: body.testDays, by: caller.name, at });
      } else {
        const r = current.record;
        switch (body.action) {
          case 'submit': next = submitDefinition(r, { summary: String(body.summary ?? ''), by: caller.name, at }); break;
          case 'withdraw': next = withdrawDefinition(r, { by: caller.name }); break;
          case 'discard': next = discardDefinitionDraft(r); break;
          case 'approve': next = approveDefinition(r, { by: caller.name, today, at }); break;
          case 'reject': next = rejectDefinition(r, { by: caller.name, reason: String(body.reason ?? ''), at }); break;
          case 'rollback': next = rollbackDefinition(r, { to: Number(body.to), by: caller.name, reason: String(body.reason ?? ''), today, at }); break;
          default: return json(400, { error: 'Unknown action.' });
        }
      }
    } catch (e) {
      if (e instanceof ReviewError) return json(422, { error: e.message });
      throw e;
    }

    try {
      const etag = await deps.store.save(next, current.etag);
      const res = json(200, view(next, etag));
      res.headers.set('ETag', etag);
      return res;
    } catch (e) {
      if (e instanceof ConflictError) return json(409, { error: 'Someone else changed the report. Reload to see their changes.' });
      throw e;
    }
  };
}

/** For tests and local development. SharePoint's version is the same shape with Graph calls. */
export class MemoryDefinitionStore implements DefinitionStore {
  private items = new Map<string, { record: DefinitionRecord; etag: string }>();
  private n = 0;
  constructor(seed?: DefinitionRecord) { if (seed) this.items.set(seed.key, { record: seed, etag: `"${++this.n}"` }); }
  async get(key: string) { const v = this.items.get(key); return v ? structuredClone(v) : null; }
  async save(record: DefinitionRecord, ifMatch: string | null) {
    const cur = this.items.get(record.key);
    if ((cur?.etag ?? null) !== ifMatch) throw new ConflictError('ETag mismatch');
    const etag = `"${++this.n}"`;
    this.items.set(record.key, { record: structuredClone(record), etag });
    return etag;
  }
}
