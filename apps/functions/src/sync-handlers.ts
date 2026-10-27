/**
 * The endpoints that let several devices at one site work on the same report and
 * checklists: conditional draft saves, cheap change polling, checklist batches and presence.
 * Who did what always comes from the signed-in caller, never from the request body.
 */
import { isSyncError, type ChecklistBackend, type ChecklistOp, type EodDraft, type EodStore, type PresenceRemote } from '@maginhawa/core';
import { json, type Caller } from './handler';

type Authenticate = (req: Request) => Promise<Caller | null>;

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * GET  /eod-draft?site=BUN&date=2026-10-05   (If-None-Match: <version>) → 200 { report } | 304
 * PUT  /eod-draft  { draft, baseVersion }    → 200 { report } | 409 { code: 'conflict' | 'locked', current }
 */
export function createEodDraftHandler(deps: { authenticate: Authenticate; store: EodStore }) {
  return async (req: Request): Promise<Response> => {
    const caller = await deps.authenticate(req);
    if (!caller) return json(401, { error: 'Sign in again.' });

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const site = url.searchParams.get('site') ?? '';
      const date = url.searchParams.get('date') ?? '';
      if (!caller.siteCodes.includes(site)) return json(403, { error: 'You can only open your own site.' });
      const report = await deps.store.get(site, date);
      const etag = report?.version ? `"${report.version}"` : null;
      if (etag && req.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
      const res = json(200, { report });
      if (etag) res.headers.set('ETag', etag);
      return res;
    }

    if (req.method === 'PUT') {
      const body = await readJson(req);
      const draft = body?.draft as EodDraft | undefined;
      if (!draft || typeof draft !== 'object') return json(400, { error: 'The report could not be read.' });
      if (!caller.siteCodes.includes(draft.siteCode)) return json(403, { error: 'You can only edit your own site.' });
      try {
        const report = await deps.store.saveDraft(draft, { baseVersion: (body?.baseVersion as string | null | undefined) ?? null, by: caller.name });
        return json(200, { report });
      } catch (e) {
        if (isSyncError(e)) return json(409, { error: e.message, code: e.code, current: e.current });
        throw e;
      }
    }
    return json(405, { error: 'Use GET or PUT.' });
  };
}

/**
 * GET  /checklist-sync?site=BUN&date=2026-10-05&since=42 → { runs, answers, cursor }
 * POST /checklist-sync { siteCode, ops }                 → { outcomes }   (one call per batch)
 */
export function createChecklistSyncHandler(deps: { authenticate: Authenticate; store: ChecklistBackend }) {
  return async (req: Request): Promise<Response> => {
    const caller = await deps.authenticate(req);
    if (!caller) return json(401, { error: 'Sign in again.' });

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const site = url.searchParams.get('site') ?? '';
      if (!caller.siteCodes.includes(site)) return json(403, { error: 'You can only open your own site.' });
      const since = Number(url.searchParams.get('since') ?? 0) || 0;
      return json(200, await deps.store.changes(site, url.searchParams.get('date') ?? '', since));
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const site = String(body?.siteCode ?? '');
      const ops = Array.isArray(body?.ops) ? (body!.ops as ChecklistOp[]) : null;
      if (!ops) return json(400, { error: 'The changes could not be read.' });
      if (!caller.siteCodes.includes(site)) return json(403, { error: 'You can only change your own site.' });
      // Only supervisors and above may correct a finished checklist (HANDOFF.md §8a, item 1).
      if (ops.some((op) => op.kind === 'correct') && (!caller.role || caller.role === 'staff')) return json(403, { error: 'Only supervisors, managers and head office can correct a finished checklist.' });
      const signed = ops.map((op) => ({ ...op, by: caller.name }));
      return json(200, { outcomes: await deps.store.apply(site, signed) });
    }
    return json(405, { error: 'Use GET or POST.' });
  };
}

/** POST /presence { scope, deviceId, where } → { others } */
export function createPresenceHandler(deps: { authenticate: Authenticate; presence: PresenceRemote; now?: () => Date }) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
    const caller = await deps.authenticate(req);
    if (!caller) return json(401, { error: 'Sign in again.' });
    const body = await readJson(req);
    const scope = String(body?.scope ?? '');
    if (!caller.siteCodes.includes(scope.split('|')[0] ?? '')) return json(403, { error: 'You can only open your own site.' });
    const others = await deps.presence.beat(scope, {
      deviceId: String(body?.deviceId ?? ''), who: caller.name,
      where: typeof body?.where === 'string' ? body.where : null, at: (deps.now?.() ?? new Date()).toISOString(),
    });
    return json(200, { others });
  };
}
