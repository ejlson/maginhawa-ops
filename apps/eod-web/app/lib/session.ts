/**
 * Talks to the sign-in routes (apps/functions/src/sign-in.ts). The session itself is an
 * HttpOnly cookie the browser keeps; the app never sees or stores it.
 */
import type { Role, User } from './auth';
import { initialsOf } from './auth';
import { config } from './config';

export interface Me {
  kind: 'user' | 'device';
  name: string;
  role?: Role;
  siteCode: string;
  siteCodes?: string[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string; code?: string };

async function post<T>(path: string, body: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(`${config.apiBase}/${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, value: data as T };
    if (res.status === 503) return { ok: false, error: 'Sign-in isn’t switched on yet. Ask head office.' };
    return { ok: false, error: data.error ?? 'Something went wrong. Try again.', code: data.code };
  } catch {
    return { ok: false, error: 'No connection. Check your signal and try again.' };
  }
}

export const askForCode = (email: string) => post<{ challenge: string; minutes: number }>('auth/start', { email });
export const checkCode = (challenge: string, code: string) => post<{ me: Me; firstTime: boolean }>('auth/verify', { challenge, code });
export const signOutOnServer = () => post<{ ok: true }>('auth/sign-out', {});

/** 'signed-out' only when the server says so; no signal keeps whoever was signed in (the app works offline). */
export async function whoAmI(): Promise<Me | 'signed-out' | 'unknown'> {
  try {
    const res = await fetch(`${config.apiBase}/me`, { credentials: 'same-origin' });
    if (res.status === 401) return 'signed-out';
    if (!res.ok) return 'unknown';
    return ((await res.json()) as { me: Me }).me;
  } catch {
    return 'unknown';
  }
}

export const userFrom = (me: Me): User => ({ name: me.name, initials: initialsOf(me.name), role: me.role ?? 'staff', siteCode: me.siteCode });
