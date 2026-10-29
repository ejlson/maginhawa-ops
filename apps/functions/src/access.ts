/**
 * Who is calling and which sites they may open. The sign-in token says who they are (Entra ID);
 * their row on the SharePoint Staff list says their role and sites. The browser never decides this.
 *
 *   Head office          → every open site
 *   "All sites" ticked   → every open site, including ones opened later
 *   Otherwise            → their main site and any others head office ticked (open ones only)
 *   Left, or not listed  → nothing: not signed in
 *
 * The answer is kept in Netlify Blobs for ACCESS_TRUST_MS so ordinary requests don't each read
 * SharePoint. Taking a site away therefore applies within that time.
 */
import { accessOf, isActive, type Person } from '@maginhawa/core';
import type { Caller } from './handler';
import type { VersionIndex } from './version-index';

export const ACCESS_TRUST_MS = 5 * 60_000;

export const accessKey = (email: string) => `access|${email.trim().toLowerCase()}`;

/** The signed-in identity from a verified token. Null = no valid token. */
export interface Identity { email: string }

/** The Staff list, looked up by work email. Null = nobody active with that email. */
export interface StaffDirectory {
  byEmail(email: string): Promise<Person | null>;
}

/** A Staff list row as the caller the handlers check (`caller.siteCodes`). */
export function callerFor(p: Person): Caller | null {
  if (!isActive(p)) return null;
  const siteCodes = accessOf(p);
  return siteCodes.length ? { name: p.name, role: p.role, siteCodes } : null;
}

export interface AccessDeps {
  /** Checks the bearer token (Entra ID). */
  identify: (req: Request) => Promise<Identity | null>;
  directory: StaffDirectory;
  cache?: VersionIndex;
  now?: () => number;
}

/**
 * The `authenticate` every handler takes. A SharePoint failure with nothing cached throws, so the
 * handler answers 5xx and the app keeps the work on the device, rather than telling someone with
 * access that they've been signed out.
 */
export function createAuthenticate(deps: AccessDeps) {
  const now = deps.now ?? Date.now;
  return async (req: Request): Promise<Caller | null> => {
    const who = await deps.identify(req);
    if (!who?.email) return null;
    const key = accessKey(who.email);
    try {
      const hit = await deps.cache?.get(key);
      if (hit && now() - hit.at < ACCESS_TRUST_MS) return JSON.parse(hit.value) as Caller | null;
    } catch {
      /* Blobs unavailable: ask SharePoint. */
    }
    const person = await deps.directory.byEmail(who.email);
    const caller = person ? callerFor(person) : null;
    try {
      await deps.cache?.set(key, { value: JSON.stringify(caller), at: now() });
    } catch {
      /* ignore: costs one extra Graph call next time */
    }
    return caller;
  };
}
