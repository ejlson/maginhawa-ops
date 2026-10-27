/**
 * Who is signed in. Demo mode: pick a name and site on this device.
 * Connected mode will use Microsoft sign-in (MSAL, Entra ID) behind the same useUser() hook.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { storage } from './storage';

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
};

/** Where each role lands after signing in. */
export const homeFor = (r: Role) => (r === 'headoffice' ? '/head-office' : '/');

/** Users saved before the roles changed were 'admin' or 'finance': both are head office now. */
function normalise(u: User | null): User | null {
  if (!u) return u;
  const role = (u.role as string) === 'admin' || (u.role as string) === 'finance' ? 'headoffice' : u.role;
  return role in ROLE_LABELS ? { ...u, role } : null;
}

export interface User {
  name: string;
  initials: string;
  role: Role;
  siteCode: string;
}

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
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser?: User | null }) {
  const [user, setUser] = useState<User | null>(() => (initialUser !== undefined ? initialUser : normalise(storage.get<User | null>(KEY, null))));
  const signIn = useCallback((u: User) => { storage.set(KEY, u); remember(u); setUser(u); }, []);
  const signOut = useCallback(() => { storage.remove(KEY); setUser(null); }, []);
  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

export function initialsOf(name: string): string {
  return name.replace(/[[\]]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
}
