/**
 * Two or more people on the same report or checklist at once, from different devices.
 * Each "device" is its own client; they share one backing store, like the server.
 * Times: 5 October 2026 is BST, so 20:14Z shows as 21:14.
 */
import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/store';
import { submitReport } from '../src/submit';
import { newDraft } from '../src/schema';
import { changedSections, mergeDrafts, SyncError } from '../src/sync';
import { EodSyncClient, storeRemote, type EodRemote } from '../src/eod-client';
import { MemoryChecklistStore, type RunStart } from '../src/checklist-sync';
import { ChecklistSyncClient } from '../src/checklist-client';
import { MemoryPresence, memoryKeyValue, presenceText } from '../src/live';
import { settings, verifiedDraft } from './fixtures';

const CLIENT_ID = '6f1c2b8e-1d2a-4c3b-9f00-000000000001';
const blank = () => newDraft({ clientId: CLIENT_ID, siteCode: 'BUN', businessDate: '2026-10-05', platformIds: ['deliveroo', 'ubereats'], now: new Date('2026-10-05T16:00:00Z') });

function backend() {
  const store = new MemoryStore();
  const presence = new MemoryPresence();
  const clock = { now: new Date('2026-10-05T20:00:00Z') };
  let online = true;
  const remote: EodRemote = storeRemote(
    store,
    (draft, o) => submitReport(draft, { store, settings, submittedBy: o.by, baseVersion: o.baseVersion, submitId: o.submitId, now: clock.now }),
    () => clock.now,
  );
  // A device that can lose signal: every call fails while offline.
  const flaky: EodRemote = {
    get: (...a) => (online ? remote.get(...a) : Promise.reject(new TypeError('Failed to fetch'))),
    saveDraft: (...a) => (online ? remote.saveDraft(...a) : Promise.reject(new TypeError('Failed to fetch'))),
    submit: (...a) => (online ? remote.submit(...a) : Promise.reject(new TypeError('Failed to fetch'))),
  };
  const device = (user: string, opts: { storage?: ReturnType<typeof memoryKeyValue> } = {}) =>
    new EodSyncClient({ remote: user === 'Phone' ? flaky : remote, siteCode: 'BUN', businessDate: '2026-10-05', user, deviceId: `${user}-device`, blank, presence, now: () => clock.now, storage: opts.storage, newId: () => `${user}-${Math.random()}` });
  return { store, clock, device, setOnline: (v: boolean) => { online = v; } };
}

/** Both devices open today's report, starting from the same saved version. */
async function twoOnOneReport() {
  const b = backend();
  const seed = verifiedDraft();
  seed.confirmed = false;
  await b.store.saveDraft(seed, { by: 'Jo', now: b.clock.now });
  const jo = b.device('Jo');
  const sam = b.device('Sam');
  await jo.refresh();
  await sam.refresh();
  return { ...b, jo, sam };
}

describe('versioned drafts', () => {
  it('every save gets a new version', async () => {
    const store = new MemoryStore();
    const a = await store.saveDraft(verifiedDraft(), { baseVersion: null, by: 'Jo' });
    const b = await store.saveDraft(verifiedDraft(), { baseVersion: a.version, by: 'Jo' });
    expect(a.version).toBeTruthy();
    expect(b.version).not.toBe(a.version);
  });

  it('refuses a stale save and hands back the newer draft', async () => {
    const store = new MemoryStore();
    const v1 = await store.saveDraft(verifiedDraft(), { baseVersion: null, by: 'Jo' });
    const jo = verifiedDraft(); jo.wages.wageCost = 81000;
    await store.saveDraft(jo, { baseVersion: v1.version, by: 'Jo' });
    const sam = verifiedDraft(); sam.tips.card = 20000;
    const err = await store.saveDraft(sam, { baseVersion: v1.version, by: 'Sam' }).catch((e) => e);
    expect(err).toBeInstanceOf(SyncError);
    expect(err.code).toBe('conflict');
    expect(err.current.draft.wages.wageCost).toBe(81000);
  });

  it('refuses to create a draft when one already exists', async () => {
    const store = new MemoryStore();
    await store.saveDraft(verifiedDraft(), { baseVersion: null, by: 'Jo' });
    await expect(store.saveDraft(verifiedDraft(), { baseVersion: null, by: 'Sam' })).rejects.toMatchObject({ code: 'conflict' });
  });

  it('stamps each changed section with who changed it and when', async () => {
    const store = new MemoryStore();
    const v1 = await store.saveDraft(verifiedDraft(), { by: 'Jo', now: new Date('2026-10-05T20:00:00Z') });
    const d = verifiedDraft(); d.sessions.dinner.gross = 250000;
    const v2 = await store.saveDraft(d, { baseVersion: v1.version, by: 'Sam', now: new Date('2026-10-05T20:14:00Z') });
    expect(v2.sections?.dinner).toEqual({ by: 'Sam', at: '2026-10-05T20:14:00.000Z' });
    expect(v2.sections?.lunch?.by).toBe('Jo');
  });
});

describe('section merge', () => {
  it('keeps sections only the other person changed and applies ours', () => {
    const base = verifiedDraft();
    const ours = structuredClone(base); ours.wages.wageCost = 82000;
    const theirs = structuredClone(base); theirs.sessions.dinner.walkins = 20;
    const m = mergeDrafts(base, ours, theirs);
    expect(m.clashes).toEqual([]);
    expect(m.fromOurs).toEqual(['wages']);
    expect(m.fromTheirs).toEqual(['dinner']);
    expect(m.draft.wages.wageCost).toBe(82000);
    expect(m.draft.sessions.dinner.walkins).toBe(20);
  });

  it('reports a clash only when both changed the same section differently', () => {
    const base = verifiedDraft();
    const ours = structuredClone(base); ours.sessions.dinner.gross = 250000;
    const theirs = structuredClone(base); theirs.sessions.dinner.gross = 260000;
    expect(mergeDrafts(base, ours, theirs).clashes).toEqual(['dinner']);
    const same = structuredClone(base); same.sessions.dinner.gross = 250000;
    expect(mergeDrafts(base, ours, same).clashes).toEqual([]);
  });

  it('drops the confirmation tick if the figures changed after it was ticked', () => {
    const base = verifiedDraft(); base.confirmed = false;
    const ours = structuredClone(base); ours.confirmed = true;
    const theirs = structuredClone(base); theirs.sessions.lunch.walkins = 30;
    expect(mergeDrafts(base, ours, theirs).draft.confirmed).toBe(false);
    expect(mergeDrafts(base, ours, structuredClone(base)).draft.confirmed).toBe(true);
  });

  it('two people filling different sections both keep their work', async () => {
    const { jo, sam, store } = await twoOnOneReport();
    await jo.edit((d) => { d.wages.wageCost = 82000; });
    await sam.edit((d) => { d.sessions.dinner.walkins = 20; });
    const stored = await store.get('BUN', '2026-10-05');
    expect(stored?.draft.wages.wageCost).toBe(82000);
    expect(stored?.draft.sessions.dinner.walkins).toBe(20);
    expect(sam.getState().status).toBe('saved');
    await jo.refresh();
    expect(jo.getState().draft.sessions.dinner.walkins).toBe(20);
    expect(jo.getState().notice).toBe('Sam changed Dinner at 21:00');
  });

  it('a real clash names who changed it, and the person picks', async () => {
    const { jo, sam, store, clock } = await twoOnOneReport();
    clock.now = new Date('2026-10-05T20:14:00Z');
    await jo.edit((d) => { d.sessions.dinner.gross = 250000; });
    clock.now = new Date('2026-10-05T20:15:00Z');
    await sam.edit((d) => { d.sessions.dinner.gross = 260000; d.wages.wageCost = 81000; });

    const s = sam.getState();
    expect(s.status).toBe('clash');
    expect(s.clashes).toEqual([{ section: 'dinner', message: 'Jo changed Dinner at 21:14', by: 'Jo', at: '2026-10-05T20:14:00.000Z' }]);
    // Nothing is lost while Sam decides: Sam's figure stays on screen, Jo's stays stored.
    expect(s.draft.sessions.dinner.gross).toBe(260000);
    expect((await store.get('BUN', '2026-10-05'))?.draft.sessions.dinner.gross).toBe(250000);

    await sam.resolve('dinner', 'theirs');
    const after = await store.get('BUN', '2026-10-05');
    expect(after?.draft.sessions.dinner.gross).toBe(250000);
    expect(after?.draft.wages.wageCost).toBe(81000);
    expect(sam.getState().status).toBe('saved');
  });

  it('keep mine overwrites only the clashed section', async () => {
    const { jo, sam, store } = await twoOnOneReport();
    await jo.edit((d) => { d.sessions.dinner.gross = 250000; d.tips.cash = 5000; });
    await sam.edit((d) => { d.sessions.dinner.gross = 260000; });
    await sam.resolve('dinner', 'mine');
    const stored = await store.get('BUN', '2026-10-05');
    expect(stored?.draft.sessions.dinner.gross).toBe(260000);
    expect(stored?.draft.tips.cash).toBe(5000);
  });

  it('an incoming change never overwrites a section being edited', async () => {
    const b = backend();
    await b.store.saveDraft(verifiedDraft(), { by: 'Jo', now: b.clock.now });
    const phone = b.device('Phone');
    const jo = b.device('Jo');
    await phone.refresh();
    await jo.refresh();
    // The phone's Wages edit hasn't reached the server yet when Jo's changes land.
    b.setOnline(false);
    await phone.edit((d) => { d.wages.wageCost = 79000; });
    await jo.edit((d) => { d.wages.wageCost = 85000; d.sessions.lunch.walkins = 15; });
    b.setOnline(true);
    await phone.refresh();
    const s = phone.getState();
    expect(s.draft.sessions.lunch.walkins).toBe(15);
    expect(s.draft.wages.wageCost).toBe(79000);
    expect(s.status).toBe('clash');
    expect(s.clashes.map((c) => c.section)).toEqual(['wages']);
  });

  it('polling is cheap when nothing changed', async () => {
    const { jo, store } = await twoOnOneReport();
    const remote = storeRemote(store, async () => { throw new Error('unused'); });
    const v = jo.getState().report!.version!;
    expect(await remote.get('BUN', '2026-10-05', v)).toBe('not-modified');
  });
});

describe('submit', () => {
  it('two people press Submit at once: exactly one wins, the other sees who sent it', async () => {
    const { jo, sam, store, clock } = await twoOnOneReport();
    await jo.edit((d) => { d.confirmed = true; });
    await sam.refresh();
    clock.now = new Date('2026-10-05T22:48:00Z');
    const [a, b] = await Promise.all([jo.submit(), sam.submit()]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const loser = a.ok ? b : a;
    const winner = a.ok ? 'Jo' : 'Sam';
    expect(loser).toMatchObject({ ok: false, code: 'already-submitted', error: `Already sent by ${winner} at 23:48` });
    expect(await store.listByDate('2026-10-05')).toHaveLength(1);
    const loserClient = a.ok ? sam : jo;
    expect(loserClient.getState()).toMatchObject({ status: 'locked', alreadySent: true, notice: `Already sent by ${winner} at 23:48` });
    expect(loserClient.getState().report?.submittedBy).toBe(winner);
  });

  it('a retry of the same press is a no-op, even after lost signal', async () => {
    const store = new MemoryStore();
    const first = await submitReport(verifiedDraft(), { store, settings, submittedBy: 'Jo', submitId: 'press-1' });
    const retry = await submitReport(verifiedDraft(), { store, settings, submittedBy: 'Jo', submitId: 'press-1' });
    expect(retry.ok).toBe(true);
    expect(retry.ok && first.ok && retry.report.version).toBe(first.ok && first.report.version);
    const other = await submitReport(verifiedDraft(), { store, settings, submittedBy: 'Sam', submitId: 'press-2' });
    expect(other).toMatchObject({ ok: false, code: 'already-submitted' });
  });

  it('refuses to submit figures the person has not seen', async () => {
    const { jo, sam, store, clock } = await twoOnOneReport();
    await jo.edit((d) => { d.confirmed = true; });
    await sam.refresh();
    // Jo changes Dinner after Sam last looked, so Sam's copy is stale.
    const stale = sam.getState().report!.version!;
    clock.now = new Date('2026-10-05T20:14:00Z');
    await jo.edit((d) => { d.sessions.dinner.walkins = 14; d.confirmed = true; });
    const res = await submitReport(sam.getState().draft, { store, settings, submittedBy: 'Sam', baseVersion: stale, submitId: 's1' });
    expect(res).toMatchObject({ ok: false, code: 'conflict', error: 'Jo changed Dinner at 21:14. Check it, then submit again.' });
  });

  it('a submit with lost signal keeps its id, so the retry cannot double-submit', async () => {
    const b = backend();
    await b.store.saveDraft(verifiedDraft(), { by: 'Jo', now: b.clock.now });
    const phone = b.device('Phone');
    await phone.refresh();
    b.setOnline(false);
    expect((await phone.submit()).ok).toBe(false);
    b.setOnline(true);
    expect((await phone.submit()).ok).toBe(true);
    expect((await phone.submit()).ok).toBe(false); // a fresh press on a sent day
    expect(await b.store.listByDate('2026-10-05')).toHaveLength(1);
  });

  it('a sent day stops taking edits on every device', async () => {
    const { jo, sam } = await twoOnOneReport();
    await jo.edit((d) => { d.confirmed = true; });
    expect((await jo.submit()).ok).toBe(true);
    await sam.refresh();
    expect(sam.getState().status).toBe('locked');
    await sam.edit((d) => { d.wages.wageCost = 1; });
    expect(sam.getState().draft.wages.wageCost).toBe(80000);
  });
});

describe('offline', () => {
  it('queues saves on the device and replays them, version-checked, when back', async () => {
    const b = backend();
    await b.store.saveDraft(verifiedDraft(), { by: 'Jo', now: b.clock.now });
    const storage = memoryKeyValue();
    const phone = b.device('Phone', { storage });
    const jo = b.device('Jo');
    await phone.refresh();
    await jo.refresh();

    b.setOnline(false);
    await phone.edit((d) => { d.tips.cash = 6000; });
    expect(phone.getState().status).toBe('offline');
    // Meanwhile Jo changes another section from the iPad.
    await jo.edit((d) => { d.sessions.lunch.walkins = 16; });

    // The phone app is closed and reopened: the queue survives on the device.
    const reopened = b.device('Phone', { storage });
    expect(reopened.getState().draft.tips.cash).toBe(6000);
    b.setOnline(true);
    await reopened.refresh();
    const stored = await b.store.get('BUN', '2026-10-05');
    expect(stored?.draft.tips.cash).toBe(6000);
    expect(stored?.draft.sessions.lunch.walkins).toBe(16);
    expect(reopened.getState().status).toBe('saved');
  });

  it('edits made offline while someone else submitted are named, not dropped quietly', async () => {
    const b = backend();
    await b.store.saveDraft(verifiedDraft(), { by: 'Jo', now: b.clock.now });
    const phone = b.device('Phone');
    const jo = b.device('Jo');
    await phone.refresh();
    await jo.refresh();

    b.setOnline(false);
    await phone.edit((d) => { d.tips.cash = 6000; });
    expect((await jo.submit()).ok).toBe(true);
    b.setOnline(true);
    await phone.refresh();

    const s = phone.getState();
    expect(s.status).toBe('locked');
    expect(s.draft.tips.cash).not.toBe(6000);
    expect(s.alreadySent).toBe(true);
    expect(s.notice).toMatch(/^Already sent by Jo at \d\d:\d\d\. Your changes to Tips & service charge were not included\. Ask finance to reopen it\.$/);
  });
});

describe('presence', () => {
  it('says who else is in which section', async () => {
    const { jo, sam } = await twoOnOneReport();
    jo.setWhere('Dinner');
    await jo.refresh();
    await sam.refresh();
    expect(presenceText(sam.getState().others)).toBe('Jo is in Dinner');
    expect(presenceText(jo.getState().others)).toBe('Sam is here too');
  });
});

describe('shared checklists', () => {
  const run: RunStart = { key: '2026-10-05|close|22:00', templateId: 'close', businessDate: '2026-10-05', dueTime: '22:00' };
  function twoOnOneChecklist() {
    const backend = new MemoryChecklistStore();
    let t = Date.parse('2026-10-05T20:00:00Z');
    const now = () => new Date((t += 1000));
    const device = (user: string) => new ChecklistSyncClient({ backend, siteCode: 'BUN', businessDate: '2026-10-05', user, deviceId: user, now });
    return { backend, jo: device('Jo'), sam: device('Sam') };
  }

  it('two people answering different items both keep their answers', async () => {
    const { jo, sam } = twoOnOneChecklist();
    await Promise.all([jo.answer(run, 'fridge', 4), sam.answer(run, 'doors', true)]);
    await jo.refresh();
    await sam.refresh();
    for (const c of [jo, sam]) {
      expect(c.getState().runs[run.key]?.answers).toEqual({ fridge: 4, doors: true });
      expect(c.getState().runs[run.key]?.answeredBy?.fridge?.by).toBe('Jo');
      expect(c.getState().runs[run.key]?.answeredBy?.doors?.by).toBe('Sam');
    }
  });

  it('the same item is last-write-wins, and shows who answered it', async () => {
    const { jo, sam } = twoOnOneChecklist();
    await jo.answer(run, 'fridge', 4);
    await sam.answer(run, 'fridge', 6);
    await jo.refresh();
    expect(jo.getState().runs[run.key]?.answers.fridge).toBe(6);
    expect(jo.getState().runs[run.key]?.answeredBy?.fridge?.by).toBe('Sam');
  });

  it('a late upload from an offline phone cannot overwrite a newer answer', async () => {
    const backend = new MemoryChecklistStore();
    await backend.apply('BUN', [{ kind: 'answer', run, checkpointId: 'fridge', value: 6, by: 'Sam', at: '2026-10-05T20:10:00Z' }]);
    const [late] = await backend.apply('BUN', [{ kind: 'answer', run, checkpointId: 'fridge', value: 4, by: 'Jo', at: '2026-10-05T20:05:00Z' }]);
    expect(late).toMatchObject({ ok: true, answer: { value: 6, answeredBy: 'Sam' } });
  });

  it('a second Finish is a no-op that says who finished', async () => {
    const { jo, sam } = twoOnOneChecklist();
    await jo.answer(run, 'fridge', 4);
    await sam.refresh(); // Both have seen every answer.
    const [a, b] = await Promise.all([jo.finish(run), sam.finish(run)]);
    expect([a.already, b.already].sort()).toEqual([false, true]);
    const loser = a.already ? a : b;
    expect(loser.message).toMatch(/^Submitted by (Jo|Sam) at 21:00$/);
    await jo.refresh();
    await sam.refresh();
    expect(jo.getState().runs[run.key]?.completedBy).toBe(sam.getState().runs[run.key]?.completedBy);
  });

  it('answers sent after someone finished are refused, and the person is told', async () => {
    const { jo, sam } = twoOnOneChecklist();
    await jo.finish(run);
    await sam.answer(run, 'fridge', 9);
    await sam.refresh();
    expect(sam.getState().runs[run.key]?.answers.fridge).toBeUndefined();
    expect(sam.getState().refused).toEqual([
      { runKey: run.key, checkpointId: 'fridge', message: expect.stringMatching(/^Not saved: submitted by Jo at \d\d:\d\d before your answer arrived/) },
    ]);
    sam.dismissRefused(run.key);
    expect(sam.getState().refused).toEqual([]);
  });

  it("Finish stops if someone else answered since this person last looked", async () => {
    const { jo, sam } = twoOnOneChecklist();
    await jo.answer(run, 'fridge', 4);
    await sam.refresh();
    await jo.answer(run, 'fridge', 9); // A failing temperature Sam hasn't seen yet.
    const out = await sam.finish(run);
    expect(out).toMatchObject({ stale: true, already: false });
    expect(sam.getState().runs[run.key]?.completedAt).toBeNull();
    expect(sam.getState().runs[run.key]?.answers.fridge).toBe(9); // Now on Sam's screen.
    expect((await sam.finish(run)).stale).toBe(false); // Seen it: the second press locks.
  });

  it('the server refuses a Finish that missed an answer, even if the device did not catch up first', async () => {
    const backend = new MemoryChecklistStore();
    const [first] = await backend.apply('BUN', [{ kind: 'answer', run, checkpointId: 'fridge', value: 4, by: 'Sam', at: '2026-10-05T20:00:00Z' }]);
    const seen = first!.ok ? first!.answer!.seq : 0;
    await backend.apply('BUN', [{ kind: 'answer', run, checkpointId: 'freezer', value: -5, by: 'Jo', at: '2026-10-05T20:01:00Z' }]);
    const [stale] = await backend.apply('BUN', [{ kind: 'finish', run, by: 'Sam', at: '2026-10-05T20:02:00Z', seen }]);
    expect(stale).toMatchObject({ ok: false, reason: 'stale', answers: [{ checkpointId: 'freezer', answeredBy: 'Jo' }] });
    // Sam's own answers in the same batch as the Finish count as seen.
    const out = await backend.apply('BUN', [
      { kind: 'answer', run, checkpointId: 'doors', value: true, by: 'Sam', at: '2026-10-05T20:03:00Z' },
      { kind: 'finish', run, by: 'Sam', at: '2026-10-05T20:03:00Z', seen: seen + 2 },
    ]);
    expect(out[1]).toMatchObject({ ok: true, run: { completedBy: 'Sam' } });
  });

  it('a device clock running fast cannot claim the future', async () => {
    const backend = new MemoryChecklistStore(() => new Date('2026-10-05T20:00:00Z'));
    const [fast] = await backend.apply('BUN', [{ kind: 'answer', run, checkpointId: 'fridge', value: 4, by: 'Jo', at: '2026-10-05T23:59:00Z' }]);
    expect(fast).toMatchObject({ ok: true, answer: { answeredAt: '2026-10-05T20:00:00.000Z' } });
  });

  it('polling only fetches what changed', async () => {
    const { backend, jo } = twoOnOneChecklist();
    await jo.answer(run, 'fridge', 4);
    const all = await backend.changes('BUN', '2026-10-05', 0);
    expect(all.answers).toHaveLength(1);
    expect((await backend.changes('BUN', '2026-10-05', all.cursor)).answers).toHaveLength(0);
  });
});
