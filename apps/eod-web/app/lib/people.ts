/**
 * Who works at each site. Demo mode keeps the list on this device; connected mode will keep it in a
 * SharePoint People list, so it's the same on every device. Rules are in @maginhawa/core (people.ts).
 */
import { useSyncExternalStore } from 'react';
import { findPerson, isActive, worksAt, type Person, type PersonRole } from '@maginhawa/core';
import { storage } from './storage';
import { now } from './clock';

const KEY = 'mgh.staff.v1';
const listeners = new Set<() => void>();
let version = 0;

const read = () => storage.get<Person[]>(KEY, []);
function write(next: Person[]) {
  storage.set(KEY, next);
  version++;
  listeners.forEach((l) => l());
}

const newId = (siteCode: string, name: string) =>
  `${siteCode}-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${now().getTime().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/**
 * Anyone who signed in on this device before the People list existed is added once, so a site's
 * list isn't empty the first time a manager opens it.
 */
function seed(siteCode: string, all: Person[]): Person[] {
  if (all.some((p) => p.siteCode === siteCode)) return all;
  const before = storage.get<{ name: string; role: PersonRole }[]>(`mgh.people.v1.${siteCode}`, []);
  if (!before.length) return all;
  const at = now().toISOString();
  const added = before
    .filter((u, i) => before.findIndex((x) => x.name.toLowerCase() === u.name.toLowerCase()) === i)
    .map((u): Person => ({ id: newId(siteCode, u.name), name: u.name, role: u.role, siteCode, email: null, addedAt: at, addedBy: '', leftAt: null }));
  const next = [...all, ...added];
  storage.set(KEY, next);
  return next;
}

export const people = {
  /** Everyone at a site, including people who've left and people whose main site is elsewhere. */
  at(siteCode: string): Person[] {
    return seed(siteCode, read()).filter((p) => worksAt(p, siteCode));
  },
  all: read,
  add(p: Omit<Person, 'id' | 'addedAt' | 'leftAt'>): Person {
    const person: Person = { ...p, name: p.name.trim(), email: p.email?.trim() || null, id: newId(p.siteCode, p.name), addedAt: now().toISOString(), leftAt: null };
    write([...read(), person]);
    return person;
  },
  update(id: string, patch: Partial<Omit<Person, 'id'>>) {
    write(read().map((p) => (p.id === id ? { ...p, ...patch } : p)));
  },
  /** Puts a person back exactly as they were, for Undo. */
  restore(person: Person) {
    write(read().map((p) => (p.id === person.id ? person : p)));
  },
  /**
   * Someone typed their name on the shared iPad. If nobody added them yet, they join as staff,
   * so the iPad keeps working while a manager catches up with the list.
   */
  ensure(siteCode: string, name: string, role: PersonRole, by: string) {
    const all = seed(siteCode, read());
    if (findPerson(all, siteCode, name)) return;
    write([...all, { id: newId(siteCode, name), name: name.trim(), role, siteCode, email: null, addedAt: now().toISOString(), addedBy: by, leftAt: null }]);
  },
};

/** Re-renders when anyone's added or changed on this device. */
export function usePeople(siteCode: string): Person[] {
  useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => version,
    () => version,
  );
  return people.at(siteCode);
}

export const activePeople = (list: Person[]) => list.filter(isActive);
