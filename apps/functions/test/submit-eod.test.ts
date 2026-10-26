import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, MemoryStore, type EmailMessage } from '@maginhawa/core';
import { createSubmitHandler, type SubmitDeps } from '../src/handler';
import netlifyFunction from '../netlify/functions/submit-eod';
import { verifiedDraft } from '../../../packages/core/test/fixtures';

const post = (body: unknown, token = 'good') =>
  new Request('https://ops.example/.netlify/functions/submit-eod', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

function setup(overrides: Partial<SubmitDeps> = {}) {
  const store = new MemoryStore();
  const sent: EmailMessage[] = [];
  const handler = createSubmitHandler({
    authenticate: async (req) => (req.headers.get('Authorization') === 'Bearer good' ? { name: '[Manager]', siteCodes: ['BUN'] } : null),
    store,
    settingsFor: async (code) => (code === 'BUN' ? DEFAULT_SETTINGS : null),
    targetNetFor: async () => 250000,
    sendEmail: async (m) => { sent.push(m); },
    now: () => new Date('2026-10-05T23:31:00Z'),
    ...overrides,
  });
  return { handler, store, sent };
}

describe('submit-eod', () => {
  it('stores official figures and emails finance', async () => {
    const { handler, store, sent } = setup();
    const res = await handler(post(verifiedDraft()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report.official.totalNet).toBe(268750);
    expect(body.report.official.netVsTarget).toBe(18750);
    expect(body.emailed).toBe(true);
    expect((await store.get('BUN', '2026-10-05'))?.status).toBe('submitted');
    expect(sent[0]?.subject).toBe('EOD · Bunso · Monday 5 October · £2,687.50 net');
  });

  it('rejects people who are not signed in', async () => {
    const { handler } = setup();
    expect((await handler(post(verifiedDraft(), 'bad'))).status).toBe(401);
  });

  it('rejects a report for someone else\'s site', async () => {
    const { handler } = setup();
    const res = await handler(post({ ...verifiedDraft(), siteCode: 'RAM' }));
    expect(res.status).toBe(403);
  });

  it('rejects anything but POST', async () => {
    const { handler } = setup();
    expect((await handler(new Request('https://ops.example/x'))).status).toBe(405);
  });

  it('rejects a body that is not JSON', async () => {
    const { handler } = setup();
    expect((await handler(post('not json'))).status).toBe(400);
  });

  it('refuses a report with something blocking, and says why', async () => {
    const { handler, store } = setup();
    const d = verifiedDraft();
    d.sessions.lunch.cash.tillCash = 1;
    const res = await handler(post(d));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.issues.some((i: { code: string }) => i.code === 'cash-unexplained')).toBe(true);
    expect(await store.get('BUN', '2026-10-05')).toBeNull();
  });

  it('still succeeds when the email fails, so nobody resubmits', async () => {
    const { handler, store } = setup({ sendEmail: vi.fn().mockRejectedValue(new Error('mail down')) });
    const res = await handler(post(verifiedDraft()));
    expect(res.status).toBe(200);
    expect((await res.json()).emailed).toBe(false);
    expect((await store.get('BUN', '2026-10-05'))?.status).toBe('submitted');
  });

  it('a retried upload does not create a duplicate', async () => {
    const { handler, store, sent } = setup();
    await handler(post(verifiedDraft()));
    const again = await handler(post(verifiedDraft()));
    expect(again.status).toBe(200);
    expect(await store.listByDate('2026-10-05')).toHaveLength(1);
    expect(sent).toHaveLength(2);
  });
});

describe('the deployed function before SharePoint is connected', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('answers 503 with a clear message and lists what is missing', async () => {
    const res = await netlifyFunction(post(verifiedDraft()));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/not connected to SharePoint yet/);
    expect(body.missing).toContain('SHAREPOINT_SITE_ID');
  });
});
