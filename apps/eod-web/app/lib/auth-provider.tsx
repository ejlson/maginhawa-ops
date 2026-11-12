import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { accessOf, findPerson, isOpenSite, OPEN_SITE_CODES } from '@maginhawa/core';
import { storage } from './storage';
import { people } from './people';
import { ROLE_LABELS, type User, remember, AuthContext } from './auth';
import { usesEmailSignIn } from './config';
import { signOutOnServer, userFrom, whoAmI } from './session';

/**
 * Users saved before the roles changed were 'admin' or 'finance': both are head office now.
 * Someone saved in a site that has since closed moves to the first site they still have, or signs in again.
 */
function normalise(u: User | null): User | null {
  if (!u) return u;
  const role = (u.role as string) === 'admin' || (u.role as string) === 'finance' ? 'headoffice' : u.role;
  if (!(role in ROLE_LABELS)) return null;
  if (isOpenSite(u.siteCode)) return { ...u, role };
  const me = people.all().find((p) => findPerson([p], u.siteCode, u.name));
  const next = role === 'headoffice' ? OPEN_SITE_CODES[0] : me ? accessOf(me)[0] : undefined;
  return next ? { ...u, role, siteCode: next, inSite: false } : null;
}

const KEY = 'mgh.user';
export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser?: User | null }) {
  const [user, setUser] = useState<User | null>(() => (initialUser !== undefined ? initialUser : normalise(storage.get<User | null>(KEY, null))));
  const signIn = useCallback((u: User) => {
    storage.set(KEY, u);
    remember(u);
    if (u.role !== 'headoffice') people.ensure(u.siteCode, u.name, u.role, '');
    setUser(u);
  }, []);
  const signOut = useCallback(() => {
    storage.remove(KEY);
    setUser(null);
    if (usesEmailSignIn()) void signOutOnServer();
  }, []);
  // Email sign-in: the server's cookie decides. Check once on opening; no signal keeps the person signed in.
  useEffect(() => {
    if (!usesEmailSignIn() || initialUser !== undefined) return;
    let live = true;
    void whoAmI().then((me) => {
      if (!live || me === 'unknown') return;
      if (me === 'signed-out') { storage.remove(KEY); setUser(null); return; }
      setUser((u) => {
        const fresh = userFrom(me);
        // Keep the site they were working in, if they still have it.
        const next = u && (me.siteCodes ?? [me.siteCode]).includes(u.siteCode) ? { ...fresh, siteCode: u.siteCode, inSite: u.inSite } : fresh;
        storage.set(KEY, next);
        return next;
      });
    });
    return () => { live = false; };
  }, [initialUser]);
  const save = useCallback((patch: Partial<User>) => setUser((u) => {
    if (!u) return u;
    const next = { ...u, ...patch };
    storage.set(KEY, next);
    return next;
  }), []);
  const switchSite = useCallback((siteCode: string) => save({ siteCode }), [save]);
  const openSite = useCallback((siteCode: string) => save({ siteCode, inSite: true }), [save]);
  const leaveSite = useCallback(() => save({ inSite: false }), [save]);
  const value = useMemo(() => ({ user, signIn, signOut, switchSite, openSite, leaveSite }), [user, signIn, signOut, switchSite, openSite, leaveSite]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
