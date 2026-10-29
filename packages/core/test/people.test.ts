import { describe, expect, it } from 'vitest';
import { canEdit, findPerson, hasLeft, personProblem, rolesGivenBy, siteChoice, sitesOf, usesPin, worksAt, type Person } from '../src/people';

const person = (p: Partial<Person>): Person => ({
  id: p.name ?? 'x', name: 'Sam', role: 'staff', siteCode: 'BUN', email: null, addedAt: '2026-10-01T09:00:00Z', addedBy: 'Jo', leftAt: null, ...p,
});
const team = [person({ name: 'Sam' }), person({ name: 'Chris', leftAt: '2026-10-12T10:00:00Z' }), person({ name: 'Mia', siteCode: 'BEL' })];

describe('adding a person', () => {
  it('needs a name', () => {
    expect(personProblem({ name: '  ', role: 'staff', email: null, siteCode: 'BUN' }, team, 'manager')).toBe('Type their name.');
  });
  it('turns down a second person with the same name at the same site', () => {
    expect(personProblem({ name: 'sam ', role: 'staff', email: null, siteCode: 'BUN' }, team, 'manager'))
      .toBe("There's already a sam here. Add a surname or initial.");
  });
  it('lets the name be reused at another site, or once the other person has left', () => {
    expect(personProblem({ name: 'Mia', role: 'staff', email: null, siteCode: 'BUN' }, team, 'manager')).toBeNull();
    expect(personProblem({ name: 'Chris', role: 'staff', email: null, siteCode: 'BUN' }, team, 'manager')).toBeNull();
  });
  it('lets someone keep their own name when edited', () => {
    expect(personProblem({ name: 'Sam', role: 'supervisor', email: null, siteCode: 'BUN' }, team, 'manager', 'Sam')).toBeNull();
  });
  it('needs a work email for managers, who sign in with Microsoft', () => {
    expect(personProblem({ name: 'Alex', role: 'manager', email: 'alex', siteCode: 'BUN' }, team, 'manager')).toBe('Add their work email so they can sign in.');
    expect(personProblem({ name: 'Alex', role: 'manager', email: 'alex@example.com', siteCode: 'BUN' }, team, 'manager')).toBeNull();
  });
  it('only lets head office give head-office access', () => {
    expect(personProblem({ name: 'Kim', role: 'headoffice', email: 'kim@example.com', siteCode: 'BUN' }, team, 'manager')).toBe('Only head office can give head-office access.');
    expect(personProblem({ name: 'Kim', role: 'headoffice', email: 'kim@example.com', siteCode: 'BUN' }, team, 'headoffice')).toBeNull();
    expect(rolesGivenBy('manager')).not.toContain('headoffice');
  });
  it('is for managers and head office only', () => {
    expect(personProblem({ name: 'Kim', role: 'staff', email: null, siteCode: 'BUN' }, team, 'supervisor')).toBe('Only managers and head office can add people.');
  });
});

describe('roles and signing in', () => {
  it('gives staff and supervisors a PIN, and everyone else a work account', () => {
    expect(['staff', 'supervisor', 'manager', 'headoffice'].map((r) => usesPin(r as Person['role']))).toEqual([true, true, false, false]);
  });
  it("doesn't let a manager change a head-office person", () => {
    expect(canEdit('manager', { role: 'headoffice' })).toBe(false);
    expect(canEdit('manager', { role: 'supervisor' })).toBe(true);
    expect(canEdit('headoffice', { role: 'headoffice' })).toBe(true);
  });
  it('knows who has left', () => {
    expect(findPerson(team, 'BUN', 'chris')).toBeUndefined();
    expect(hasLeft(team, 'BUN', 'Chris')).toBe(true);
    expect(hasLeft(team, 'BUN', 'Sam')).toBe(false);
  });
});

describe('working at more than one site', () => {
  const jo = person({ name: 'Jo', role: 'manager', siteCode: 'BUN', otherSites: ['GUA', 'BUN'] });
  it('lists the main site first, once', () => {
    expect(sitesOf(jo)).toEqual(['BUN', 'GUA']);
    expect(sitesOf(person({ name: 'Sam' }))).toEqual(['BUN']);
  });
  it('finds them at every site they work at', () => {
    expect(worksAt(jo, 'GUA')).toBe(true);
    expect(findPerson([jo], 'GUA', 'jo')?.name).toBe('Jo');
    expect(findPerson([jo], 'BEL', 'Jo')).toBeUndefined();
  });
  it('keeps a main site that is still ticked, and moves it when unticked', () => {
    expect(siteChoice(['GUA', 'BUN'], 'BUN')).toEqual({ siteCode: 'BUN', otherSites: ['GUA'] });
    expect(siteChoice(['GUA', 'BEL'], 'BUN')).toEqual({ siteCode: 'GUA', otherSites: ['BEL'] });
  });
  it('never leaves someone with no site', () => {
    expect(siteChoice([], 'BUN')).toEqual({ siteCode: 'BUN', otherSites: [] });
  });
});
