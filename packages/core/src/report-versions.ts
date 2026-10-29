/**
 * Versions of the EOD report definition: draft → waiting for approval → live.
 * Same rules as the checklist builder (builder.ts): a published version is never edited,
 * a change starts on the next trading day, and every saved report names the version it used.
 * Two people: whoever drafts a change can't approve it.
 */
import { nextDay } from './builder';
import { countedTotal } from './calc';
import type { EodDraft } from './schema';
import type { SiteSettings } from './settings';
import {
  EOD_DEFINITION, VERIFIED_TEST_DAY, evaluateDefinition, runTestDay, testDayInputs,
  type DefinitionEvaluation, type ReportDefinition, type TestDay, type TestResult,
} from './report-definition';

export interface DefinitionVersion {
  /** 1, 2, 3… Shown as v1, v2. */
  version: number;
  /** First trading day (YYYY-MM-DD) this version is used. */
  startsOn: string;
  definition: ReportDefinition;
  testDays: TestDay[];
  /** What changed, in the drafter's words. */
  summary: string;
  draftedBy: string;
  approvedBy: string;
  approvedAt: string;
}

export interface DefinitionDraft {
  definition: ReportDefinition;
  testDays: TestDay[];
  by: string;
  updatedAt: string;
}

export interface PendingApproval extends DefinitionDraft {
  summary: string;
  submittedAt: string;
}

export interface DefinitionRecord {
  /** e.g. "eod". One record per report type. */
  key: string;
  /** Oldest first. */
  versions: DefinitionVersion[];
  draft: DefinitionDraft | null;
  pending: PendingApproval | null;
  /** Why the last approval was turned down, shown to the drafter. */
  rejected?: { by: string; reason: string; at: string } | null;
}

/** A rule was broken (not a bug). The message is written for the person using the builder. */
export class ReviewError extends Error {}

export interface DraftCheck {
  ok: boolean;
  /** Figure name → problem. */
  errors: Record<string, string>;
  /** One list per test day. */
  results: { name: string; results: TestResult[] }[];
  failing: number;
}

/** Works out every test day. A draft can only be sent for approval when this is ok. */
export function checkDraft(definition: ReportDefinition, testDays: TestDay[]): DraftCheck {
  const errors: Record<string, string> = {};
  const results = testDays.map((day) => {
    Object.assign(errors, evaluateDefinition(definition, testDayInputs(definition, day)).errors);
    return { name: day.name, results: runTestDay(definition, day) };
  });
  const failing = results.reduce((n, d) => n + d.results.filter((r) => !r.pass).length, 0);
  return { ok: failing === 0 && Object.keys(errors).length === 0 && testDays.length > 0, errors, results, failing };
}

/** Today's rules (HANDOFF.md §5) as version 1, live from the start. */
export function seedDefinitionRecord(o: { startsOn: string; by: string; at: string }): DefinitionRecord {
  return {
    key: 'eod',
    versions: [{ version: 1, startsOn: o.startsOn, definition: EOD_DEFINITION, testDays: [VERIFIED_TEST_DAY], summary: 'Today’s rules (HANDOFF.md §5)', draftedBy: o.by, approvedBy: o.by, approvedAt: o.at }],
    draft: null,
    pending: null,
  };
}

export const latestDefinition = (rec: DefinitionRecord) => rec.versions[rec.versions.length - 1] ?? null;

/** The version used for a trading day. A report started on a day keeps that day's version. */
export function definitionOn(rec: DefinitionRecord, date: string): DefinitionVersion | null {
  for (let i = rec.versions.length - 1; i >= 0; i--) if (rec.versions[i]!.startsOn <= date) return rec.versions[i]!;
  return null;
}

/** What the builder opens: the pending change, the draft, or the newest version. */
export function editableDefinition(rec: DefinitionRecord): { definition: ReportDefinition; testDays: TestDay[] } {
  const src = rec.pending ?? rec.draft ?? latestDefinition(rec);
  if (!src) throw new ReviewError('There is no report to edit yet');
  return { definition: src.definition, testDays: src.testDays };
}

export type DefinitionStatus = 'live' | 'draft' | 'waiting' | 'starts-tomorrow';
export function definitionStatus(rec: DefinitionRecord, today: string): DefinitionStatus {
  if (rec.pending) return 'waiting';
  if (rec.draft) return 'draft';
  return (latestDefinition(rec)?.startsOn ?? '') > today ? 'starts-tomorrow' : 'live';
}

export function saveDefinitionDraft(rec: DefinitionRecord, o: { definition: ReportDefinition; testDays: TestDay[]; by: string; at: string }): DefinitionRecord {
  if (rec.pending) throw new ReviewError(`This change is waiting for approval. ${rec.pending.by} can withdraw it to keep editing.`);
  return { ...rec, draft: { definition: o.definition, testDays: o.testDays, by: o.by, updatedAt: o.at }, rejected: null };
}

export function discardDefinitionDraft(rec: DefinitionRecord): DefinitionRecord {
  return { ...rec, draft: null };
}

export function submitDefinition(rec: DefinitionRecord, o: { summary: string; by: string; at: string }): DefinitionRecord {
  if (rec.pending) throw new ReviewError('A change is already waiting for approval');
  if (!rec.draft) throw new ReviewError('There are no changes to send');
  if (!o.summary.trim()) throw new ReviewError('Say what changed, so the approver knows what to check');
  const check = checkDraft(rec.draft.definition, rec.draft.testDays);
  if (!rec.draft.testDays.length) throw new ReviewError('Add at least one test day, so the change can be checked');
  if (Object.keys(check.errors).length) throw new ReviewError(`Fix the formulas with problems first: ${Object.keys(check.errors).join(', ')}`);
  if (!check.ok) throw new ReviewError(`${check.failing} test${check.failing === 1 ? '' : 's'} failing. Fix them, or update the expected figure if the change is right.`);
  return { ...rec, draft: null, pending: { ...rec.draft, by: o.by, summary: o.summary.trim(), submittedAt: o.at }, rejected: null };
}

export function withdrawDefinition(rec: DefinitionRecord, o: { by: string }): DefinitionRecord {
  if (!rec.pending) throw new ReviewError('Nothing is waiting for approval');
  if (rec.pending.by !== o.by) throw new ReviewError(`Only ${rec.pending.by} can withdraw this change`);
  const { summary: _s, submittedAt: _t, ...draft } = rec.pending;
  return { ...rec, pending: null, draft };
}

/** Approves the waiting change. It goes live on the next trading day. */
export function approveDefinition(rec: DefinitionRecord, o: { by: string; today: string; at: string }): DefinitionRecord {
  const p = rec.pending;
  if (!p) throw new ReviewError('Nothing is waiting for approval');
  if (p.by === o.by) throw new ReviewError('Someone else needs to approve this. You made the change.');
  const check = checkDraft(p.definition, p.testDays);
  if (!check.ok) throw new ReviewError('The tests no longer pass, so this can’t be approved');
  const n = (latestDefinition(rec)?.version ?? 0) + 1;
  const version: DefinitionVersion = {
    version: n, startsOn: nextDay(o.today), definition: { ...p.definition, version: String(n) }, testDays: p.testDays,
    summary: p.summary, draftedBy: p.by, approvedBy: o.by, approvedAt: o.at,
  };
  return { ...rec, versions: [...rec.versions, version], pending: null, rejected: null };
}

export function rejectDefinition(rec: DefinitionRecord, o: { by: string; reason: string; at: string }): DefinitionRecord {
  const p = rec.pending;
  if (!p) throw new ReviewError('Nothing is waiting for approval');
  if (p.by === o.by) throw new ReviewError('Withdraw your own change instead of turning it down');
  if (!o.reason.trim()) throw new ReviewError('Say why, so it can be fixed');
  const { summary: _s, submittedAt: _t, ...draft } = p;
  return { ...rec, pending: null, draft, rejected: { by: o.by, reason: o.reason.trim(), at: o.at } };
}

/** Goes back to an earlier version, as a new version from the next trading day. History is kept. */
export function rollbackDefinition(rec: DefinitionRecord, o: { to: number; by: string; reason: string; today: string; at: string }): DefinitionRecord {
  const old = rec.versions.find((v) => v.version === o.to);
  if (!old) throw new ReviewError(`There is no v${o.to}`);
  if (old === latestDefinition(rec)) throw new ReviewError(`v${o.to} is already the newest version`);
  if (!o.reason.trim()) throw new ReviewError('Say why you are rolling back');
  const n = latestDefinition(rec)!.version + 1;
  return {
    ...rec,
    versions: [...rec.versions, { ...old, version: n, startsOn: nextDay(o.today), definition: { ...old.definition, version: String(n) }, summary: `Back to v${o.to}: ${o.reason.trim()}`, draftedBy: o.by, approvedBy: o.by, approvedAt: o.at }],
  };
}

/* ------------------------------------------------------- reports → engine */

/** Figures finance added that aren't in the EOD form yet: figure id → value (pence, fraction or number). */
export type ExtraInputs = Record<string, number | null | undefined>;

/**
 * Turns a manager's EOD into the engine's inputs, by figure name. The built-in figures are found
 * by id, so finance can rename them freely; anything finance added comes from `extra`.
 */
export function inputsFromDraft(def: ReportDefinition, d: EodDraft, settings: SiteSettings, extra: ExtraInputs = {}, target: number | null = null): Record<string, number | null> {
  const lunch = d.ran.lunch ? d.sessions.lunch : null;
  const dinner = d.ran.dinner ? d.sessions.dinner : null;
  const platform = (id: string) => settings.platforms.find((p) => p.id === id);
  const deliveryGross = (id: string) => {
    const e = d.delivery.find((x) => x.platformId === id);
    return d.ran.delivery && e?.traded ? e.gross : 0;
  };
  const ses = (k: 'lunch' | 'dinner', x: typeof lunch) => ({
    [`${k}.gross`]: x ? x.gross : 0, [`${k}.sc`]: x ? x.serviceCharge : 0, [`${k}.vat`]: x ? x.vat : 0, [`${k}.disc`]: x ? x.discounts : 0,
    [`${k}.food`]: x ? x.food : 0, [`${k}.drink`]: x ? x.drink : 0, [`${k}.booked`]: x ? x.booked : 0, [`${k}.walkins`]: x ? x.walkins : 0,
    // The form counts notes and coins; the definition works with the total.
    [`${k}.counted`]: x ? countedTotal(x.cash.counted) : 0, [`${k}.till`]: x ? x.cash.tillCash : 0,
  });
  const builtIn: Record<string, number | null | undefined> = {
    ...ses('lunch', lunch), ...ses('dinner', dinner),
    'delivery.deliveroo': deliveryGross('deliveroo'), 'delivery.ubereats': deliveryGross('ubereats'),
    'wages.cost': d.wages.wageCost,
    'tips.card': d.tips.card, 'tips.cash': d.tips.cash,
    'set.vat': settings.vatRatePct / 100,
    'set.deliveroo': (platform('deliveroo')?.estimatedNetPct ?? 0) / 100,
    'set.ubereats': (platform('ubereats')?.estimatedNetPct ?? 0) / 100,
    'set.float': settings.float, 'set.tolerance': settings.cashTolerance,
    'set.wageamber': settings.wageAmberPct / 100, 'set.wagered': settings.wageRedPct / 100,
    'set.discountwarn': settings.discountWarnPct / 100,
    'set.target': target ?? null,
  };
  const out: Record<string, number | null> = {};
  for (const f of def.figures) {
    if (f.kind !== 'input' && f.kind !== 'setting') continue;
    const v = f.id in builtIn ? builtIn[f.id] : extra[f.id];
    out[f.name] = typeof v === 'number' ? v : null;
  }
  return out;
}

export interface OfficialFigures extends DefinitionEvaluation {
  version: number;
  /** Results by figure id, so saved reports survive renames. */
  byId: Record<string, number>;
}

/** The official figures for a submitted EOD, using the version for its trading day. */
export function officialFigures(rec: DefinitionRecord, d: EodDraft, settings: SiteSettings, extra: ExtraInputs = {}, target: number | null = null): OfficialFigures {
  const v = definitionOn(rec, d.businessDate);
  if (!v) throw new ReviewError(`There is no report version for ${d.businessDate}`);
  const ev = evaluateDefinition(v.definition, inputsFromDraft(v.definition, d, settings, extra, target));
  const byId: Record<string, number> = {};
  for (const f of v.definition.figures) if (ev.values[f.name] !== undefined) byId[f.id] = ev.values[f.name]!;
  return { ...ev, version: v.version, byId };
}
