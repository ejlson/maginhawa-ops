import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, MemoryChecklistStore, MemoryPresence, MemoryStore, type RunStart } from '@maginhawa/core';
import { createSubmitHandler, type Caller } from '../src/handler';
import { createChecklistSyncHandler, createEodDraftHandler, createPresenceHandler } from '../src/sync-handlers';
import eodDraftFunction from '../netlify/functions/eod-draft';
import checklistFunction from '../netlify/functions/checklist-sync';
import { verifiedDraft } from '../../../packages/core/test/fixtures';

const people: Record<string, Caller> = { jo: { name: 'Jo', siteCodes: ['BUN'], role: 'manager' }, sam: { name: 'Sam', siteCodes: ['BUN'], role: 'staff' } };
const authenticate = async (req: Request) => people[(req.headers.get('Authorization') ?? '').replace('Bearer ', '')] ?? null;
const req = (method: string, path: string, who: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://ops.example/.netlify/functions/${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${who}`, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('eod-draft', () => {
  it('saves with a version check, and a stale save gets 409 with the newer draft', async () => {
    const store = new MemoryStore();
    const handler = createEodDraftHandler({ authenticate, store });
    const first = await (await handler(req('PUT', 'eod-draft', 'jo', { draft: verifiedDraft(), baseVersion: null }))).json();
    const jo = verifiedDraft(); jo.wages.wageCost = 81000;
    expect((await handler(req('PUT', 'eod-draft', 'jo', { draft: jo, baseVersion: first.report.version }))).status).toBe(200);
    const sam = verifiedDraft(); sam.tips.card = 1;
    const res = await handler(req('PUT', 'eod-draft', 'sam', { draft: sam, baseVersion: first.report.version }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('conflict');
    expect(body.current.draft.wages.wageCost).toBe(81000);
    expect(body.current.sections.wages.by).toBe('Jo');
  });

  it('answers 304 when nothing changed, so polling stays cheap', async () => {
    const store = new MemoryStore();
    const saved = await store.saveDraft(verifiedDraft(), { by: 'Jo' });
    const handler = createEodDraftHandler({ authenticate, store });
    const res = await handler(req('GET', 'eod-draft?site=BUN&date=2026-10-05', 'jo', undefined, { 'If-None-Match': `"${saved.version}"` }));
    expect(res.status).toBe(304);
    const fresh = await handler(req('GET', 'eod-draft?site=BUN&date=2026-10-05', 'jo'));
    expect(fresh.headers.get('ETag')).toBe(`"${saved.version}"`);
  });

  it('stamps sections with the signed-in person, not what the device claims', async () => {
    const store = new MemoryStore();
    const handler = createEodDraftHandler({ authenticate, store });
    const res = await (await handler(req('PUT', 'eod-draft', 'sam', { draft: verifiedDraft(), baseVersion: null, by: 'Jo' }))).json();
    expect(res.report.sections.lunch.by).toBe('Sam');
  });

  it('only for your own site', async () => {
    const handler = createEodDraftHandler({ authenticate, store: new MemoryStore() });
    expect((await handler(req('GET', 'eod-draft?site=RAM&date=2026-10-05', 'jo'))).status).toBe(403);
  });
});

describe('submit-eod with two devices', () => {
  it('the second submit gets 409 "Already sent by Jo at 23:48" and the sent report', async () => {
    const store = new MemoryStore();
    const submit = createSubmitHandler({
      authenticate, store, settingsFor: async () => DEFAULT_SETTINGS, sendEmail: async () => undefined,
      now: () => new Date('2026-10-05T22:48:00Z'),
    });
    const saved = await store.saveDraft(verifiedDraft(), { by: 'Jo' });
    const first = await submit(req('POST', 'submit-eod', 'jo', { draft: verifiedDraft(), baseVersion: saved.version, submitId: 'jo-1' }));
    expect(first.status).toBe(200);
    const retry = await submit(req('POST', 'submit-eod', 'jo', { draft: verifiedDraft(), baseVersion: saved.version, submitId: 'jo-1' }));
    expect(retry.status).toBe(200);
    const second = await submit(req('POST', 'submit-eod', 'sam', { draft: verifiedDraft(), baseVersion: saved.version, submitId: 'sam-1' }));
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body).toMatchObject({ code: 'already-submitted', error: 'Already sent by Jo at 23:48' });
    expect(body.current.submittedBy).toBe('Jo');
    expect(await store.listByDate('2026-10-05')).toHaveLength(1);
  });
});

describe('checklist-sync', () => {
  const run: RunStart = { key: '2026-10-05|close|22:00', templateId: 'close', businessDate: '2026-10-05', dueTime: '22:00' };

  it('takes a batch, signs it with the caller, and returns changes since a cursor', async () => {
    const store = new MemoryChecklistStore();
    const handler = createChecklistSyncHandler({ authenticate, store });
    const ops = [
      { kind: 'answer', run, checkpointId: 'fridge', value: 4, by: 'Anyone', at: '2026-10-05T20:00:00Z' },
      { kind: 'answer', run, checkpointId: 'doors', value: true, by: 'Anyone', at: '2026-10-05T20:00:01Z' },
    ];
    const res = await (await handler(req('POST', 'checklist-sync', 'jo', { siteCode: 'BUN', ops }))).json();
    expect(res.outcomes).toHaveLength(2);
    expect(res.outcomes[0].answer.answeredBy).toBe('Jo');
    const all = await (await handler(req('GET', 'checklist-sync?site=BUN&date=2026-10-05&since=0', 'sam'))).json();
    expect(all.answers).toHaveLength(2);
    const none = await (await handler(req('GET', `checklist-sync?site=BUN&date=2026-10-05&since=${all.cursor}`, 'sam'))).json();
    expect(none.answers).toHaveLength(0);
  });

  it('a second Finish says who finished first', async () => {
    const handler = createChecklistSyncHandler({ authenticate, store: new MemoryChecklistStore() });
    const finish = (who: string, at: string) => handler(req('POST', 'checklist-sync', who, { siteCode: 'BUN', ops: [{ kind: 'finish', run, by: who, at }] })).then((r) => r.json());
    await finish('jo', '2026-10-05T20:02:00Z');
    const second = await finish('sam', '2026-10-05T20:02:01Z');
    expect(second.outcomes[0]).toMatchObject({ ok: true, already: true, run: { completedBy: 'Jo' } });
  });

  it('only supervisors and above can correct a finished checklist, and the old answer is kept', async () => {
    const handler = createChecklistSyncHandler({ authenticate, store: new MemoryChecklistStore() });
    const post = (who: string, ops: unknown[]) => handler(req('POST', 'checklist-sync', who, { siteCode: 'BUN', ops }));
    await post('sam', [{ kind: 'answer', run, checkpointId: 'fridge', value: 9, by: 'Sam', at: '2026-10-05T20:00:00Z' }, { kind: 'finish', run, by: 'Sam', at: '2026-10-05T20:01:00Z' }]);
    const correct = { kind: 'correct', run, checkpointId: 'fridge', value: 4, reason: 'Read the wrong fridge', by: 'Anyone', at: '2026-10-05T20:05:00Z' };
    expect((await post('sam', [correct])).status).toBe(403);
    const ok = await (await post('jo', [correct])).json();
    expect(ok.outcomes[0].answer).toMatchObject({ value: 4, answeredBy: 'Sam', corrections: [{ previous: 9, value: 4, by: 'Jo', reason: 'Read the wrong fridge' }] });
  });
});

describe('presence', () => {
  it('returns who else is here', async () => {
    const handler = createPresenceHandler({ authenticate, presence: new MemoryPresence(), now: () => new Date('2026-10-05T20:00:00Z') });
    await handler(req('POST', 'presence', 'jo', { scope: 'BUN|2026-10-05|eod', deviceId: 'ipad', where: 'Dinner' }));
    const res = await (await handler(req('POST', 'presence', 'sam', { scope: 'BUN|2026-10-05|eod', deviceId: 'phone', where: null }))).json();
    expect(res.others).toEqual([{ deviceId: 'ipad', who: 'Jo', where: 'Dinner', at: '2026-10-05T20:00:00.000Z' }]);
  });
});

describe('before SharePoint is connected', () => {
  it('the new functions answer 503 too', async () => {
    expect((await eodDraftFunction(req('GET', 'eod-draft?site=BUN', 'jo'))).status).toBe(503);
    expect((await checklistFunction(req('GET', 'checklist-sync?site=BUN', 'jo'))).status).toBe(503);
  });
});
