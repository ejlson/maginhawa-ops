/**
 * Who is signed in. Demo mode: pick a name and site on this device.
 * Connected mode will use Microsoft sign-in (MSAL, Entra ID) behind the same useUser() hook.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { storage } from './storage';

export type Role = 'manager' | 'admin' | 'finance';

export interface User {
  name: string;
  initials: string;
  role: Role;
  siteCode: string;
}

const KEY = 'mgh.user';

interface AuthValue {
  user: User | null;
  signIn: (u: User) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser?: User | null }) {
  const [user, setUser] = useState<User | null>(() => (initialUser !== undefined ? initialUser : storage.get<User | null>(KEY, null)));
  const signIn = useCallback((u: User) => { storage.set(KEY, u); setUser(u); }, []);
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
