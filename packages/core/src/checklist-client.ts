/**
 * One device's view of today's shared checklists. What is on screen = what the server
 * has confirmed + this device's changes still waiting to send. Changes are sent in
 * batches and kept on the device without signal, then replayed in order.
 */
import type { AnswerValue, ChecklistRun, CorrectiveAction } from './checklists';
import {
  answerKey, buildRuns, finishedByMessage,
  type AnswerRecord, type ChecklistBackend, type ChecklistChanges, type ChecklistOp, type OpOutcome, type RunRecord, type RunStart,
} from './checklist-sync';
import type { KeyValue, Presence, PresenceRemote } from './live';

export interface ChecklistClientOptions {
  backend: ChecklistBackend;
  siteCode: string;
  businessDate: string;
  user: string;
  deviceId: string;
  storage?: KeyValue;
  /** What is stored, if it can be read straight away (demo mode), so the first screen isn't blank. */
  initial?: ChecklistChanges;
  presence?: PresenceRemote;
  now?: () => Date;
  /** Wait this long to batch answers into one call. 0 = send straight away (demo and tests). */
  batchDelayMs?: number;
}

export interface ChecklistSyncState {
  runs: Record<string, ChecklistRun>;
  /** Changes waiting to send. */
  queued: number;
  offline: boolean;
  others: Presence[];
  /** This device's changes the server turned down because someone else got there first. Newest last. */
  refused: Refusal[];
}

export interface Refusal {
  runKey: string;
  /** The item, when an answer or fix was refused. */
  checkpointId: string | null;
  /** "Your answer arrived after Jo submitted this list at 22:04." */
  message: string;
}

export interface FinishOutcome {
  /** Someone else finished it first; this Finish did nothing. */
  already: boolean;
  /** Someone else answered since this person last looked; nothing was locked. Check, then finish again. */
  stale: boolean;
  /** "Submitted by Jo at 21:02" */
  message: string;
  /** No signal: it is queued on this device. */
  queued: boolean;
}

interface Saved {
  runs: Record<string, RunRecord>;
  answers: Record<string, AnswerRecord>;
  cursor: number;
  queue: ChecklistOp[];
}

export class ChecklistSyncClient {
  private confirmed: { runs: Record<string, RunRecord>; answers: Record<string, AnswerRecord> };
  private cursor: number;
  private queue: ChecklistOp[];
  private offline = false;
  private others: Presence[] = [];
  private refused: Refusal[] = [];
  /** What the server said about each op, so finish() can read its own answer. */
  private outcomes = new WeakMap<ChecklistOp, OpOutcome>();
  private where: string | null = null;
  private flushing: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private snapshot: ChecklistSyncState;
  private readonly key: string;

  constructor(private o: ChecklistClientOptions) {
    this.key = `mgh.sync.checklists.v1.${o.siteCode}|${o.businessDate}`;
    const saved = o.storage?.get<Saved | null>(this.key, null) ?? null;
    this.confirmed = { runs: saved?.runs ?? {}, answers: saved?.answers ?? {} };
    this.cursor = saved?.cursor ?? 0;
    this.queue = saved?.queue ?? [];
    if (o.initial) {
      this.take(o.initial.runs, o.initial.answers);
      this.cursor = Math.max(this.cursor, o.initial.cursor);
    }
    this.snapshot = this.makeSnapshot();
  }

  getState = (): ChecklistSyncState => this.snapshot;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  private now() { return this.o.now?.() ?? new Date(); }

  /** Confirmed records with this device's waiting changes on top. */
  private view() {
    const runs = structuredClone(this.confirmed.runs);
    const answers = structuredClone(this.confirmed.answers);
    for (const op of this.queue) {
      const run = (runs[op.run.key] ??= { ...structuredClone(op.run), completedAt: null, completedBy: null, seq: 0 });
      if (op.kind === 'finish') {
        if (!run.completedAt) { run.completedAt = op.at; run.completedBy = op.by; }
        continue;
      }
      const k = answerKey(run.key, op.checkpointId);
      const a = answers[k];
      if (op.kind === 'correct') {
        // Shown straight away; the server stamps the real time when it arrives.
        if (run.completedAt && a) {
          a.corrections = [...(a.corrections ?? []), { previous: a.value, value: op.value, reason: op.reason, by: op.by, at: op.at }];
          a.value = op.value;
        }
        continue;
      }
      if (run.completedAt) continue;
      if (op.kind === 'answer') {
        if (a && a.answeredAt > op.at) continue;
        const same = a && JSON.stringify(a.value) === JSON.stringify(op.value);
        answers[k] = { runKey: run.key, checkpointId: op.checkpointId, value: op.value, answeredBy: op.by, answeredAt: op.at, fix: same ? a.fix : null, seq: a?.seq ?? 0 };
      } else if (a) {
        a.fix = op.fix;
        runs[op.recheck.key] ??= { ...structuredClone(op.recheck), completedAt: null, completedBy: null, seq: 0 };
      }
    }
    return { runs, answers };
  }

  private makeSnapshot(): ChecklistSyncState {
    const v = this.view();
    return { runs: buildRuns(Object.values(v.runs), Object.values(v.answers)), queued: this.queue.length, offline: this.offline, others: this.others, refused: this.refused };
  }

  private changed() {
    this.o.storage?.set(this.key, { ...this.confirmed, cursor: this.cursor, queue: this.queue } satisfies Saved);
    this.snapshot = this.makeSnapshot();
    for (const fn of this.listeners) fn();
  }

  private take(runs: RunRecord[], answers: AnswerRecord[]) {
    for (const r of runs) {
      const have = this.confirmed.runs[r.key];
      if (!have || r.seq >= have.seq) this.confirmed.runs[r.key] = r;
    }
    for (const a of answers) {
      const k = answerKey(a.runKey, a.checkpointId);
      const have = this.confirmed.answers[k];
      if (!have || a.seq >= have.seq) this.confirmed.answers[k] = a;
    }
  }

  private enqueue(op: ChecklistOp): Promise<void> {
    this.queue.push(op);
    this.changed();
    const delay = this.o.batchDelayMs ?? 0;
    if (delay <= 0) return this.flush();
    this.timer ??= setTimeout(() => { this.timer = null; void this.flush(); }, delay);
    return Promise.resolve();
  }

  // ── changes ──────────────────────────────────────────────────────────

  answer(run: RunStart, checkpointId: string, value: AnswerValue) {
    return this.enqueue({ kind: 'answer', run, checkpointId, value, by: this.o.user, at: this.now().toISOString() });
  }

  fix(run: RunStart, checkpointId: string, action: Omit<CorrectiveAction, 'at'>, recheck: (at: Date) => RunStart) {
    const at = this.now();
    return this.enqueue({ kind: 'fix', run, checkpointId, fix: { ...action, at: at.toISOString() }, by: this.o.user, recheck: recheck(at) });
  }

  /** Changes an answer on a finished run. The old answer and the reason are kept. */
  correct(run: RunStart, checkpointId: string, value: AnswerValue, reason: string) {
    return this.enqueue({ kind: 'correct', run, checkpointId, value, reason, by: this.o.user, at: this.now().toISOString() });
  }

  /** Finishing is conditional: if someone else already finished, this is a no-op that says who. */
  async finish(run: RunStart): Promise<FinishOutcome> {
    // Catch up first, so the person sees anything answered elsewhere in the last few seconds.
    if (this.queue.length) await this.flush();
    const before = this.othersAnswers(run.key);
    // A device that has never fetched has nothing on screen to compare with: its first look counts as seen.
    const looked = this.cursor > 0;
    if (!this.queue.length) await this.fetchChanges();
    const arrived = looked ? [...this.othersAnswers(run.key)].filter(([k, seq]) => before.get(k) !== seq).length : 0;
    if (arrived > 0) {
      this.changed();
      return { already: false, stale: true, queued: false, message: staleMessage(arrived) };
    }
    const op: ChecklistOp = { kind: 'finish', run, by: this.o.user, at: this.now().toISOString(), seen: this.cursor };
    this.queue.push(op);
    this.changed();
    await this.flush();
    const out = this.outcomes.get(op);
    if (out && !out.ok && out.reason === 'stale') {
      return { already: false, stale: true, queued: false, message: staleMessage(out.answers?.length ?? 1) };
    }
    const r = this.confirmed.runs[run.key];
    if (!r?.completedAt) return { already: false, stale: false, queued: true, message: 'Saved on this device. It will send when you have signal.' };
    const already = r.completedBy !== this.o.user || r.completedAt !== op.at;
    return { already, stale: false, queued: false, message: finishedByMessage(r) };
  }

  /** Items on this list someone else answered, with the change cursor of each, as far as this device knows. */
  private othersAnswers(runKey: string) {
    return new Map(Object.entries(this.confirmed.answers).filter(([, a]) => a.runKey === runKey && a.answeredBy !== this.o.user).map(([k, a]) => [k, a.seq]));
  }

  dismissRefused(runKey?: string) {
    this.refused = runKey ? this.refused.filter((r) => r.runKey !== runKey) : [];
    this.changed();
  }

  /** Sends waiting changes in one batch, in order. Without signal they stay queued. */
  flush(): Promise<void> {
    if (!this.flushing) {
      this.flushing = this.runFlush().finally(() => { this.flushing = null; this.changed(); });
    }
    return this.flushing;
  }

  private async runFlush() {
    while (this.queue.length) {
      const batch = this.queue.slice();
      let out: OpOutcome[];
      try {
        out = await this.o.backend.apply(this.o.siteCode, batch);
      } catch {
        this.offline = true;
        return;
      }
      this.offline = false;
      this.queue = this.queue.slice(batch.length);
      out.forEach((r, i) => {
        const op = batch[i]!;
        this.outcomes.set(op, r);
        const runs = r.ok && r.recheck ? [r.run, r.recheck] : [r.run];
        this.take(runs, r.ok && r.answer ? [r.answer] : r.ok ? [] : r.answers ?? []);
        if (!r.ok) this.noteRefusal(op, r);
      });
      this.changed();
    }
  }

  /** Says why a change didn't stick, instead of it quietly disappearing from the screen. */
  private noteRefusal(op: ChecklistOp, r: Extract<OpOutcome, { ok: false }>) {
    const checkpointId = 'checkpointId' in op ? op.checkpointId : null;
    let message: string | null = null;
    if (r.reason === 'finished' && (op.kind === 'answer' || op.kind === 'fix')) {
      message = `Not saved: ${finishedByMessage(r.run).replace(/^Submitted/, 'submitted')} before your ${op.kind === 'fix' ? 'fix' : 'answer'} arrived. A supervisor can correct it.`;
    } else if (r.reason === 'stale' && op.kind === 'finish') {
      message = `Not submitted: ${staleMessage(r.answers?.length ?? 1)}`;
    }
    if (!message) return;
    this.refused = [...this.refused.filter((x) => !(x.runKey === r.run.key && x.checkpointId === checkpointId)), { runKey: r.run.key, checkpointId, message }];
  }

  /** What this person has open, for presence on other devices. */
  setWhere(where: string | null) {
    this.where = where;
  }

  private async fetchChanges() {
    try {
      const c = await this.o.backend.changes(this.o.siteCode, this.o.businessDate, this.cursor);
      this.offline = false;
      this.take(c.runs, c.answers);
      this.cursor = Math.max(this.cursor, c.cursor);
    } catch {
      this.offline = true;
    }
  }

  /** Sends waiting changes, then fetches what changed since last time. Called on each poll or push. */
  async refresh(): Promise<void> {
    if (this.queue.length) await this.flush();
    await this.fetchChanges();
    if (this.o.presence) {
      try {
        this.others = await this.o.presence.beat(`${this.o.siteCode}|${this.o.businessDate}|checklists`, {
          deviceId: this.o.deviceId, who: this.o.user, where: this.where, at: this.now().toISOString(),
        });
      } catch { /* presence is a nice-to-have */ }
    }
    this.changed();
  }
}

const staleMessage = (n: number) =>
  `${n === 1 ? 'An item was' : 'Items were'} just answered on another device. Check ${n === 1 ? 'it' : 'them'}, then submit again.`;
