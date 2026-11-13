/**
 * Today's report for the signed-in person's site. Several people can work on it at once
 * from different devices: every change shows at once, saves with a version check, and
 * merges with the others' changes section by section (EodSyncClient in @maginhawa/core).
 * All figures come from @maginhawa/core.
 */
import { createContext, useContext, useEffect } from 'react';
import {
  DEFAULT_SETTINGS, findSite, type DayResult, type DefinitionVersion, type EodDraft, type EodSyncState, type Issue, type SectionKey, type SiteSettings, type StoredReport, type SubmitErrorCode,
} from '@maginhawa/core';

export function settingsFor(siteCode: string): SiteSettings {
  const site = findSite(siteCode);
  return { ...DEFAULT_SETTINGS, siteCode, siteName: site?.name ?? siteCode };
}

export interface DraftValue {
  draft: EodDraft;
  settings: SiteSettings;
  result: DayResult;
  /** The report builder's version this report uses (null = today's built-in rules). */
  definition: DefinitionVersion | null;
  issues: Issue[];
  progress: { done: number; active: number; left: number };
  status: StoredReport['status'];
  report: StoredReport | null;
  savedAt: Date | null;
  /** Saving, offline, clashes, who else is here. */
  sync: EodSyncState;
  update: (change: (d: EodDraft) => void) => void;
  submit: (submittedBy?: string) => Promise<{ ok: true } | { ok: false; error: string; code: SubmitErrorCode }>;
  /** Settles a clash: keep what this person typed, or take the other person's. */
  resolve: (section: SectionKey, keep: 'mine' | 'theirs') => void;
  dismissNotice: () => void;
  /** What this person has open, for "Jo is in Dinner" on the other devices. */
  setWhere: (where: string | null) => void;
}

export const DraftContext = createContext<DraftValue | null>(null);

/** Marks what this screen has open (e.g. "Dinner") while it is mounted. */
export function useWhere(where: string | null) {
  const { setWhere } = useDraft();
  useEffect(() => {
    setWhere(where);
    return () => setWhere(null);
  }, [where, setWhere]);
}

export function useDraft(): DraftValue {
  const v = useContext(DraftContext);
  if (!v) throw new Error('useDraft must be used inside DraftProvider');
  return v;
}

export function formatDay(businessDate: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return new Date(`${businessDate}T12:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
}

export const timeHM = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
