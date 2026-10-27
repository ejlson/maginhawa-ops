/**
 * The people who work at each site: who they are, their role, and how they sign in.
 * Managers look after their own site's people; only head office can give head-office access.
 * Someone who leaves is marked as left, never deleted, so their past records keep their name.
 */

export type PersonRole = 'staff' | 'supervisor' | 'manager' | 'headoffice';

export interface Person {
  id: string;
  name: string;
  role: PersonRole;
  siteCode: string;
  /** Managers and head office sign in with their Microsoft work account. */
  email: string | null;
  addedAt: string;
  addedBy: string;
  /** When they left. They can't sign in after this. */
  leftAt: string | null;
}

/** Staff and supervisors use a PIN on the shared iPad; managers and head office use their work account. */
export const usesPin = (r: PersonRole) => r === 'staff' || r === 'supervisor';

export const canManagePeople = (r: PersonRole) => r === 'manager' || r === 'headoffice';

/** Roles someone can give. Head-office access can only come from head office. */
export const rolesGivenBy = (by: PersonRole): PersonRole[] =>
  by === 'headoffice' ? ['staff', 'supervisor', 'manager', 'headoffice'] : by === 'manager' ? ['staff', 'supervisor', 'manager'] : [];

/** A manager can't change a head-office person; head office can change anyone. */
export const canEdit = (by: PersonRole, person: Pick<Person, 'role'>) =>
  canManagePeople(by) && (by === 'headoffice' || person.role !== 'headoffice');

export const isActive = (p: Pick<Person, 'leftAt'>) => !p.leftAt;

export const isWorkEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());

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
  if (!usesPin(p.role) && !isWorkEmail(p.email ?? '')) return 'Add their work email so they can sign in.';
  return null;
}

/** The active person at a site with this name, if any (names are unique per site). */
export const findPerson = (people: Person[], siteCode: string, name: string) =>
  people.find((p) => p.siteCode === siteCode && isActive(p) && sameName(p.name, name));

/** Has left, so can't sign in at this site. */
export const hasLeft = (people: Person[], siteCode: string, name: string) =>
  !findPerson(people, siteCode, name) && people.some((p) => p.siteCode === siteCode && !isActive(p) && sameName(p.name, name));
