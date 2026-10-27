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
}

export interface FinishOutcome {
  /** Someone else finished it first; this Finish did nothing. */
  already: boolean;
  /** "Finished by Jo at 21:02" */
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
    return { runs: buildRuns(Object.values(v.runs), Object.values(v.answers)), queued: this.queue.length, offline: this.offline, others: this.others };
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
    const op: ChecklistOp = { kind: 'finish', run, by: this.o.user, at: this.now().toISOString() };
    this.queue.push(op);
    this.changed();
    await this.flush();
    const r = this.confirmed.runs[run.key];
    if (!r?.completedAt) return { already: false, queued: true, message: 'Saved on this device. It will send when you have signal.' };
    const already = r.completedBy !== this.o.user || r.completedAt !== op.at;
    return { already, queued: false, message: finishedByMessage(r) };
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
      for (const r of out) {
        const runs = r.ok && r.recheck ? [r.run, r.recheck] : [r.run];
        this.take(runs, r.ok && r.answer ? [r.answer] : []);
      }
      this.changed();
    }
  }

  /** What this person has open, for presence on other devices. */
  setWhere(where: string | null) {
    this.where = where;
  }

  /** Sends waiting changes, then fetches what changed since last time. Called on each poll or push. */
  async refresh(): Promise<void> {
    if (this.queue.length) await this.flush();
    try {
      const c = await this.o.backend.changes(this.o.siteCode, this.o.businessDate, this.cursor);
      this.offline = false;
      this.take(c.runs, c.answers);
      this.cursor = Math.max(this.cursor, c.cursor);
    } catch {
      this.offline = true;
    }
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
