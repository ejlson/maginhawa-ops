import { describe, expect, it } from 'vitest';
import { MemorySiteFlowStore } from '@maginhawa/core';
import { createSiteFlowHandler } from '../src/site-flow-handler';
import type { Caller } from '../src/handler';

const url = 'https://ops.example/api/site-flow';
const post = (body: unknown) => new Request(url, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const headOffice: Caller = { name: '[Finance]', siteCodes: ['BUN'], role: 'headoffice' };

function setup({ caller = headOffice as Caller | null, available = true } = {}) {
  const store = new MemorySiteFlowStore();
  let now = new Date('2026-10-05T10:00:00Z');
  const handler = createSiteFlowHandler({ authenticate: async () => caller, store, available, now: () => now });
  return { handler, store, tick: (at: string) => { now = new Date(at); } };
}

describe('site-flow', () => {
  it('switches one site on with the time, and off again', async () => {
    const { handler, store } = setup();
    const res = await handler(post({ siteCode: 'BUN', on: true }));
    expect(await res.json()).toEqual({ available: true, sites: { BUN: '2026-10-05T10:00:00.000Z' } });
    await handler(post({ siteCode: 'BUN', on: false }));
    expect(await store.list()).toEqual({});
  });

  it('keeps the original date when a site is switched on twice', async () => {
    const { handler, store, tick } = setup();
    await handler(post({ siteCode: 'BUN', on: true }));
    tick('2026-10-06T10:00:00Z');
    await handler(post({ siteCode: 'BUN', on: true }));
    expect((await store.list()).BUN).toBe('2026-10-05T10:00:00.000Z');
  });

  it('is for head office only', async () => {
    expect((await setup({ caller: null }).handler(new Request(url))).status).toBe(401);
    const manager: Caller = { name: '[Manager]', siteCodes: ['BUN'], role: 'manager' };
    expect((await setup({ caller: manager }).handler(new Request(url))).status).toBe(403);
    expect((await setup({ caller: manager }).handler(post({ siteCode: 'BUN', on: true }))).status).toBe(403);
  });

  it('can be read but not changed until the flow is set up', async () => {
    const { handler, store } = setup({ available: false });
    expect(await (await handler(new Request(url))).json()).toEqual({ available: false, sites: {} });
    expect((await handler(post({ siteCode: 'BUN', on: true }))).status).toBe(409);
    expect(await store.list()).toEqual({});
  });

  it('refuses closed sites and bad requests', async () => {
    const { handler } = setup();
    expect((await handler(post({ siteCode: 'RAM', on: true }))).status).toBe(400);
    expect((await handler(post({ siteCode: 'BUN', on: 'yes' }))).status).toBe(400);
    expect((await handler(post('not json'))).status).toBe(400);
    expect((await handler(new Request(url, { method: 'PUT' }))).status).toBe(405);
  });
});
