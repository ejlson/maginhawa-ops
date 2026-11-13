import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { computeDayWith, definitionIssues, EodSyncClient, reviewIssues, liveVersion, newDraft, sectionProgress, tradingDate, type EodDraft, type SectionKey } from '@maginhawa/core';
import { deviceStore } from './store';
import { usesServer } from './config';
import { useAuth } from './auth';
import { now as clockNow } from './clock';
import { storage } from './storage';
import { useLiveDefinitions } from './definition';
import { deviceId, eodRemote, presenceRemote, useLive, uuid } from './sync';
import { settingsFor, type DraftValue, DraftContext } from './draft';

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

  // Figures come from the report builder's version approved for this trading day.
  const definitions = useLiveDefinitions(draft.businessDate);
  const definition = useMemo(() => liveVersion(definitions, draft.businessDate), [definitions, draft.businessDate]);
  const result = useMemo(() => computeDayWith(draft, settings, undefined, definitions), [draft, settings, definitions]);
  const issues = useMemo(() => [...reviewIssues(draft, result, settings), ...definitionIssues(draft, definitions)], [draft, result, settings, definitions]);
  const progress = useMemo(() => sectionProgress(draft), [draft]);
  const savedAt = useMemo(() => (sync.savedAt ? new Date(sync.savedAt) : null), [sync.savedAt]);

  const value = useMemo<DraftValue>(
    () => ({ draft, settings, result, definition, issues, progress, status, report, savedAt, sync, update, submit, resolve, dismissNotice, setWhere }),
    [draft, settings, result, definition, issues, progress, status, report, savedAt, sync, update, submit, resolve, dismissNotice, setWhere],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}
