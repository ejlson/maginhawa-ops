import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { addDays, openRepairs, type Repair } from '@maginhawa/core';
import { storage } from './storage';
import { deviceStore } from './store';
import { now } from './clock';
import { type SiteValue, Ctx } from './site';

const REPAIRS = 'mgh.repairs.v1';
const readKey = (siteCode: string, date: string) => `mgh.handover-read.v1.${siteCode}|${date}`;

export function SiteProvider({ siteCode, businessDate, children }: { siteCode: string; businessDate: string; children: ReactNode }) {
  const [repairs, setRepairs] = useState<Repair[]>(() => storage.get(REPAIRS, []));
  const save = useCallback((change: (all: Repair[]) => Repair[]) => {
    setRepairs((prev) => {
      const next = change(prev);
      storage.set(REPAIRS, next);
      return next;
    });
  }, []);

  const yesterday = addDays(businessDate, -1);
  const lastNight = deviceStore().peek(siteCode, yesterday);
  const handover = (lastNight?.draft.handover ?? []).filter((h) => h.body.trim());
  const [handoverRead, setRead] = useState(() => storage.get(readKey(siteCode, yesterday), false));

  const value = useMemo<SiteValue>(() => ({
    repairs,
    open: openRepairs(repairs, siteCode),
    report: (r) => save((all) => [...all, {
      ...r, id: `r-${Date.now().toString(36)}-${all.length}`, siteCode, reportedAt: now().toISOString(), fixedAt: null, fixedBy: null,
    }]),
    markFixed: (id, by) => save((all) => all.map((r) => (r.id === id ? { ...r, fixedAt: now().toISOString(), fixedBy: by } : r))),
    lastNight,
    handover,
    handoverBy: lastNight?.submittedBy ?? null,
    handoverRead,
    markHandoverRead: () => { storage.set(readKey(siteCode, yesterday), true); setRead(true); },
  }), [repairs, siteCode, save, lastNight, handover, handoverRead, yesterday]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
