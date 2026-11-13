/**
 * The people who work at each site: who they are, their role, and how they sign in.
 * Managers look after their own site's people; only head office can give head-office access.
 * Someone who leaves is marked as left, never deleted, so their past records keep their name.
 *
 * Role (what someone can do) and access (where) are separate. Head office always has every site.
 * Everyone else has their main site, any others head office ticks, or "all sites", which also
 * covers sites opened later. Only head office changes anyone's sites.
 */
import { isOpenSite, OPEN_SITE_CODES } from './settings';


export type PersonRole = 'staff' | 'supervisor' | 'manager' | 'headoffice';

export interface Person {
  id: string;
  name: string;
  role: PersonRole;
  /** Their main site: where they land after signing in. */
  siteCode: string;
  /** Other sites they also work at. Head office sets these. */
  otherSites?: string[];
  /** Every open site, now and later. Head office sets this. */
  allSites?: boolean;
  /** Any email they can read (work or personal). Managers and head office sign in with a code sent to it. */
  email: string | null;
  /** When they first proved the email by typing a code sent to it. */
  emailVerifiedAt?: string | null;
  /** Sign-ins that started before this time no longer work ("sign out everywhere", an email change). */
  sessionsValidAfter?: string | null;
  addedAt: string;
  addedBy: string;
  /** When they left. They can't sign in after this. */
  leftAt: string | null;
}

/** Staff and supervisors use a PIN on the shared iPad; managers and head office sign in with an email code. */
export const usesPin = (r: PersonRole) => r === 'staff' || r === 'supervisor';

export const canManagePeople = (r: PersonRole) => r === 'manager' || r === 'headoffice';

/** Roles someone can give. Head-office access can only come from head office. */
export const rolesGivenBy = (by: PersonRole): PersonRole[] =>
  by === 'headoffice' ? ['staff', 'supervisor', 'manager', 'headoffice'] : by === 'manager' ? ['staff', 'supervisor', 'manager'] : [];

/** A manager can't change a head-office person; head office can change anyone. */
export const canEdit = (by: PersonRole, person: Pick<Person, 'role'>) =>
  canManagePeople(by) && (by === 'headoffice' || person.role !== 'headoffice');

export const isActive = (p: Pick<Person, 'leftAt'>) => !p.leftAt;

export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
/** Kept for older callers: any email works now, not only a work one. */
export const isWorkEmail = isEmail;
/** The form every email is compared and stored in. */
export const normaliseEmail = (s: string) => s.trim().toLowerCase();

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The first thing stopping this person being saved, in plain words, or null when they can be. */
export function personProblem(
  p: { name: string; role: PersonRole; email: string | null; siteCode: string },
  others: Person[],
  by: PersonRole,
  id?: string,
): string | null {
  if (!canManagePeople(by)) return 'Only managers and head office can add people.';
  if (!p.name.trim()) return 'Type their name.';
  if (!rolesGivenBy(by).includes(p.role)) return 'Only head office can give head-office access.';
  if (others.some((o) => o.id !== id && o.siteCode === p.siteCode && isActive(o) && sameName(o.name, p.name))) {
    return `There's already a ${p.name.trim()} here. Add a surname or initial.`;
  }
  if (!usesPin(p.role) && !isWorkEmail(p.email ?? '')) return 'Add their email so they can sign in.';
  return null;
}

/** Only head office gives or takes away sites, for anyone (managers add people at their own site only). */
export const canGiveSites = (by: PersonRole) => by === 'headoffice';

type Sited = Pick<Person, 'siteCode' | 'otherSites' | 'allSites'>;

/**
 * Every site someone works at, main site first, without repeats. "All sites" adds every open site.
 * A closed site they were ticked at stays listed, so old records still find them.
 */
export const sitesOf = (p: Sited): string[] =>
  [p.siteCode, ...(p.otherSites ?? []), ...(p.allSites ? OPEN_SITE_CODES : [])].filter((c, i, all) => all.indexOf(c) === i);

/**
 * The sites someone may open and work in now: every open site for head office, otherwise the open
 * ones from `sitesOf`. This is what the server checks; an empty list means they can't sign in anywhere.
 */
export const accessOf = (p: Sited & Pick<Person, 'role' | 'leftAt'>): string[] =>
  p.leftAt ? [] : p.role === 'headoffice' ? [...OPEN_SITE_CODES] : sitesOf(p).filter(isOpenSite);

/** Has more than one site, so gets a site picker (and managers get the "My sites" overview). */
export const hasSeveralSites = (p: Sited & Pick<Person, 'role' | 'leftAt'>) => accessOf(p).length > 1;

export const worksAt = (p: Sited, siteCode: string) => sitesOf(p).includes(siteCode);

/**
 * The sites to save for someone, from the ones ticked and the one chosen as main. There's always at
 * least one: unticking the last site keeps it, and a main site that's been unticked moves to the first one left.
 */
export function siteChoice(ticked: string[], main: string): Pick<Person, 'siteCode' | 'otherSites' | 'allSites'> {
  const list = ticked.filter((c, i) => ticked.indexOf(c) === i);
  if (!list.length) return { siteCode: main, otherSites: [], allSites: false };
  const home = list.includes(main) ? main : list[0]!;
  return { siteCode: home, otherSites: list.filter((c) => c !== home), allSites: false };
}

/** The active person at a site with this name, if any (names are unique per site). */
export const findPerson = (people: Person[], siteCode: string, name: string) =>
  people.find((p) => worksAt(p, siteCode) && isActive(p) && sameName(p.name, name));

/** Has left, so can't sign in at this site. */
export const hasLeft = (people: Person[], siteCode: string, name: string) =>
  !findPerson(people, siteCode, name) && people.some((p) => worksAt(p, siteCode) && !isActive(p) && sameName(p.name, name));
