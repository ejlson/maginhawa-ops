import { describe, expect, it } from 'vitest';
import { OPEN_SITE_CODES, type Person } from '@maginhawa/core';
import { ACCESS_TRUST_MS, callerFor, createAuthenticate, type StaffDirectory } from '../src/access';
import { MemoryVersionIndex } from '../src/version-index';

const person = (p: Partial<Person>): Person => ({
  id: 'x', name: 'Jo', role: 'manager', siteCode: 'BUN', email: 'jo@example.com', addedAt: '2026-10-01T09:00:00Z', addedBy: 'Ana', leftAt: null, ...p,
});

const req = (email: string | null) => new Request('https://x/eod-draft', { headers: email ? { 'x-test-email': email } : {} });
const identify = async (r: Request) => { const email = r.headers.get('x-test-email'); return email ? { email } : null; };

function directory(rows: Person[]) {
  const d = { reads: 0, rows, async byEmail(email: string) { d.reads++; return d.rows.find((p) => p.email?.toLowerCase() === email.toLowerCase()) ?? null; } };
  return d satisfies StaffDirectory;
}

describe('which sites a caller may open', () => {
  it('head office gets every open site, never Ramo', () => {
    expect(callerFor(person({ role: 'headoffice' }))?.siteCodes).toEqual([...OPEN_SITE_CODES]);
    expect(callerFor(person({ role: 'headoffice' }))?.siteCodes).not.toContain('RAM');
  });
  it('"all sites" gets every open site; others get only their ticked ones', () => {
    expect(callerFor(person({ allSites: true }))?.siteCodes).toHaveLength(8);
    expect(callerFor(person({ otherSites: ['GUA'] }))?.siteCodes).toEqual(['BUN', 'GUA']);
    expect(callerFor(person({ role: 'staff', otherSites: ['BEL'] }))).toEqual({ name: 'Jo', role: 'staff', siteCodes: ['BUN', 'BEL'] });
  });
  it('turns away leavers and anyone left only with a closed site', () => {
    expect(callerFor(person({ leftAt: '2026-10-20T00:00:00Z' }))).toBeNull();
    expect(callerFor(person({ siteCode: 'RAM' }))).toBeNull();
  });
});

describe('authenticate', () => {
  it('reads the Staff list once, then answers from the cache', async () => {
    const dir = directory([person({ otherSites: ['GUA'] })]);
    let t = 1_000_000;
    const auth = createAuthenticate({ identify, directory: dir, cache: new MemoryVersionIndex(), now: () => t });
    expect((await auth(req('JO@example.com')))?.siteCodes).toEqual(['BUN', 'GUA']);
    expect((await auth(req('jo@example.com')))?.siteCodes).toEqual(['BUN', 'GUA']);
    expect(dir.reads).toBe(1);
    // Head office takes Guanabana away: it applies once the cached answer is old.
    dir.rows = [person({})];
    t += ACCESS_TRUST_MS + 1;
    expect((await auth(req('jo@example.com')))?.siteCodes).toEqual(['BUN']);
    expect(dir.reads).toBe(2);
  });
  it('says not signed in without a token, or for someone not on the list', async () => {
    const auth = createAuthenticate({ identify, directory: directory([]) });
    expect(await auth(req(null))).toBeNull();
    expect(await auth(req('nobody@example.com'))).toBeNull();
  });
  it("doesn't sign people out when SharePoint is down", async () => {
    const auth = createAuthenticate({ identify, directory: { byEmail: async () => { throw new Error('Graph 503'); } } });
    await expect(auth(req('jo@example.com'))).rejects.toThrow('Graph 503');
  });
});
