/**
 * Checklists shared by several people at once. Each answer is its own record
 * (run + checkpoint), so two people ticking different items never clash. The same item
 * is last-write-wins by the time it was answered, and the screen shows who answered it.
 * Finishing a run is a conditional update: the second Finish is a no-op that says who finished.
 *
 * Devices send their changes in batches (scalability rule 1: no server call per answer)
 * and fetch what changed since a cursor, so polling stays cheap.
 * SharePoint: runs → ChecklistRuns, answers → Responses (Title = runKey|checkpointId).
 */
import type { AnswerValue, ChecklistRun, CorrectiveAction } from './checklists';
import { clockTime } from './sync';

/** What a device needs to create a run if nobody has started it yet. */
export interface RunStart {
  key: string;
  templateId: string;
  businessDate: string;
  dueTime: string | null;
  recheckOf?: ChecklistRun['recheckOf'];
}

export interface RunRecord extends RunStart {
  completedAt: string | null;
  completedBy: string | null;
  /** Change cursor (SharePoint: the Modified time). */
  seq: number;
}

export interface AnswerRecord {
  runKey: string;
  checkpointId: string;
  value: AnswerValue;
  answeredBy: string;
  answeredAt: string;
  fix: CorrectiveAction | null;
  seq: number;
}

export type ChecklistOp =
  | { kind: 'answer'; run: RunStart; checkpointId: string; value: AnswerValue; by: string; at: string }
  | { kind: 'fix'; run: RunStart; checkpointId: string; fix: CorrectiveAction; by: string; recheck: RunStart }
  | { kind: 'finish'; run: RunStart; by: string; at: string };

export type OpOutcome =
  | {
    ok: true; run: RunRecord; answer?: AnswerRecord;
    /** Fix only: the re-check run it set up. */ recheck?: RunRecord;
    /** Finish only: someone had already finished it. */ already?: boolean;
  }
  | { ok: false; reason: 'finished' | 'no-answer'; run: RunRecord };

export interface ChecklistChanges {
  runs: RunRecord[];
  answers: AnswerRecord[];
  cursor: number;
}

export interface ChecklistBackend {
  /** Applies a batch in order. One outcome per op. */
  apply(siteCode: string, ops: ChecklistOp[]): Promise<OpOutcome[]>;
  /** Everything for the day changed after `since` (0 = all). */
  changes(siteCode: string, businessDate: string, since: number): Promise<ChecklistChanges>;
}

export const answerKey = (runKey: string, checkpointId: string) => `${runKey}|${checkpointId}`;

/** "Finished by Jo at 21:02" */
export const finishedByMessage = (r: Pick<RunRecord, 'completedBy' | 'completedAt'>) =>
  `Finished by ${r.completedBy ?? 'someone else'}${r.completedAt ? ` at ${clockTime(r.completedAt)}` : ''}`;

export interface ChecklistData {
  seq: number;
  runs: Record<string, RunRecord & { siteCode: string }>;
  answers: Record<string, AnswerRecord & { siteCode: string }>;
}

/** The server's rules, in memory. Each apply runs without awaiting, so it is atomic. */
export class MemoryChecklistStore implements ChecklistBackend {
  protected data: ChecklistData = { seq: 0, runs: {}, answers: {} };

  protected load() { /* the device store re-reads shared storage here */ }
  protected persist() { /* and writes it back here */ }

  private ensure(siteCode: string, start: RunStart) {
    const k = `${siteCode}|${start.key}`;
    return (this.data.runs[k] ??= { ...structuredClone(start), siteCode, completedAt: null, completedBy: null, seq: ++this.data.seq });
  }

  private applyOne(siteCode: string, op: ChecklistOp): OpOutcome {
    const run = this.ensure(siteCode, op.run);
    const strip = <T extends { siteCode: string }>(x: T) => { const { siteCode: _s, ...rest } = x; return structuredClone(rest); };
    if (op.kind === 'finish') {
      if (run.completedAt) return { ok: true, run: strip(run), already: true };
      run.completedAt = op.at;
      run.completedBy = op.by;
      run.seq = ++this.data.seq;
      return { ok: true, run: strip(run) };
    }
    if (run.completedAt) return { ok: false, reason: 'finished', run: strip(run) };
    const k = `${siteCode}|${answerKey(run.key, op.checkpointId)}`;
    const existing = this.data.answers[k];
    if (op.kind === 'answer') {
      // Last write wins by when it was answered, so a late upload from a phone that was offline can't overwrite a newer answer.
      if (existing && existing.answeredAt > op.at) return { ok: true, run: strip(run), answer: strip(existing) };
      const sameValue = existing && JSON.stringify(existing.value) === JSON.stringify(op.value);
      this.data.answers[k] = {
        siteCode, runKey: run.key, checkpointId: op.checkpointId, value: structuredClone(op.value), answeredBy: op.by, answeredAt: op.at,
        // A changed answer may no longer fail, so its old fix no longer applies.
        fix: sameValue ? existing.fix : null,
        seq: ++this.data.seq,
      };
      return { ok: true, run: strip(run), answer: strip(this.data.answers[k]!) };
    }
    if (!existing) return { ok: false, reason: 'no-answer', run: strip(run) };
    existing.fix = structuredClone(op.fix);
    existing.seq = ++this.data.seq;
    const recheck = this.ensure(siteCode, op.recheck);
    return { ok: true, run: strip(run), answer: strip(existing), recheck: strip(recheck) };
  }

  async apply(siteCode: string, ops: ChecklistOp[]) {
    this.load();
    const out = ops.map((op) => this.applyOne(siteCode, op));
    this.persist();
    return out;
  }

  async changes(siteCode: string, businessDate: string, since: number): Promise<ChecklistChanges> {
    return this.changesNow(siteCode, businessDate, since);
  }

  /** The same, synchronously: demo mode reads it on the first render. */
  changesNow(siteCode: string, businessDate: string, since: number): ChecklistChanges {
    this.load();
    const mine = <T extends { siteCode: string; seq: number }>(x: T) => x.siteCode === siteCode && x.seq > since;
    const runs = Object.values(this.data.runs).filter((r) => mine(r) && r.businessDate === businessDate);
    const dayRuns = new Set(Object.values(this.data.runs).filter((r) => r.siteCode === siteCode && r.businessDate === businessDate).map((r) => r.key));
    const answers = Object.values(this.data.answers).filter((a) => mine(a) && dayRuns.has(a.runKey));
    const strip = <T extends { siteCode: string }>({ siteCode: _s, ...rest }: T) => structuredClone(rest);
    return { runs: runs.map(strip), answers: answers.map(strip), cursor: this.data.seq };
  }
}

/** Builds the screens' runs from the records, with who answered each item. */
export function buildRuns(runs: RunRecord[], answers: AnswerRecord[]): Record<string, ChecklistRun> {
  const out: Record<string, ChecklistRun> = {};
  for (const r of runs) {
    out[r.key] = {
      key: r.key, templateId: r.templateId, businessDate: r.businessDate, dueTime: r.dueTime,
      answers: {}, fixes: {}, answeredBy: {}, completedAt: r.completedAt, completedBy: r.completedBy,
      ...(r.recheckOf ? { recheckOf: r.recheckOf } : {}),
    };
  }
  for (const a of answers) {
    const run = out[a.runKey];
    if (!run) continue;
    run.answers[a.checkpointId] = a.value;
    run.answeredBy![a.checkpointId] = { by: a.answeredBy, at: a.answeredAt };
    if (a.fix) run.fixes[a.checkpointId] = a.fix;
  }
  return out;
}
