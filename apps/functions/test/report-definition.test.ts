import { describe, expect, it } from 'vitest';
import { EOD_DEFINITION, VERIFIED_TEST_DAY, addFigure, addGroup, seedDefinitionRecord, updateFigure, type ReportDefinition } from '@maginhawa/core';
import { createDefinitionHandler, MemoryDefinitionStore, type DefinitionStore } from '../src/report-definition-handler';
import netlifyFunction from '../netlify/functions/report-definition';

const URL_ = 'https://ops.example/.netlify/functions/report-definition';
const PEOPLE: Record<string, { name: string; siteCodes: string[]; role: 'headoffice' | 'manager' }> = {
  ana: { name: 'Ana', siteCodes: [], role: 'headoffice' },
  ben: { name: 'Ben', siteCodes: [], role: 'headoffice' },
  mgr: { name: 'Manager', siteCodes: ['BUN'], role: 'manager' },
};

function setup(store: DefinitionStore = new MemoryDefinitionStore(seedDefinitionRecord({ startsOn: '2026-10-01', by: 'Finance', at: '2026-10-01T09:00:00Z' }))) {
  const handler = createDefinitionHandler({
    authenticate: async (req) => PEOPLE[req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''] ?? null,
    store,
    groupSettings: async () => ({ dayCloseTime: '04:00', timezone: 'Europe/London' }),
    now: () => new Date('2026-11-02T11:00:00Z'),
  });
  const call = (who: string, method: string, body?: unknown, etag?: string | null, query = '') =>
    handler(new Request(URL_ + query, {
      method,
      headers: { Authorization: `Bearer ${who}`, 'Content-Type': 'application/json', ...(etag ? { 'If-Match': etag } : {}) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }));
  const get = async (who = 'ana') => { const r = await call(who, 'GET'); return { status: r.status, body: await r.json(), etag: r.headers.get('ETag') }; };
  const send = async (who: string, method: 'PUT' | 'POST', body: unknown) => {
    const { etag } = await get(who === 'mgr' ? 'ana' : who);
    const r = await call(who, method, body, etag);
    return { status: r.status, body: await r.json() };
  };
  return { call, get, send };
}

const withFees = (): ReportDefinition =>
  addFigure(addFigure(EOD_DEFINITION, { id: 'pay.card', name: 'Card takings', kind: 'input', type: 'money', group: 'payments' }),
    { id: 'cardFees', name: 'Card fees', kind: 'calc', type: 'money', formula: '[Card takings] × 1.75%' });

describe('report-definition', () => {
  it('keeps the sections finance name, and refuses ones it can’t read', async () => {
    const s = setup();
    const def = addGroup(withFees(), { id: 'events', title: 'Events' });
    const ok = await s.send('ana', 'PUT', { definition: def, testDays: [VERIFIED_TEST_DAY] });
    expect(ok.status).toBe(200);
    expect(ok.body.record.draft.definition.groups.find((g: { id: string }) => g.id === 'events')).toEqual({ id: 'events', title: 'Events' });
    const bad = await s.send('ana', 'PUT', { definition: { ...def, groups: [{ id: 'x' }] }, testDays: [VERIFIED_TEST_DAY] });
    expect(bad.status).toBe(400);
  });

  it('shows the live version and today’s trading day', async () => {
    const { status, body, etag } = await setup().get();
    expect(status).toBe(200);
    expect(body).toMatchObject({ today: '2026-11-02', status: 'live', live: 1 });
    expect(etag).toBe('"1"');
  });

  it('runs the whole journey: draft, submit, approve by someone else, live tomorrow', async () => {
    const s = setup();
    expect((await s.send('ana', 'PUT', { definition: withFees(), testDays: [VERIFIED_TEST_DAY] })).body.status).toBe('draft');
    expect((await s.send('ana', 'POST', { action: 'submit', summary: 'Card fees' })).body.status).toBe('waiting');
    expect((await s.send('ana', 'POST', { action: 'approve' }))).toMatchObject({ status: 422, body: { error: 'Someone else needs to approve this. You made the change.' } });
    const ok = await s.send('ben', 'POST', { action: 'approve' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'starts-tomorrow', live: 1 });
    expect(ok.body.record.versions.at(-1)).toMatchObject({ version: 2, startsOn: '2026-11-03', draftedBy: 'Ana', approvedBy: 'Ben' });
  });

  it('turns down, withdraws, discards and rolls back', async () => {
    const s = setup();
    await s.send('ana', 'PUT', { definition: withFees(), testDays: [VERIFIED_TEST_DAY] });
    await s.send('ana', 'POST', { action: 'submit', summary: 'Card fees' });
    expect((await s.send('ben', 'POST', { action: 'reject', reason: 'Use 1.5%' })).body).toMatchObject({ status: 'draft', record: { rejected: { by: 'Ben', reason: 'Use 1.5%' } } });
    await s.send('ana', 'POST', { action: 'submit', summary: 'Card fees' });
    expect((await s.send('ana', 'POST', { action: 'withdraw' })).body.status).toBe('draft');
    expect((await s.send('ana', 'POST', { action: 'discard' })).body.status).toBe('live');
    await s.send('ana', 'PUT', { definition: withFees(), testDays: [VERIFIED_TEST_DAY] });
    await s.send('ana', 'POST', { action: 'submit', summary: 'Card fees' });
    await s.send('ben', 'POST', { action: 'approve' });
    const back = await s.send('ben', 'POST', { action: 'rollback', to: 1, reason: 'Wrong rate' });
    expect(back.body.record.versions.at(-1)).toMatchObject({ version: 3, summary: 'Back to v1: Wrong rate' });
  });

  it('refuses to send a change whose tests fail, and says how many', async () => {
    const s = setup();
    const moved = updateFigure(EOD_DEFINITION, 'lunchNet', { formula: '[Lunch gross] − [Lunch VAT] − [Lunch discounts]' });
    await s.send('ana', 'PUT', { definition: moved, testDays: [VERIFIED_TEST_DAY] });
    expect(await s.send('ana', 'POST', { action: 'submit', summary: 'x' })).toMatchObject({ status: 422, body: { error: expect.stringMatching(/^5 tests failing/) } });
  });

  it('only lets head office in', async () => {
    const s = setup();
    expect((await s.call('nobody', 'GET')).status).toBe(401);
    expect((await s.call('mgr', 'GET')).status).toBe(200); // read-only: the live version, see below
    expect((await s.send('mgr', 'PUT', { definition: withFees(), testDays: [] })).status).toBe(403);
  });

  it('needs the ETag, and refuses a stale one so nobody overwrites someone else', async () => {
    const s = setup();
    expect((await s.call('ana', 'PUT', { definition: withFees(), testDays: [VERIFIED_TEST_DAY] })).status).toBe(428);
    const { etag } = await s.get();
    await s.call('ana', 'PUT', { definition: withFees(), testDays: [VERIFIED_TEST_DAY] }, etag);
    const stale = await s.call('ben', 'PUT', { definition: EOD_DEFINITION, testDays: [VERIFIED_TEST_DAY] }, etag);
    expect(stale.status).toBe(409);
    expect((await stale.json()).current.record.draft.by).toBe('Ana');
  });

  it('rejects anything that isn’t a definition', async () => {
    const s = setup();
    expect((await s.send('ana', 'PUT', 'not json')).status).toBe(400);
    expect((await s.send('ana', 'PUT', { definition: { figures: [{ id: 1 }] , actions: [] }, testDays: [] })).status).toBe(400);
    expect((await s.send('ana', 'PUT', { definition: EOD_DEFINITION, testDays: 'x' })).status).toBe(400);
    expect((await s.send('ana', 'POST', { action: 'publish-now' })).status).toBe(400);
    expect((await s.send('ana', 'PUT', { definition: EOD_DEFINITION, testDays: [VERIFIED_TEST_DAY], pad: 'x'.repeat(70_000) })).status).toBe(413);
    expect((await s.call('ana', 'DELETE', undefined, '"1"')).status).toBe(405);
  });

  it('says when the report hasn’t been set up', async () => {
    expect((await setup(new MemoryDefinitionStore()).get()).status).toBe(404);
  });

  it('answers 503 until the server is connected to SharePoint', async () => {
    const res = await netlifyFunction(new Request(URL_));
    expect(res.status).toBe(503);
  });
});

describe('report-definition for managers’ apps', () => {
  it('gives a manager only the version that’s live for a date, never drafts', async () => {
    const s = setup();
    await s.send('ana', 'PUT', { definition: withFees(), testDays: [VERIFIED_TEST_DAY] });
    const res = await s.call('mgr', 'GET');
    const body = await res.json();
    expect(body.date).toBe('2026-11-02');
    expect(body.version.version).toBe(1);
    expect(body.record).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('Card fees');
  });
  it('answers for the trading day asked about, and refuses a badly formed date', async () => {
    const s = setup();
    await s.send('ana', 'PUT', { definition: withFees(), testDays: [VERIFIED_TEST_DAY] });
    await s.send('ana', 'POST', { action: 'submit', summary: 'Card fees' });
    await s.send('ben', 'POST', { action: 'approve' }); // approved 2 Nov, live from 3 Nov
    const on = async (q: string) => { const r = await s.call('mgr', 'GET', undefined, null, q); return { status: r.status, body: await r.json() }; };
    expect((await on('?date=2026-11-02')).body.version.version).toBe(1);
    expect((await on('?date=2026-11-03')).body.version.version).toBe(2);
    expect((await on('?date=2026-11-03')).body.version.definition.figures.some((f: { name: string }) => f.name === 'Card fees')).toBe(true);
    expect((await on('?date=tomorrow')).status).toBe(400);
  });
  it('refuses a manager trying to change anything', async () => {
    const s = setup();
    expect((await s.send('mgr', 'POST', { action: 'approve' })).status).toBe(403);
  });
});
