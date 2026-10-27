/**
 * Staff PINs for the shared iPad, kept on this device as salted hashes in demo mode.
 * Connected mode will keep them with the staff list, so a PIN works on every iPad at the site.
 */
import type { PinRecord } from '@maginhawa/core';
import { storage } from './storage';

const key = (siteCode: string) => `mgh.pins.v1.${siteCode}`;
const id = (name: string) => name.trim().toLowerCase();

const all = (siteCode: string) => storage.get<Record<string, PinRecord>>(key(siteCode), {});

export const pins = {
  get: (siteCode: string, name: string): PinRecord | null => all(siteCode)[id(name)] ?? null,
  set: (siteCode: string, name: string, r: PinRecord) => storage.set(key(siteCode), { ...all(siteCode), [id(name)]: r }),
  /** A manager clears a forgotten PIN; the person chooses a new one next time. */
  reset: (siteCode: string, name: string) => {
    const next = all(siteCode);
    delete next[id(name)];
    storage.set(key(siteCode), next);
  },
  has: (siteCode: string, name: string) => Boolean(all(siteCode)[id(name)]),
};
