/**
 * One device's copy of today's report. Framework-free, so the screens (React) and the
 * tests (two clients sharing one store) use exactly the same logic.
 *
 * - Every edit shows straight away and is saved with the version it started from.
 * - A stale save is merged section by section; only a real clash stops and asks.
 * - Incoming changes (polling or push) are merged the same way, so a section someone is
 *   typing in is never overwritten.
 * - Without signal, the edits stay on the device and are replayed, version-checked, later.
 * - Submit is one conditional write with a per-press id, so retries are safe.
 */
import type { EodDraft, SectionKey } from './schema';
import { isEditable, type StoredReport } from './store';
import type { SubmitResult } from './submit';
import {
  alreadySentMessage, changedByMessage, changedSections, copySection, isSyncError, mergeDrafts, sameSection,
} from './sync';
import type { KeyValue, Presence, PresenceRemote } from './live';
import { SECTION_LABELS } from './checks';

/** What the device talks to: the Netlify Functions in connected mode, a local store in demo mode. */
export interface EodRemote {
  /** 'not-modified' when the stored version still equals `ifNoneMatch`. */
  get(siteCode: string, businessDate: string, ifNoneMatch: string | null): Promise<StoredReport | null | 'not-modified'>;
  /** Throws SyncError ('conflict' or 'locked'); any other error means "no connection". */
  saveDraft(draft: EodDraft, opts: { baseVersion: string | null; by: string }): Promise<StoredReport>;
  /** Network failures throw; everything else comes back as a SubmitResult. */
  submit(draft: EodDraft, opts: { baseVersion: string | null; submitId: string; by: string }): Promise<SubmitResult>;
}

export type EodSyncStatus = 'saved' | 'saving' | 'offline' | 'clash' | 'locked';

export interface Clash {
  section: SectionKey;
  /** "Jo changed Dinner at 21:14" */
  message: string;
  by: string | null;
  at: string | null;
}

export interface EodSyncState {
  /** What is on screen. */
  draft: EodDraft;
  /** The last stored copy this device has seen. */
  report: StoredReport | null;
  status: EodSyncStatus;
  clashes: Clash[];
  /** A short message for the person: who else changed what, or who already sent it. */
  notice: string | null;
  /** True when the notice is "already sent", so the screen can link to the sent report. */
  alreadySent: boolean;
  others: Presence[];
  savedAt: string | null;
}

interface Saved {
  base: StoredReport | null;
  draft: EodDraft;
  dirty: boolean;
}

export interface EodClientOptions {
  remote: EodRemote;
  siteCode: string;
  businessDate: string;
  /** The person using this device, for the section stamps and messages. */
  user: string;
  deviceId: string;
  /** A fresh blank report, used when nothing is stored yet. */
  blank: () => EodDraft;
  /** The stored copy, if it can be read straight away (demo mode), so the first screen isn't blank. */
  initial?: StoredReport | null;
  /** Offline queue. Left out = in memory only. */
  storage?: KeyValue;
  presence?: PresenceRemote;
  newId?: () => string;
  now?: () => Date;
}

/** "Wages", "Wages and Tips", "Lunch, Wages and Tips" */
function listSections(keys: SectionKey[]) {
  const names = keys.map((k) => SECTION_LABELS[k]);
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const differs = (a: EodDraft, b: EodDraft) => changedSections(a, b).length > 0 || a.confirmed !== b.confirmed;

export class EodSyncClient {
  private base: StoredReport | null;
  private draft: EodDraft;
  private dirty: boolean;
  private clashes: Clash[] = [];
  private offline = false;
  private notice: string | null = null;
  private alreadySent = false;
  private others: Presence[] = [];
  private savedAt: string | null = null;
  private where: string | null = null;
  private submitId: string | null = null;
  private flushing: Promise<void> | null = null;
  /** Bumped whenever a newer stored copy arrives, so a slower fetch can't roll it back. */
  private epoch = 0;
  private listeners = new Set<() => void>();
  private snapshot: EodSyncState;
  private readonly key: string;

  constructor(private o: EodClientOptions) {
    this.key = `mgh.sync.eod.v1.${o.siteCode}|${o.businessDate}`;
    let saved = o.storage?.get<Saved | null>(this.key, null) ?? null;
    // Edits still waiting to send win; otherwise start from the freshest stored copy.
    if (o.initial && !saved?.dirty) saved = { base: o.initial, draft: o.initial.draft, dirty: false };
    this.base = saved?.base ?? null;
    this.draft = saved?.draft ?? o.blank();
    this.dirty = saved?.dirty ?? false;
    this.savedAt = this.base ? this.base.draft.updatedAt : null;
    this.snapshot = this.makeSnapshot();
  }

  // ── reading ──────────────────────────────────────────────────────────

  getState = (): EodSyncState => this.snapshot;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  private status(): EodSyncStatus {
    if (this.base && !isEditable(this.base.status)) return 'locked';
    if (this.clashes.length) return 'clash';
    if (this.dirty && this.offline) return 'offline';
    if (this.dirty || this.flushing) return 'saving';
    return 'saved';
  }

  private makeSnapshot(): EodSyncState {
    return {
      draft: this.draft, report: this.base, status: this.status(), clashes: this.clashes,
      notice: this.notice, alreadySent: this.alreadySent, others: this.others, savedAt: this.savedAt,
    };
  }

  private changed() {
    this.o.storage?.set(this.key, { base: this.base, draft: this.draft, dirty: this.dirty } satisfies Saved);
    this.snapshot = this.makeSnapshot();
    for (const fn of this.listeners) fn();
  }

  private now() { return this.o.now?.() ?? new Date(); }

  // ── editing ──────────────────────────────────────────────────────────

  /** Applies a change on screen at once, then saves it. Ignored once the day is sent. */
  edit(change: (d: EodDraft) => void): Promise<void> {
    if (this.base && !isEditable(this.base.status)) return Promise.resolve();
    const next = structuredClone(this.draft);
    change(next);
    next.updatedAt = this.now().toISOString();
    this.draft = next;
    this.dirty = true;
    this.changed();
    return this.flush();
  }

  /** Saves until nothing is left, merging if someone else saved in between. */
  flush(): Promise<void> {
    if (!this.flushing) {
      this.flushing = this.runFlush().finally(() => { this.flushing = null; this.changed(); });
      this.changed();
    }
    return this.flushing;
  }

  private async runFlush() {
    while (this.dirty && !this.clashes.length && !(this.base && !isEditable(this.base.status))) {
      const sent = this.draft;
      try {
        const saved = await this.o.remote.saveDraft(sent, { baseVersion: this.base?.version ?? null, by: this.o.user });
        this.offline = false;
        this.epoch++;
        this.base = saved;
        this.savedAt = this.now().toISOString();
        if (this.draft === sent) {
          this.draft = saved.draft;
          this.dirty = false;
        }
      } catch (e) {
        if (isSyncError(e)) {
          this.absorb(e.current);
          continue;
        }
        this.offline = true;
        return;
      } finally {
        this.changed();
      }
    }
  }

  /** Merges a stored copy that is newer than ours into what is on screen. */
  private absorb(incoming: StoredReport) {
    this.epoch++;
    const before = this.base?.draft ?? null;
    if (!isEditable(incoming.status)) {
      // Our edits that never reached the server and aren't in what was sent: say so, don't drop them quietly.
      const lost = this.dirty ? changedSections(before, this.draft).filter((k) => !sameSection(this.draft, incoming.draft, k)) : [];
      this.base = incoming;
      this.draft = incoming.draft;
      this.dirty = false;
      this.clashes = [];
      if ((incoming.submittedBy && incoming.submittedBy !== this.o.user) || lost.length) {
        this.notice = alreadySentMessage(incoming) + (lost.length ? `. Your changes to ${listSections(lost)} were not included. Ask finance to reopen it.` : '');
        this.alreadySent = true;
      }
      return;
    }
    // Nothing to announce on the first load.
    const theirs = before === null ? [] : changedSections(before, incoming.draft).filter((k) => incoming.sections?.[k]?.by !== this.o.user);
    if (!this.dirty) {
      this.base = incoming;
      this.draft = incoming.draft;
    } else {
      const m = mergeDrafts(before, this.draft, incoming.draft);
      // A clash still open from before stays open until the person picks.
      const open = this.clashes.map((c) => c.section).filter((k) => !m.clashes.includes(k) && !sameSection(m.draft, incoming.draft, k));
      this.base = incoming;
      this.draft = m.draft;
      this.clashes = [...m.clashes, ...open].map((section) => {
        const stamp = incoming.sections?.[section];
        return { section, message: changedByMessage(section, stamp), by: stamp?.by ?? null, at: stamp?.at ?? null };
      });
      this.dirty = differs(incoming.draft, m.draft);
    }
    const quiet = theirs.filter((k) => !this.clashes.some((c) => c.section === k));
    if (quiet.length) this.notice = quiet.map((k) => changedByMessage(k, incoming.sections?.[k])).join(' · ');
  }

  /** Settles a clash: keep what this person typed, or take the other person's. */
  resolve(section: SectionKey, keep: 'mine' | 'theirs'): Promise<void> {
    if (keep === 'theirs' && this.base) {
      const next = structuredClone(this.draft);
      copySection(next, this.base.draft, section);
      this.draft = next;
    }
    this.clashes = this.clashes.filter((c) => c.section !== section);
    this.dirty = this.base ? differs(this.base.draft, this.draft) : true;
    this.changed();
    return this.flush();
  }

  dismissNotice() {
    this.notice = null;
    this.alreadySent = false;
    this.changed();
  }

  /** What this person has open, for "Jo is in Dinner" on the other devices. */
  setWhere(where: string | null) {
    this.where = where;
  }

  // ── live updates ─────────────────────────────────────────────────────

  /** Sends anything waiting, then fetches the stored copy if it changed. Called on each poll or push. */
  async refresh(): Promise<void> {
    if (this.dirty) await this.flush();
    const epoch = this.epoch;
    try {
      const got = await this.o.remote.get(this.o.siteCode, this.o.businessDate, this.base?.version ?? null);
      this.offline = false;
      if (got !== 'not-modified' && got && epoch === this.epoch && got.version !== this.base?.version) this.absorb(got);
    } catch {
      this.offline = true;
    }
    if (this.o.presence) {
      try {
        this.others = await this.o.presence.beat(`${this.o.siteCode}|${this.o.businessDate}|eod`, {
          deviceId: this.o.deviceId, who: this.o.user, where: this.where, at: this.now().toISOString(),
        });
      } catch { /* presence is a nice-to-have */ }
    }
    this.changed();
    if (this.dirty && !this.offline) await this.flush();
  }

  // ── submit ───────────────────────────────────────────────────────────

  async submit(): Promise<SubmitResult> {
    await this.flush();
    if (this.clashes.length) return { ok: false, code: 'conflict', error: 'Choose whose changes to keep first.' };
    if (this.dirty) return { ok: false, code: 'failed', error: 'No connection. It is saved on this device; try again when you have signal.' };
    // One id per press of Submit, kept until the server answers, so a retry after lost signal is a no-op.
    this.submitId ??= this.o.newId?.() ?? `${this.o.deviceId}-${this.now().getTime()}`;
    let res: SubmitResult;
    try {
      res = await this.o.remote.submit(this.draft, { baseVersion: this.base?.version ?? null, submitId: this.submitId, by: this.o.user });
    } catch {
      this.offline = true;
      this.changed();
      return { ok: false, code: 'failed', error: 'No connection. It is saved on this device; try again when you have signal.' };
    }
    this.submitId = null;
    this.offline = false;
    if (res.ok) {
      this.epoch++;
      this.base = res.report;
      this.draft = res.report.draft;
      this.dirty = false;
    } else if (res.current && res.code === 'already-submitted') {
      this.absorb(res.current);
      this.notice = res.error;
      this.alreadySent = true;
    } else if (res.current && res.code === 'conflict') {
      this.absorb(res.current);
    }
    this.changed();
    return res;
  }
}

/** Wraps a store (MemoryStore, DeviceStore) as a remote: demo mode and tests. */
export function storeRemote(
  store: import('./store').EodStore,
  submit: (draft: EodDraft, opts: { baseVersion: string | null; submitId: string; by: string }) => Promise<SubmitResult>,
  now?: () => Date,
): EodRemote {
  return {
    async get(siteCode, businessDate, ifNoneMatch) {
      const r = await store.get(siteCode, businessDate);
      return r && ifNoneMatch && r.version === ifNoneMatch ? 'not-modified' : r;
    },
    saveDraft: (draft, opts) => store.saveDraft(draft, { baseVersion: opts.baseVersion, by: opts.by, now: now?.() }),
    submit,
  };
}
