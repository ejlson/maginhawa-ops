/**
 * Today's report for the signed-in manager's site. Every change saves on the device
 * straight away, so nothing is lost without signal. All figures come from @maginhawa/core.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  computeDay, DEFAULT_SETTINGS, newDraft, reviewIssues, sectionProgress, SITES, submitReport, tradingDate,
  type DayResult, type EodDraft, type Issue, type SiteSettings, type StoredReport,
} from '@maginhawa/core';
import { deviceStore } from './store';
import { config, isConnected } from './config';

export function settingsFor(siteCode: string): SiteSettings {
  const site = SITES.find((s) => s.code === siteCode);
  return { ...DEFAULT_SETTINGS, siteCode, siteName: site?.name ?? siteCode };
}

const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0').slice(-12));

interface DraftValue {
  draft: EodDraft;
  settings: SiteSettings;
  result: DayResult;
  issues: Issue[];
  progress: { done: number; active: number; left: number };
  status: StoredReport['status'];
  report: StoredReport | null;
  savedAt: Date | null;
  update: (change: (d: EodDraft) => void) => void;
  submit: (submittedBy: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const DraftContext = createContext<DraftValue | null>(null);

export function DraftProvider({ siteCode, now, children }: { siteCode: string; now?: Date; children: ReactNode }) {
  const settings = useMemo(() => settingsFor(siteCode), [siteCode]);
  const businessDate = useMemo(() => tradingDate(now ?? new Date(), settings), [now, settings]);
  const store = deviceStore();

  const [report, setReport] = useState<StoredReport | null>(() => store.peek(siteCode, businessDate));
  const [draft, setDraft] = useState<EodDraft>(() =>
    report?.draft ?? newDraft({ clientId: uuid(), siteCode, businessDate, platformIds: settings.platforms.filter((p) => p.active).map((p) => p.id) }));
  const [savedAt, setSavedAt] = useState<Date | null>(report ? new Date(report.draft.updatedAt) : null);

  const status = report?.status ?? 'draft';

  const update = useCallback((change: (d: EodDraft) => void) => {
    setDraft((prev) => {
      if (status === 'submitted' || status === 'approved') return prev;
      const next = structuredClone(prev);
      change(next);
      next.updatedAt = new Date().toISOString();
      void store.saveDraft(next).then(() => setSavedAt(new Date())).catch(() => undefined);
      return next;
    });
  }, [status, store]);

  const result = useMemo(() => computeDay(draft, settings), [draft, settings]);
  const issues = useMemo(() => reviewIssues(draft, result, settings), [draft, result, settings]);
  const progress = useMemo(() => sectionProgress(draft), [draft]);

  const submit = useCallback(async (submittedBy: string) => {
    if (isConnected()) {
      // Connected mode: the server re-checks and saves to SharePoint (apps/functions/submit-eod).
      try {
        const res = await fetch(`${config.apiBase}/submit-eod`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
        const body = await res.json();
        if (!res.ok) return { ok: false as const, error: body.error ?? 'Could not send. It is saved on this phone; try again.' };
        setReport(body.report);
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: 'No connection. It is saved on this phone; try again when you have signal.' };
      }
    }
    const res = await submitReport(draft, { store, settings, submittedBy });
    if (!res.ok) return { ok: false as const, error: res.error };
    setReport(res.report);
    return { ok: true as const };
  }, [draft, settings, store]);

  const value = useMemo<DraftValue>(
    () => ({ draft, settings, result, issues, progress, status, report, savedAt, update, submit }),
    [draft, settings, result, issues, progress, status, report, savedAt, update, submit],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
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
