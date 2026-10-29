import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, MemoryFlowOutbox, MemoryStore, submitReport, type EmailMessage, type SiteSettings } from '@maginhawa/core';
import { createEmailRetryJob, EMAIL_GRACE_MS } from '../src/email-retry';
import { verifiedDraft } from '../../../packages/core/test/fixtures';

const bun: SiteSettings = { ...DEFAULT_SETTINGS, siteCode: 'BUN', siteName: 'Bunso' };
const submittedAt = new Date('2026-10-05T23:31:00Z');

async function setup() {
  const store = new MemoryStore();
  const res = await submitReport(verifiedDraft(), { store, settings: bun, submittedBy: 'Jo', now: submittedAt });
  if (!res.ok) throw new Error(res.error);
  const sent: EmailMessage[] = [];
  const job = (at: Date, sendEmail = async (m: EmailMessage) => { sent.push(m); }) =>
    createEmailRetryJob({ sites: async () => [bun], store, sendEmail, now: () => at })();
  return { store, sent, job };
}

const later = (ms: number) => new Date(submittedAt.getTime() + ms);

describe('email-retry', () => {
  it('sends a summary that never went out, once', async () => {
    const { store, sent, job } = await setup();
    expect(await job(later(EMAIL_GRACE_MS + 1))).toEqual({ sent: ['BUN|2026-10-05'], failed: [] });
    expect((await store.get('BUN', '2026-10-05'))?.emailedAt).not.toBeNull();
    await job(later(EMAIL_GRACE_MS + 60_000));
    expect(sent).toHaveLength(1);
  });

  it('leaves a fresh submit alone, so it never races the submit’s own email', async () => {
    const { sent, job } = await setup();
    await job(later(60_000));
    expect(sent).toHaveLength(0);
  });

  it('skips reports already emailed, and drafts', async () => {
    const { store, sent, job } = await setup();
    await store.markEmailed('BUN', '2026-10-05', submittedAt);
    await store.saveDraft({ ...verifiedDraft(), businessDate: '2026-10-06', clientId: 'other' });
    await job(later(EMAIL_GRACE_MS + 1));
    expect(sent).toHaveLength(0);
  });

  it('keeps trying while mail is down', async () => {
    const { store, job } = await setup();
    expect(await job(later(EMAIL_GRACE_MS + 1), async () => { throw new Error('mail down'); })).toEqual({ sent: [], failed: ['BUN|2026-10-05'] });
    expect((await store.get('BUN', '2026-10-05'))?.emailedAt).toBeNull();
  });
});

describe('email-retry with Power Automate', () => {
  it('adds a flow message the submit never got to, once, without emailing finance again', async () => {
    const { store, sent } = await setup();
    await store.markEmailed('BUN', '2026-10-05', submittedAt);
    const flow = new MemoryFlowOutbox();
    const job = (at: Date) => createEmailRetryJob({ sites: async () => [bun], store, sendEmail: async (m) => { sent.push(m); }, now: () => at, flow })();
    expect(await job(later(EMAIL_GRACE_MS + 1))).toEqual({ sent: [], failed: [], queued: ['BUN|2026-10-05'], queueFailed: [] });
    expect(await job(later(EMAIL_GRACE_MS + 60_000))).toMatchObject({ queued: [] });
    expect(flow.items.size).toBe(1);
    expect(sent).toHaveLength(0);
  });
});
