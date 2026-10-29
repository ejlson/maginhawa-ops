/**
 * Today's report for the signed-in person's site. Several people can work on it at once
 * from different devices: every change shows at once, saves with a version check, and
 * merges with the others' changes section by section (EodSyncClient in @maginhawa/core).
 * All figures come from @maginhawa/core.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import {
  computeDay, DEFAULT_SETTINGS, EodSyncClient, newDraft, reviewIssues, sectionProgress, SITES, tradingDate,
  type DayResult, type EodDraft, type EodSyncState, type Issue, type SectionKey, type SiteSettings, type StoredReport, type SubmitErrorCode,
} from '@maginhawa/core';
import { deviceStore } from './store';
import { usesServer } from './config';
import { useAuth } from './auth';
import { now as clockNow } from './clock';
import { storage } from './storage';
import { deviceId, eodRemote, presenceRemote, useLive, uuid } from './sync';

export function settingsFor(siteCode: string): SiteSettings {
  const site = SITES.find((s) => s.code === siteCode);
  return { ...DEFAULT_SETTINGS, siteCode, siteName: site?.name ?? siteCode };
}

interface DraftValue {
  draft: EodDraft;
  settings: SiteSettings;
  result: DayResult;
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

const DraftContext = createContext<DraftValue | null>(null);

export function DraftProvider({ siteCode, now, children }: { siteCode: string; now?: Date; children: ReactNode }) {
  const { user } = useAuth();
  const who = user?.name ?? 'Manager';
  const settings = useMemo(() => settingsFor(siteCode), [siteCode]);
  const businessDate = useMemo(() => tradingDate(now ?? new Date(), settings), [now, settings]);

  const client = useMemo(() => new EodSyncClient({
    remote: eodRemote(settingsFor),
    siteCode, businessDate, user: who, deviceId: deviceId(),
    blank: () => newDraft({ clientId: uuid(), siteCode, businessDate, platformIds: settings.platforms.filter((p) => p.active).map((p) => p.id) }),
    // Demo mode: the "server" is on this device, so the saved report can show straight away.
    initial: usesServer() ? null : deviceStore().peek(siteCode, businessDate),
    storage, presence: presenceRemote(), newId: uuid, now: clockNow,
  }), [siteCode, businessDate, who, settings]);
  useLive(client, `eod:${siteCode}|${businessDate}`);
  const sync = useSyncExternalStore(client.subscribe, client.getState, client.getState);

  const { draft, report } = sync;
  const status = report?.status ?? 'draft';

  const update = useCallback((change: (d: EodDraft) => void) => { void client.edit(change); }, [client]);
  const submit = useCallback(async () => {
    const res = await client.submit();
    return res.ok ? { ok: true as const } : { ok: false as const, error: res.error, code: res.code };
  }, [client]);
  const resolve = useCallback((section: SectionKey, keep: 'mine' | 'theirs') => { void client.resolve(section, keep); }, [client]);
  const dismissNotice = useCallback(() => client.dismissNotice(), [client]);
  const setWhere = useCallback((where: string | null) => client.setWhere(where), [client]);

  const result = useMemo(() => computeDay(draft, settings), [draft, settings]);
  const issues = useMemo(() => reviewIssues(draft, result, settings), [draft, result, settings]);
  const progress = useMemo(() => sectionProgress(draft), [draft]);
  const savedAt = useMemo(() => (sync.savedAt ? new Date(sync.savedAt) : null), [sync.savedAt]);

  const value = useMemo<DraftValue>(
    () => ({ draft, settings, result, issues, progress, status, report, savedAt, sync, update, submit, resolve, dismissNotice, setWhere }),
    [draft, settings, result, issues, progress, status, report, savedAt, sync, update, submit, resolve, dismissNotice, setWhere],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

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
