/**
 * Shared test mode: a laptop and a phone syncing through one local server, before
 * Entra ID and SharePoint exist. The guard matters most: it trusts a header for who is
 * calling, so it must never answer in a production deploy.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ChecklistSyncClient, DEV_USER_HEADER, EodSyncClient, newDraft, SyncError,
  type ChecklistBackend, type EodRemote, type PresenceRemote, type RunStart,
} from '@maginhawa/core';
import { devAuthenticate, devSettingsFor, sharedDev, sharedDevRefusal } from '../src/dev-shared';
import { createApi } from '../src/api';
const viaApi = (r: Request) => createApi(process.env)(r);

type Who = { name: string; role: string; siteCodes: string[] };
const jo: Who = { name: 'Jo', role: 'manager', siteCodes: ['BUN'] };
const sam: Who = { name: 'Sam', role: 'supervisor', siteCodes: ['BUN'] };

const call = (fn: (r: Request) => Promise<Response>, path: string, who: Who | null, init: RequestInit = {}) =>
  fn(new Request(`http://192.168.1.20:5180/api/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(who ? { [DEV_USER_HEADER]: encodeURIComponent(JSON.stringify(who)) } : {}), ...(init.headers as Record<string, string> | undefined) },
  }));

/** The same calls the web app makes in apps/eod-web/app/lib/sync.ts, against the function files. */
function device(who: Who) {
  const eod: EodRemote = {
    async get(site, date, ifNoneMatch) {
      const res = await call(viaApi, `eod-draft?site=${site}&date=${date}`, who, { headers: ifNoneMatch ? { 'If-None-Match': `"${ifNoneMatch}"` } : {} });
      return res.status === 304 ? 'not-modified' : (await res.json()).report;
    },
    async saveDraft(draft, opts) {
      const res = await call(viaApi, 'eod-draft', who, { method: 'PUT', body: JSON.stringify({ draft, baseVersion: opts.baseVersion }) });
      const body = await res.json();
      if (res.status === 409) throw new SyncError(body.code, body.error, body.current);
      return body.report;
    },
    async submit(draft, opts) {
      const res = await call(viaApi, 'submit-eod', who, { method: 'POST', body: JSON.stringify({ draft, baseVersion: opts.baseVersion, submitId: opts.submitId }) });
      const body = await res.json();
      return res.ok ? { ok: true, report: body.report } : { ok: false, code: body.code, error: body.error, current: body.current };
    },
  };
  const checklists: ChecklistBackend = {
    apply: async (siteCode, ops) => (await (await call(viaApi, 'checklist-sync', who, { method: 'POST', body: JSON.stringify({ siteCode, ops }) })).json()).outcomes,
    changes: async (site, date, since) => (await call(viaApi, `checklist-sync?site=${site}&date=${date}&since=${since}`, who)).json(),
  };
  const here: PresenceRemote = {
    beat: async (scope, me) => (await (await call(viaApi, 'presence', who, { method: 'POST', body: JSON.stringify({ scope, deviceId: me.deviceId, where: me.where }) })).json()).others,
  };
  return { eod, checklists, presence: here };
}

const DATE = '2026-10-05';
const blank = () => newDraft({ clientId: '6f1c2b8e-1d2a-4c3b-9f00-000000000001', siteCode: 'BUN', businessDate: DATE, platformIds: ['deliveroo', 'ubereats'] });
const saved = { ...process.env };

beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[Symbol.for('maginhawa.sharedDev')];
  process.env.DEV_SHARED_STORE = '1';
});
afterEach(() => { process.env = { ...saved }; });

describe('shared test mode guard', () => {
  it('is off unless DEV_SHARED_STORE=1', () => {
    expect(sharedDevRefusal({})).toMatch(/not set/);
    expect(sharedDevRefusal({ DEV_SHARED_STORE: 'true' })).toMatch(/not set/);
    expect(sharedDevRefusal({ DEV_SHARED_STORE: '1', NODE_ENV: 'development' })).toBeNull();
  });

  it.each([
    ['NODE_ENV=production', { NODE_ENV: 'production' }],
    ['a Netlify production deploy', { CONTEXT: 'production' }],
    ['a deployed function', { AWS_LAMBDA_FUNCTION_NAME: 'eod-draft' }],
    ['the Lambda runtime', { LAMBDA_TASK_ROOT: '/var/task' }],
  ])('refuses in %s', (_, env) => {
    expect(sharedDevRefusal({ DEV_SHARED_STORE: '1', ...env })).toMatch(/^Refused/);
    expect(sharedDev({ DEV_SHARED_STORE: '1', ...env })).toBeNull();
  });

  it('a production function ignores the dev header and stays not connected', async () => {
    process.env.NODE_ENV = 'production';
    for (const k of ['ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET', 'SHAREPOINT_SITE_ID']) delete process.env[k];
    expect((await call(viaApi, `eod-draft?site=BUN&date=${DATE}`, jo)).status).toBe(503);
    expect((await call(viaApi, `checklist-sync?site=BUN&date=${DATE}&since=0`, jo)).status).toBe(503);
    expect((await call(viaApi, 'presence', jo, { method: 'POST', body: '{}' })).status).toBe(503);
    expect((await call(viaApi, 'submit-eod', jo, { method: 'POST', body: '{}' })).status).toBe(503);
  });

  it('reads the demo sign-in from the header, and nothing else', async () => {
    const req = (v?: string) => new Request('http://x/', { headers: v ? { [DEV_USER_HEADER]: v } : {} });
    expect(await devAuthenticate(req(encodeURIComponent(JSON.stringify(jo))))).toEqual({ name: 'Jo', role: 'manager', siteCodes: ['BUN'] });
    expect((await devAuthenticate(req(encodeURIComponent(JSON.stringify({ name: 'Ana', role: 'headoffice' })))))?.siteCodes).toHaveLength(8);
    expect(await devAuthenticate(req())).toBeNull();
    expect(await devAuthenticate(req('not json'))).toBeNull();
    expect(await devAuthenticate(req(encodeURIComponent(JSON.stringify({ name: 'Jo', role: 'owner', siteCodes: ['BUN'] }))))).toBeNull();
    expect((await call(viaApi, `eod-draft?site=BUN&date=${DATE}`, null)).status).toBe(401);
    expect((await call(viaApi, `eod-draft?site=RAM&date=${DATE}`, jo)).status).toBe(403);
  });
});

describe('two devices through the shared test server', () => {
  it('gives a site its Power Automate switch', async () => {
    const dev = sharedDev({ DEV_SHARED_STORE: '1' })!;
    expect((await devSettingsFor('HOO'))?.flowFrom).toBeUndefined();
    await dev.siteFlow.set('HOO', '2026-10-05T10:00:00Z');
    expect((await devSettingsFor('HOO'))?.flowFrom).toBe('2026-10-05T10:00:00Z');
    await dev.siteFlow.set('HOO', null);
  });

  it('see each other\'s EOD sections, checklist answers and presence', async () => {
    const laptop = device(jo);
    const phone = device(sam);

    // EOD: both open an empty day, then each fills a different section.
    const opts = { siteCode: 'BUN', businessDate: DATE, blank, newId: () => crypto.randomUUID() };
    const joReport = new EodSyncClient({ ...opts, remote: laptop.eod, presence: laptop.presence, user: 'Jo', deviceId: 'laptop' });
    const samReport = new EodSyncClient({ ...opts, remote: phone.eod, presence: phone.presence, user: 'Sam', deviceId: 'phone' });
    await Promise.all([joReport.refresh(), samReport.refresh()]);
    await joReport.edit((d) => { d.wages.wageCost = 82000; });
    await samReport.edit((d) => { d.sessions.dinner.walkins = 20; }); // stale base: merged on the server's copy
    await joReport.refresh(); // the next poll

    for (const c of [joReport, samReport]) {
      expect(c.getState().draft.wages.wageCost).toBe(82000);
      expect(c.getState().draft.sessions.dinner.walkins).toBe(20);
      expect(c.getState().clashes).toEqual([]);
    }
    expect(joReport.getState().report?.sections?.wages?.by).toBe('Jo');
    expect(joReport.getState().report?.sections?.dinner?.by).toBe('Sam');
    expect(joReport.getState().others.map((p) => p.who)).toContain('Sam');

    // Checklists: different items on the same run, from each device.
    const run: RunStart = { key: `${DATE}|close|22:00`, templateId: 'close', businessDate: DATE, dueTime: '22:00' };
    const joList = new ChecklistSyncClient({ backend: laptop.checklists, siteCode: 'BUN', businessDate: DATE, user: 'Jo', deviceId: 'laptop' });
    const samList = new ChecklistSyncClient({ backend: phone.checklists, siteCode: 'BUN', businessDate: DATE, user: 'Sam', deviceId: 'phone' });
    await Promise.all([joList.answer(run, 'fridge', 4), samList.answer(run, 'doors', true)]);
    await Promise.all([joList.refresh(), samList.refresh()]);
    for (const c of [joList, samList]) {
      expect(c.getState().runs[run.key]?.answers).toEqual({ fridge: 4, doors: true });
      expect(c.getState().runs[run.key]?.answeredBy?.doors?.by).toBe('Sam');
    }
  });
});
