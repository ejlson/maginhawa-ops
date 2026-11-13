/**
 * Who is signed in. Demo mode: pick a name and site on this device.
 * Connected mode signs in with an emailed code (lib/session.ts) behind the same useAuth() hook.
 */
import { createContext, useContext } from 'react';
import { accessOf, findPerson, OPEN_SITE_CODES } from '@maginhawa/core';
import { storage } from './storage';
import { usePeople } from './people';

/** Staff, supervisors and managers see their own site; head office sees every site. */
export type Role = 'staff' | 'supervisor' | 'manager' | 'headoffice';

export const ROLE_LABELS: Record<Role, string> = {
  staff: 'Staff',
  supervisor: 'Supervisor',
  manager: 'Manager',
  headoffice: 'Head office',
};
export const ROLE_ENTRIES = Object.entries(ROLE_LABELS) as [Role, string][];

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
  // Stock counts (docs/reports/stock-count-scope.md).
  /** Anyone can count stock and send a count (user's decision, 12 Nov 2026). */
  countStock: (_r: Role) => true,
  /** Change a figure on a sent count; the old figure is kept. */
  correctStock: (r: Role) => r === 'supervisor' || r === 'manager' || r === 'headoffice',
  /** See what stock is worth. Staff count without the money. */
  seeStockValue: (r: Role) => r === 'supervisor' || r === 'manager' || r === 'headoffice',
  /** The group item list and costs. */
  editStockItems: (r: Role) => r === 'headoffice',
};

/** Where each role lands after signing in. */
export const homeFor = (r: Role) => (r === 'headoffice' ? '/head-office' : '/');

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

export const AuthContext = createContext<AuthValue | null>(null);

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
