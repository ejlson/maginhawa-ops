/**
 * Several people at one site can work on the same end-of-day report from different
 * devices (the kitchen iPad and their phones). These rules keep that safe:
 *
 * - Every stored report has a `version` (the SharePoint item ETag). A save says which
 *   version it started from, and the store refuses a stale save (SyncError 'conflict').
 * - The eight sections are independent, so a stale save is merged section by section.
 *   Only a section both people changed is a real clash, and the person picks.
 * - The store stamps each changed section with who changed it and when.
 * - Submit is a conditional write: exactly one wins; the rest see who sent it.
 */
import { newDraft, SECTION_KEYS, type EodDraft, type SectionKey } from './schema';
import { SECTION_LABELS } from './checks';
import type { StoredReport } from './store';

export interface SectionStamp {
  by: string;
  /** ISO time. */
  at: string;
}
export type SectionStamps = Partial<Record<SectionKey, SectionStamp>>;

export type SyncErrorCode = 'conflict' | 'locked' | 'already-submitted';

/** Thrown by a store when a conditional write can't go ahead. `current` is what is stored now. */
export class SyncError extends Error {
  constructor(readonly code: SyncErrorCode, message: string, readonly current: StoredReport) {
    super(message);
    this.name = 'SyncError';
  }
}
export const isSyncError = (e: unknown): e is SyncError => e instanceof SyncError;

export const LOCKED_MESSAGE = 'This day is already submitted. Ask finance to reopen it.';
export const STALE_MESSAGE = 'Someone else changed this report. Their changes are loading.';

/** One section's share of the draft: its figures, whether it ran, and whether it was saved as done. */
export function sectionSlice(d: EodDraft, key: SectionKey): unknown {
  const done = Boolean(d.completed[key]);
  switch (key) {
    case 'lunch':
    case 'dinner': return { ran: d.ran[key], data: d.sessions[key], done };
    case 'delivery': return { ran: d.ran.delivery, data: d.delivery, done };
    default: return { data: d[key], done };
  }
}

/** Copies one section from `from` into `to` (in place). */
export function copySection(to: EodDraft, from: EodDraft, key: SectionKey): void {
  switch (key) {
    case 'lunch':
    case 'dinner': to.ran[key] = from.ran[key]; to.sessions[key] = structuredClone(from.sessions[key]); break;
    case 'delivery': to.ran.delivery = from.ran.delivery; to.delivery = structuredClone(from.delivery); break;
    case 'promotions': to.promotions = structuredClone(from.promotions); break;
    case 'wages': to.wages = structuredClone(from.wages); break;
    case 'tips': to.tips = structuredClone(from.tips); break;
    case 'feedback': to.feedback = structuredClone(from.feedback); break;
    case 'handover': to.handover = structuredClone(from.handover); break;
  }
  if (from.completed[key]) to.completed[key] = true;
  else delete to.completed[key];
}

/** Key order doesn't matter; undefined object keys are ignored. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}
export const sameValue = (a: unknown, b: unknown) => stable(a) === stable(b);

export const sameSection = (a: EodDraft, b: EodDraft, key: SectionKey) => sameValue(sectionSlice(a, key), sectionSlice(b, key));

/** Sections that differ between two drafts. A missing `a` counts as a blank report. */
export function changedSections(a: EodDraft | null, b: EodDraft): SectionKey[] {
  const from = a ?? blankLike(b);
  return SECTION_KEYS.filter((k) => !sameSection(from, b, k));
}

/** A blank report with the same identity, for comparing against when there was no stored copy. */
export function blankLike(d: EodDraft): EodDraft {
  return newDraft({ clientId: d.clientId, siteCode: d.siteCode, businessDate: d.businessDate, platformIds: d.delivery.map((x) => x.platformId), now: new Date(0) });
}

export interface MergeResult {
  draft: EodDraft;
  /** Both people changed these sections, differently. The result keeps ours; the person picks. */
  clashes: SectionKey[];
  /** Sections taken from the other person. */
  fromTheirs: SectionKey[];
  /** Sections where our change was kept. */
  fromOurs: SectionKey[];
}

/**
 * Three-way merge of a stale save. `base` is the version we started from (null = none
 * was stored yet), `ours` is what is on this screen, `theirs` is what is stored now.
 */
export function mergeDrafts(base: EodDraft | null, ours: EodDraft, theirs: EodDraft): MergeResult {
  const from = base ?? blankLike(theirs);
  const draft = structuredClone(theirs);
  const clashes: SectionKey[] = [];
  const fromTheirs: SectionKey[] = [];
  const fromOurs: SectionKey[] = [];
  for (const k of SECTION_KEYS) {
    const weChanged = !sameSection(from, ours, k);
    const theyChanged = !sameSection(from, theirs, k);
    if (weChanged) {
      copySection(draft, ours, k);
      if (theyChanged && !sameSection(ours, theirs, k)) clashes.push(k);
      else fromOurs.push(k);
    } else if (theyChanged) {
      fromTheirs.push(k);
    }
  }
  // The confirmation only stands for the figures the person who ticked it saw.
  const weTicked = ours.confirmed !== from.confirmed;
  const confirmer = weTicked ? ours : theirs;
  draft.confirmed = confirmer.confirmed && SECTION_KEYS.every((k) => sameSection(draft, confirmer, k));
  draft.updatedAt = ours.updatedAt > theirs.updatedAt ? ours.updatedAt : theirs.updatedAt;
  return { draft, clashes, fromTheirs, fromOurs };
}

/** Stamps the sections that changed between the stored draft and the new one. */
export function stampSections(prev: EodDraft | null, next: EodDraft, stamps: SectionStamps | undefined, by: string, at: Date): SectionStamps {
  const out: SectionStamps = { ...(stamps ?? {}) };
  for (const k of changedSections(prev, next)) out[k] = { by, at: at.toISOString() };
  return out;
}

/** 21:14, London time. */
export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

/** "Jo changed Dinner at 21:14" */
export function changedByMessage(key: SectionKey, stamp: SectionStamp | undefined): string {
  return stamp ? `${stamp.by} changed ${SECTION_LABELS[key]} at ${clockTime(stamp.at)}` : `Someone else changed ${SECTION_LABELS[key]}`;
}

/** "Already sent by Jo at 23:48" */
export function alreadySentMessage(r: Pick<StoredReport, 'submittedBy' | 'submittedAt'>): string {
  return `Already sent by ${r.submittedBy ?? 'someone else'}${r.submittedAt ? ` at ${clockTime(r.submittedAt)}` : ''}`;
}

/** What changed since `mine` was read, in words: "Jo changed Dinner at 21:14 and Sam changed Wages at 21:20". */
export function describeChanges(mine: EodDraft, current: StoredReport): string {
  const keys = changedSections(mine, current.draft);
  if (!keys.length) return 'Someone else saved this report';
  const parts = keys.map((k) => changedByMessage(k, current.sections?.[k]));
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
