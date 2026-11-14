import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { addDays, openRepairs, type Repair } from '@maginhawa/core';
import { storage } from './storage';
import { deviceStore } from './store';
import { now } from './clock';
import { type SiteValue, Ctx } from './site';

const REPAIRS = 'mgh.repairs.v1';
const readKey = (siteCode: string, date: string) => `mgh.handover-read.v1.${siteCode}|${date}`;

function withoutPhotos(r: Repair): Repair {
  const { photos: _drop, ...rest } = r; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}

export function SiteProvider({ siteCode, businessDate, children }: { siteCode: string; businessDate: string; children: ReactNode }) {
  const [repairs, setRepairs] = useState<Repair[]>(() => storage.get(REPAIRS, []));
  const save = useCallback((change: (all: Repair[]) => Repair[]) => {
    setRepairs((prev) => {
      const next = change(prev);
      // Photos are the big part. If the device is full, keep the repairs and drop photos, oldest first,
      // so a repair (and everything else saved on this device) is never lost to a photo.
      if (!storage.set(REPAIRS, next)) {
        const withPhotos = next.filter((r) => r.photos?.length).sort((a, b) => a.reportedAt.localeCompare(b.reportedAt));
        let slim = next;
        for (const old of withPhotos) {
          slim = slim.map((r) => (r.id === old.id ? withoutPhotos(r) : r));
          if (storage.set(REPAIRS, slim)) return slim;
        }
        return slim;
      }
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
    // Once fixed, its photos have done their job: drop them to keep the device light.
    markFixed: (id, by) => save((all) => all.map((r) => (r.id === id ? { ...withoutPhotos(r), fixedAt: now().toISOString(), fixedBy: by } : r))),
    lastNight,
    handover,
    handoverBy: lastNight?.submittedBy ?? null,
    handoverRead,
    markHandoverRead: () => { storage.set(readKey(siteCode, yesterday), true); setRead(true); },
  }), [repairs, siteCode, save, lastNight, handover, handoverRead, yesterday]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
