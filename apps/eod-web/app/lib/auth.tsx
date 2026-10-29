/**
 * Who is signed in. Demo mode: pick a name and site on this device.
 * Connected mode will use Microsoft sign-in (MSAL, Entra ID) behind the same useUser() hook.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { accessOf, findPerson, isOpenSite, OPEN_SITE_CODES } from '@maginhawa/core';
import { storage } from './storage';
import { people, usePeople } from './people';

/** Staff, supervisors and managers see their own site; head office sees every site. */
export type Role = 'staff' | 'supervisor' | 'manager' | 'headoffice';

export const ROLE_LABELS: Record<Role, string> = {
  staff: 'Staff',
  supervisor: 'Supervisor',
  manager: 'Manager',
  headoffice: 'Head office',
};

/** What each role can do. Managers include assistant managers; head office includes finance, admin and operations managers. */
export const can = {
  doChecklists: (_r: Role) => true,
  doEod: (r: Role) => r === 'supervisor' || r === 'manager',
  editChecklists: (r: Role) => r === 'manager' || r === 'headoffice',
  seeAllSites: (r: Role) => r === 'headoffice',
  fixRepairs: (r: Role) => r === 'supervisor' || r === 'manager' || r === 'headoffice',
  // Food safety (HANDOFF.md §8a).
  /** Change an answer on a finished checklist; the old answer is kept. */
  correctRecords: (r: Role) => r === 'supervisor' || r === 'manager' || r === 'headoffice',
  /** Make the records pack for an inspector: own site, or any site for head office. */
  compileRecords: (r: Role) => r === 'supervisor' || r === 'manager' || r === 'headoffice',
  logComplaints: (r: Role) => r === 'supervisor' || r === 'manager' || r === 'headoffice',
  editAllergens: (r: Role) => r === 'manager' || r === 'headoffice',
  /** Certificates and fit-to-work answers (health data: managers only). */
  seeStaffHealth: (r: Role) => r === 'manager' || r === 'headoffice',
  logInspections: (r: Role) => r === 'manager' || r === 'headoffice',
  doReview: (r: Role) => r === 'manager' || r === 'headoffice',
  setKeepPeriods: (r: Role) => r === 'headoffice',
  /** Add people, change roles, reset PINs, mark leavers: own site, or any site for head office. */
  managePeople: (r: Role) => r === 'manager' || r === 'headoffice',
};

/** Where each role lands after signing in. */
export const homeFor = (r: Role) => (r === 'headoffice' ? '/head-office' : '/');

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

export interface User {
  name: string;
  initials: string;
  role: Role;
  /** The site they're working in now. */
  siteCode: string;
  /** Head office working inside one site's own screens (EOD, checklists, repairs) rather than across all sites. */
  inSite?: boolean;
}

/** The EOD is for supervisors and managers, and for head office once they've opened a site. */
export const canDoEod = (u: User) => can.doEod(u.role) || (u.role === 'headoffice' && !!u.inSite);

/** Where someone's home is right now: head office's overview, or the site they're working in. */
export const homeOf = (u: User) => (u.role === 'headoffice' && !u.inSite ? '/head-office' : '/');

/** The name saved on records someone fills in, so a report shows when head office did it. */
export const recordedAs = (u: User) => (u.role === 'headoffice' ? `${u.name} (head office)` : u.name);

const KEY = 'mgh.user';
const peopleKey = (siteCode: string) => `mgh.people.v1.${siteCode}`;

/** People who have used this device at a site, most recent first: the shared kitchen iPad's quick switch. */
export const recentPeople = (siteCode: string): User[] => storage.get<User[]>(peopleKey(siteCode), []);

export function remember(u: User) {
  const others = recentPeople(u.siteCode).filter((p) => p.name.toLowerCase() !== u.name.toLowerCase());
  storage.set(peopleKey(u.siteCode), [u, ...others].slice(0, 8));
}

interface AuthValue {
  user: User | null;
  signIn: (u: User) => void;
  signOut: () => void;
  /** Move to another of their sites. Each site keeps its own EOD and checklists. */
  switchSite: (siteCode: string) => void;
  /** Head office: work in one site's own screens. */
  openSite: (siteCode: string) => void;
  /** Head office: back to all sites. */
  leaveSite: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser?: User | null }) {
  const [user, setUser] = useState<User | null>(() => (initialUser !== undefined ? initialUser : normalise(storage.get<User | null>(KEY, null))));
  const signIn = useCallback((u: User) => {
    storage.set(KEY, u);
    remember(u);
    if (u.role !== 'headoffice') people.ensure(u.siteCode, u.name, u.role, '');
    setUser(u);
  }, []);
  const signOut = useCallback(() => { storage.remove(KEY); setUser(null); }, []);
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

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

/**
 * The open sites someone can switch between: every one for head office, otherwise the sites head
 * office has given them on the People list (main site first, or every site for "all sites").
 * Always includes the site they're in now.
 */
export function useMySites(): string[] {
  const { user } = useAuth();
  const here = usePeople(user?.siteCode ?? '');
  if (!user) return [];
  if (user.role === 'headoffice') return [...OPEN_SITE_CODES];
  const me = findPerson(here, user.siteCode, user.name);
  const mine = me ? accessOf(me) : [];
  return mine.includes(user.siteCode) ? mine : [user.siteCode, ...mine];
}

/** Managers with two or more sites get the "My sites" overview of just their sites. */
export function useHasMySites(): boolean {
  const { user } = useAuth();
  const mine = useMySites();
  return user?.role === 'manager' && mine.length > 1;
}

export function initialsOf(name: string): string {
  return name.replace(/[[\]]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
}
