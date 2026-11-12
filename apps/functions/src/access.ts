/**
 * Who is calling and which sites they may open. The session cookie says who they are (an email they proved with a code, sign-in.ts);
 * their row on the SharePoint Staff list says their role and sites. The browser never decides this.
 *
 *   Head office          → every open site
 *   "All sites" ticked   → every open site, including ones opened later
 *   Otherwise            → their main site and any others head office ticked (open ones only)
 *   Left, or not listed  → nothing: not signed in
 *
 * The answer is kept in the shared cache (Workers KV) for ACCESS_TRUST_MS so ordinary requests don't each read
 * SharePoint. Taking a site away therefore applies within that time.
 */
import { accessOf, isActive, type Person } from '@maginhawa/core';
import type { Authenticate, Caller } from './handler';
import { record, trusted, type VersionIndex } from './version-index';

export const ACCESS_TRUST_MS = 5 * 60_000;

interface Cached { caller: Caller | null; validAfter: string | null }

export const accessKey = (email: string) => `access|${email.trim().toLowerCase()}`;

/** The signed-in identity from a verified session. Null = not signed in. */
export interface Identity {
  email: string;
  /** When they typed the code (ms). Sessions older than the Staff row's sessionsValidAfter stop working. */
  signedInAt?: number;
}

/** The Staff list, looked up by email. Null = nobody with that email. */
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
  /** Checks the session cookie. */
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
export function createAuthenticate(deps: AccessDeps): Authenticate {
  const now = deps.now ?? Date.now;
  return async (req) => {
    const who = await deps.identify(req);
    if (!who?.email) return null;
    const key = accessKey(who.email);
    // Cache unavailable or unreadable: ask SharePoint.
    const hit = await trusted(deps.cache, key, now(), ACCESS_TRUST_MS);
    let entry: Cached | null = null;
    if (hit !== null) {
      try { entry = JSON.parse(hit) as Cached; } catch { /* ask SharePoint */ }
    }
    if (!entry || !('caller' in entry)) {
      const person = await deps.directory.byEmail(who.email);
      entry = { caller: person ? callerFor(person) : null, validAfter: person?.sessionsValidAfter ?? null };
      // A failure here only costs one extra Graph call next time.
      await record(deps.cache, key, JSON.stringify(entry), now());
    }
    // "Sign out everywhere" or an email change: sessions from before then stop working.
    if (entry.validAfter && (who.signedInAt ?? 0) < Date.parse(entry.validAfter)) return null;
    return entry.caller;
  };
}
