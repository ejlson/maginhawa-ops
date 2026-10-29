import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, MemoryFlowOutbox, MemoryStore, type EmailMessage } from '@maginhawa/core';
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

  it('stamps when finance was emailed', async () => {
    const { handler, store } = setup();
    await handler(post(verifiedDraft()));
    expect((await store.get('BUN', '2026-10-05'))?.emailedAt).toBe('2026-10-05T23:31:00.000Z');
  });

  it('a retry sends the email the first attempt could not', async () => {
    let down = true;
    const sent: EmailMessage[] = [];
    const { handler, store } = setup({ sendEmail: async (m) => { if (down) throw new Error('mail down'); sent.push(m); } });
    expect((await (await handler(post(verifiedDraft()))).json()).emailed).toBe(false);
    expect((await store.get('BUN', '2026-10-05'))?.emailedAt).toBeNull();
    down = false;
    const again = await (await handler(post(verifiedDraft()))).json();
    expect(again).toMatchObject({ replayed: true, emailed: true });
    expect(sent).toHaveLength(1);
  });

  it('a retried upload does not create a duplicate, or email finance twice', async () => {
    const { handler, store, sent } = setup();
    await handler(post(verifiedDraft()));
    const again = await handler(post(verifiedDraft()));
    expect(again.status).toBe(200);
    expect((await again.json()).replayed).toBe(true);
    expect(await store.listByDate('2026-10-05')).toHaveLength(1);
    expect(sent).toHaveLength(1);
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

describe('submit-eod with the report builder', () => {
  it('works out the official figures with the version approved for that trading day', async () => {
    const { approveDefinition, disconnect, EOD_DEFINITION, saveDefinitionDraft, seedDefinitionRecord, submitDefinition, VERIFIED_TEST_DAY, computeDayWith, DEFAULT_SETTINGS: S } = await import('@maginhawa/core');
    const def = disconnect(disconnect(EOD_DEFINITION, 'Lunch service charge', 'lunchNet'), 'Dinner service charge', 'dinnerNet');
    const base = seedDefinitionRecord({ startsOn: '2026-09-01', by: 'Finance', at: '2026-09-01T09:00:00Z' });
    const expectNow = computeDayWith(verifiedDraft(), S, { netSales: 250000 }, { ...base, versions: [{ ...base.versions[0]!, definition: def }] }).definition!.figures;
    const testDays = [{ ...VERIFIED_TEST_DAY, expect: Object.fromEntries(Object.keys(VERIFIED_TEST_DAY.expect).map((id) => [id, expectNow[id]!])) }];
    let rec = saveDefinitionDraft(base, { definition: def, testDays, by: 'Ana', at: '2026-10-01T09:00:00Z' });
    rec = submitDefinition(rec, { summary: 'Service charge in net', by: 'Ana', at: '2026-10-01T09:00:00Z' });
    rec = approveDefinition(rec, { by: 'Ben', today: '2026-10-01', at: '2026-10-01T10:00:00Z' });
    const { handler, store, sent } = setup({ definitions: async () => rec });
    const res = await handler(post(verifiedDraft()));
    expect(res.status).toBe(200);
    const stored = await store.get('BUN', '2026-10-05');
    expect(stored!.official!.calcVersion).toBe('definition-v2');
    expect(stored!.official!.totalNet).toBe(304750);
    expect(sent[0]!.subject).toContain('£3,047.50 net');
  });
  it('with no approved version, the figures are today’s', async () => {
    const { handler, store } = setup({ definitions: async () => null });
    await handler(post(verifiedDraft()));
    expect((await store.get('BUN', '2026-10-05'))!.official!.totalNet).toBe(268750);
  });
});

describe('submit-eod with Power Automate', () => {
  it('hands the flow one message per submit, even when the upload is retried', async () => {
    const flow = new MemoryFlowOutbox();
    const { handler } = setup({ flow });
    const body = { draft: verifiedDraft(), baseVersion: null, submitId: 'press-1' };
    await handler(post(body));
    await handler(post(body));
    expect([...flow.items.keys()]).toEqual(['BUN|2026-10-05|press-1']);
    expect(flow.items.get('BUN|2026-10-05|press-1')!.summary.netText).toBe('£2,687.50');
  });

  it('still succeeds and emails finance when the outbox is down', async () => {
    const { handler, sent } = setup({ flow: { add: vi.fn().mockRejectedValue(new Error('SharePoint down')) } });
    const res = await handler(post(verifiedDraft()));
    expect(res.status).toBe(200);
    expect((await res.json()).emailed).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it('a retry adds the message the first attempt could not', async () => {
    let down = true;
    const box = new MemoryFlowOutbox();
    const { handler } = setup({ flow: { add: async (m) => { if (down) throw new Error('SharePoint down'); return box.add(m); } } });
    const body = { draft: verifiedDraft(), baseVersion: null, submitId: 'press-1' };
    await handler(post(body));
    expect(box.items.size).toBe(0);
    down = false;
    expect((await (await handler(post(body))).json()).replayed).toBe(true);
    expect(box.items.size).toBe(1);
  });
});
