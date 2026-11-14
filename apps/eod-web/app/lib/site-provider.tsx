import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { addDays, openRepairs, type NoteItem, type Repair } from '@maginhawa/core';
import { storage } from './storage';
import { deviceStore } from './store';
import { now } from './clock';
import { type SiteValue, type TeamNote, Ctx } from './site';

const REPAIRS = 'mgh.repairs.v1';
const readKey = (siteCode: string, date: string) => `mgh.handover-read.v1.${siteCode}|${date}`;
const teamKey = (siteCode: string, date: string) => `mgh.handover-notes.v1.${siteCode}|${date}`;

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
  // The team's notes from last night go to the opener with the closer's, each saying who wrote it.
  const handover = useMemo<NoteItem[]>(() => [
    ...(lastNight?.draft.handover ?? []).filter((h) => h.body.trim()),
    ...storage.get<TeamNote[]>(teamKey(siteCode, yesterday), []).map((n) => ({ id: n.id, category: `${n.category} · ${n.by}`, body: n.body, raiseRepair: false })),
  ], [lastNight, siteCode, yesterday]);
  const [team, setTeam] = useState<{ key: string; notes: TeamNote[] }>(() => ({ key: teamKey(siteCode, businessDate), notes: storage.get<TeamNote[]>(teamKey(siteCode, businessDate), []) }));
  // A new trading day (the app left open overnight) reads that day's notes, never carrying yesterday's over.
  const key = teamKey(siteCode, businessDate);
  const teamNotes = team.key === key ? team.notes : storage.get<TeamNote[]>(key, []);
  const setTeamNotes = (f: (prev: TeamNote[]) => TeamNote[]) => setTeam((t) => ({ key, notes: f(t.key === key ? t.notes : storage.get<TeamNote[]>(key, [])) }));
  const saveTeam = useCallback((change: (all: TeamNote[]) => TeamNote[]) => {
    setTeamNotes((prev) => { const next = change(prev); storage.set(key, next); return next; });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
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
    // Only the closer's name when the closer wrote some of it; the team's notes carry their own names.
    handoverBy: (lastNight?.draft.handover ?? []).some((h) => h.body.trim()) ? lastNight?.submittedBy ?? null : null,
    handoverRead,
    markHandoverRead: () => { storage.set(readKey(siteCode, yesterday), true); setRead(true); },
    teamNotes,
    addTeamNote: (category, body, by) => saveTeam((all) => [...all, { id: `n-${Date.now().toString(36)}-${all.length}`, category, body, by, at: now().toISOString() }]),
    removeTeamNote: (id) => saveTeam((all) => all.filter((n) => n.id !== id)),
  }), [repairs, siteCode, save, lastNight, handover, handoverRead, yesterday, teamNotes, saveTeam]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
