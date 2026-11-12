import { describe, expect, it } from 'vitest';
import type { EmailMessage, Person } from '@maginhawa/core';
import { createAuthenticate, type StaffDirectory } from '../src/access';
import {
  CODE_MINUTES, CODE_TRIES, createSessionAuthenticate, createSignInHandlers, identifyFromSession, kvCounters, MemoryCounters,
  SESSION_COOKIE, SESSION_DAYS, SESSION_MAX_DAYS, type SignInEvent,
} from '../src/sign-in';
import { createApi, routeOf, sameOrigin } from '../src/api';
import { jobFor, runJob } from '../src/jobs';
import { kvVersionIndex, MemoryVersionIndex, type KVLike } from '../src/version-index';

const SECRET = 'test-secret-0123456789-0123456789-abcdef';
const DAY = 86_400_000;
const T0 = Date.parse('2026-11-12T09:00:00Z');

const person = (p: Partial<Person> = {}): Person => ({
  id: 'p1', name: 'Jo', role: 'manager', siteCode: 'BUN', email: 'jo@gmail.com', addedAt: '2026-10-01T09:00:00Z', addedBy: 'Ana', leftAt: null, ...p,
});

function setup(rows: Person[] = [person()]) {
  let t = T0;
  const sent: EmailMessage[] = [];
  const events: SignInEvent[] = [];
  const directory: StaffDirectory & { rows: Person[] } = {
    rows,
    async byEmail(email) { return this.rows.find((p) => p.email?.toLowerCase() === email.toLowerCase()) ?? null; },
  };
  const clock = { now: () => t, advance: (ms: number) => { t += ms; } };
  let code = '123456';
  const h = createSignInHandlers({
    secret: SECRET, directory, counters: new MemoryCounters(clock.now), now: clock.now,
    sendEmail: async (m) => { sent.push(m); }, newCode: () => code, log: (e) => { events.push(e); },
  });
  return { h, sent, events, directory, clock, setCode: (c: string) => { code = c; } };
}

const post = (path: string, body: unknown, cookie?: string, headers: Record<string, string> = {}) =>
  new Request(`https://app.example/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: JSON.stringify(body) });
const get = (path: string, cookie?: string) => new Request(`https://app.example/api/${path}`, { headers: cookie ? { Cookie: cookie } : {} });

/** The cookie a response sets, as the browser would send it back. */
const cookieFrom = (res: Response) => (res.headers.get('Set-Cookie') ?? '').split(';')[0]!;

async function signIn(s: ReturnType<typeof setup>, email = 'jo@gmail.com', code = '123456') {
  const { challenge } = await (await s.h.start(post('auth/start', { email }))).json();
  return s.h.verify(post('auth/verify', { challenge, code }));
}

describe('asking for a code', () => {
  it('emails a 6-digit code to someone on the Staff list, from any provider', async () => {
    const s = setup();
    const res = await s.h.start(post('auth/start', { email: '  JO@Gmail.com ' }));
    expect(res.status).toBe(200);
    expect(s.sent).toHaveLength(1);
    expect(s.sent[0]!.to).toEqual(['jo@gmail.com']);
    expect(s.sent[0]!.subject).toBe('123456 is your Maginhawa sign-in code');
    expect(s.sent[0]!.text).toContain(`within ${CODE_MINUTES} minutes`);
  });

  it("answers the same for an email that isn't on the team, but sends nothing", async () => {
    const s = setup();
    const res = await s.h.start(post('auth/start', { email: 'stranger@gmail.com' }));
    expect(res.status).toBe(200);
    expect(Object.keys(await res.json()).sort()).toEqual(['challenge', 'minutes']);
    expect(s.sent).toHaveLength(0);
    expect(s.events.at(-1)?.action).toBe('code-not-sent');
  });

  it('sends nothing to leavers', async () => {
    const s = setup([person({ leftAt: '2026-11-01T00:00:00Z' })]);
    await s.h.start(post('auth/start', { email: 'jo@gmail.com' }));
    expect(s.sent).toHaveLength(0);
  });

  it('turns away a blank or broken email', async () => {
    expect((await setup().h.start(post('auth/start', { email: 'jo' }))).status).toBe(400);
  });

  it('stops after 3 codes in 15 minutes for one email', async () => {
    const s = setup();
    for (let i = 0; i < 3; i++) expect((await s.h.start(post('auth/start', { email: 'jo@gmail.com' }))).status).toBe(200);
    expect((await s.h.start(post('auth/start', { email: 'jo@gmail.com' }))).status).toBe(429);
    s.clock.advance(15 * 60_000 + 1);
    expect((await s.h.start(post('auth/start', { email: 'jo@gmail.com' }))).status).toBe(200);
  });

  it('stops after 20 codes in an hour from one network address', async () => {
    const s = setup();
    const from = { 'CF-Connecting-IP': '203.0.113.9' };
    for (let i = 0; i < 20; i++) await s.h.start(post('auth/start', { email: `x${i}@gmail.com` }, undefined, from));
    expect((await s.h.start(post('auth/start', { email: 'jo@gmail.com' }, undefined, from))).status).toBe(429);
  });
});

describe('typing the code', () => {
  it('signs in with the right code and sets a secure 30-day cookie', async () => {
    const s = setup();
    const res = await signIn(s);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.me).toMatchObject({ kind: 'user', name: 'Jo', role: 'manager', siteCodes: ['BUN'] });
    expect(body.firstTime).toBe(true);
    const c = res.headers.get('Set-Cookie')!;
    expect(c).toContain(`${SESSION_COOKIE}=`);
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/Secure/);
    expect(c).toMatch(/SameSite=Lax/);
    expect(c).toContain(`Max-Age=${SESSION_DAYS * 86_400}`);
  });

  it('refuses a wrong code, then locks after 5 wrong tries even if the 6th is right', async () => {
    const s = setup();
    const { challenge } = await (await s.h.start(post('auth/start', { email: 'jo@gmail.com' }))).json();
    for (let i = 0; i < CODE_TRIES; i++) expect((await s.h.verify(post('auth/verify', { challenge, code: '000000' }))).status).toBe(400);
    const res = await s.h.verify(post('auth/verify', { challenge, code: '123456' }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('locked');
  });

  it('refuses a code after 10 minutes', async () => {
    const s = setup();
    const { challenge } = await (await s.h.start(post('auth/start', { email: 'jo@gmail.com' }))).json();
    s.clock.advance(CODE_MINUTES * 60_000 + 1);
    expect((await (await s.h.verify(post('auth/verify', { challenge, code: '123456' }))).json()).code).toBe('expired');
  });

  it('a code works once', async () => {
    const s = setup();
    const { challenge } = await (await s.h.start(post('auth/start', { email: 'jo@gmail.com' }))).json();
    expect((await s.h.verify(post('auth/verify', { challenge, code: '123456' }))).status).toBe(200);
    expect((await (await s.h.verify(post('auth/verify', { challenge, code: '123456' }))).json()).code).toBe('used');
  });

  it("can't be forged: a changed email in the challenge breaks the signature", async () => {
    const s = setup([person(), person({ id: 'p2', name: 'Boss', role: 'headoffice', email: 'boss@mgnhw.com' })]);
    const { challenge } = await (await s.h.start(post('auth/start', { email: 'jo@gmail.com' }))).json();
    const [b, sig] = challenge.split('.');
    const payload = JSON.parse(atob(b.replace(/-/g, '+').replace(/_/g, '/')));
    const forged = `${btoa(JSON.stringify({ ...payload, e: 'boss@mgnhw.com' })).replace(/=+$/, '')}.${sig}`;
    expect((await s.h.verify(post('auth/verify', { challenge: forged, code: '123456' }))).status).toBe(400);
  });

  it("a stranger's code never signs in, even when guessed", async () => {
    const s = setup();
    const { challenge } = await (await s.h.start(post('auth/start', { email: 'stranger@gmail.com' }))).json();
    expect((await s.h.verify(post('auth/verify', { challenge, code: '123456' }))).status).toBe(403);
  });
});

describe('staying signed in', () => {
  it('/api/me says who is signed in, and renews the cookie after a day, up to 90 days', async () => {
    const s = setup();
    const cookie = cookieFrom(await signIn(s));
    const now = await s.h.me(get('me', cookie));
    expect((await now.json()).me.name).toBe('Jo');
    expect(now.headers.get('Set-Cookie')).toBeNull();

    s.clock.advance(2 * DAY);
    const renewed = await s.h.me(get('me', cookie));
    expect(renewed.headers.get('Set-Cookie')).toContain(`Max-Age=${SESSION_DAYS * 86_400}`);

    // Keep visiting every 20 days: still signed in at day 80, signed out after day 90.
    let c = cookieFrom(renewed);
    for (let d = 0; d < 4; d++) {
      s.clock.advance(20 * DAY);
      const r = await s.h.me(get('me', c));
      if (r.status !== 200) break;
      c = cookieFrom(r) || c;
    }
    s.clock.advance(12 * DAY);
    expect((await s.h.me(get('me', c))).status).toBe(401);
    expect(SESSION_MAX_DAYS).toBe(90);
  });

  it('signs out leavers on their next visit', async () => {
    const s = setup();
    const cookie = cookieFrom(await signIn(s));
    s.directory.rows[0] = person({ leftAt: '2026-11-13T00:00:00Z' });
    expect((await s.h.me(get('me', cookie))).status).toBe(401);
  });

  it('"sign out everywhere" ends sessions that started before it', async () => {
    const s = setup();
    const cookie = cookieFrom(await signIn(s));
    s.clock.advance(60_000);
    s.directory.rows[0] = person({ sessionsValidAfter: new Date(s.clock.now()).toISOString() });
    expect((await s.h.me(get('me', cookie))).status).toBe(401);
  });

  it('sign out clears the cookie', async () => {
    const s = setup();
    const out = await s.h.signOut(post('auth/sign-out', {}, cookieFrom(await signIn(s))));
    expect(out.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('ignores a tampered cookie', async () => {
    const s = setup();
    const cookie = cookieFrom(await signIn(s));
    expect((await s.h.me(get('me', cookie.slice(0, -2) + 'xx'))).status).toBe(401);
  });
});

describe('every request: who is calling', () => {
  it('a session becomes a caller with the sites on their Staff row', async () => {
    const s = setup([person({ otherSites: ['GUA'] })]);
    const cookie = cookieFrom(await signIn(s));
    const people = createAuthenticate({ identify: identifyFromSession(SECRET, s.clock.now), directory: s.directory, cache: new MemoryVersionIndex(), now: s.clock.now });
    const auth = createSessionAuthenticate({ secret: SECRET, people, directory: s.directory, now: s.clock.now });
    expect(await auth(get('eod-draft', cookie))).toEqual({ name: 'Jo', role: 'manager', siteCodes: ['BUN', 'GUA'] });
    expect(await auth(get('eod-draft'))).toBeNull();
  });
});

describe('kitchen iPad', () => {
  it('a manager turns the iPad into their site\'s kitchen iPad; it then acts as staff there only', async () => {
    const s = setup();
    const manager = cookieFrom(await signIn(s));
    const res = await s.h.device(post('auth/device', { siteCode: 'BUN' }, manager));
    expect(res.status).toBe(200);
    const ipad = cookieFrom(res);
    expect(res.headers.get('Set-Cookie')).toContain(`Max-Age=${90 * 86_400}`);
    const people = createAuthenticate({ identify: identifyFromSession(SECRET, s.clock.now), directory: s.directory, now: s.clock.now });
    const auth = createSessionAuthenticate({ secret: SECRET, people, directory: s.directory, now: s.clock.now });
    expect(await auth(get('checklist-sync', ipad))).toEqual({ name: 'Kitchen iPad · BUN', role: 'staff', siteCodes: ['BUN'] });
    expect((await (await s.h.me(get('me', ipad))).json()).me.kind).toBe('device');
  });

  it("can't be set up for another restaurant, or by staff", async () => {
    const s = setup([person(), person({ id: 'p2', name: 'Sam', role: 'staff', email: 'sam@icloud.com' })]);
    expect((await s.h.device(post('auth/device', { siteCode: 'GUA' }, cookieFrom(await signIn(s))))).status).toBe(403);
    expect((await s.h.device(post('auth/device', { siteCode: 'BUN' }, cookieFrom(await signIn(s, 'sam@icloud.com'))))).status).toBe(403);
  });

  it('stops working when the manager who set it up leaves', async () => {
    const s = setup();
    const ipad = cookieFrom(await s.h.device(post('auth/device', { siteCode: 'BUN' }, cookieFrom(await signIn(s)))));
    s.directory.rows[0] = person({ leftAt: '2026-11-13T00:00:00Z' });
    expect((await s.h.me(get('me', ipad))).status).toBe(401);
  });
});

describe('the /api router', () => {
  it('knows its routes', () => {
    expect(routeOf(new URL('https://a/api/auth/start'))).toBe('auth/start');
    expect(routeOf(new URL('https://a/api/eod-draft?site=BUN'))).toBe('eod-draft');
    expect(routeOf(new URL('https://a/api/nope'))).toBeNull();
    expect(routeOf(new URL('https://a/eod-draft'))).toBeNull();
  });

  it('refuses changes sent from another site', () => {
    expect(sameOrigin(post('eod-draft', {}, undefined, { Origin: 'https://evil.example' }))).toBe(false);
    expect(sameOrigin(post('eod-draft', {}, undefined, { Origin: 'https://app.example' }))).toBe(true);
    expect(sameOrigin(get('eod-draft'))).toBe(true);
  });

  it('answers 503 for sign-in until the settings are filled in', async () => {
    const res = await createApi({})(post('auth/start', { email: 'jo@gmail.com' }));
    expect(res.status).toBe(503);
    expect((await res.json()).missing).toEqual(expect.arrayContaining(['SESSION_SECRET', 'MAIL_FROM']));
  });

  it('practice mode: any email signs in with the code printed in the terminal, then the data routes know them', async () => {
    const env = { DEV_SHARED_STORE: '1' };
    const api = createApi(env);
    const logged: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => { logged.push(a.join(' ')); };
    try {
      const { challenge } = await (await api(post('auth/start', { email: 'ana.cruz@gmail.com' }))).json();
      const code = logged.join('\n').match(/(\d{6}) is your Maginhawa sign-in code/)?.[1];
      expect(code).toBeTruthy();
      const res = await api(post('auth/verify', { challenge, code }));
      expect(res.status).toBe(200);
      expect(res.headers.get('Set-Cookie')).not.toMatch(/Secure/);
      expect((await res.json()).me).toMatchObject({ name: 'Ana Cruz', role: 'headoffice' });
      const draft = await api(get('eod-draft?site=BUN&date=2026-11-12', cookieFrom(res)));
      expect(draft.status).not.toBe(401);
    } finally {
      console.log = orig;
    }
  });
});

describe('Workers KV', () => {
  function fakeKV(): KVLike & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return { data, async get(k) { return data.get(k) ?? null; }, async put(k, v) { data.set(k, v); } };
  }

  it('keeps the version index as JSON', async () => {
    const kv = fakeKV();
    const index = kvVersionIndex(kv);
    await index.set('eod|BUN|2026-11-12', { value: 'v3', at: 5 });
    expect(await index.get('eod|BUN|2026-11-12')).toEqual({ value: 'v3', at: 5 });
    expect(await index.get('missing')).toBeNull();
  });

  it('counts within a window, then starts again', async () => {
    let t = T0;
    const c = kvCounters(fakeKV(), () => t);
    expect(await c.bump('k', 60)).toBe(1);
    expect(await c.bump('k', 60)).toBe(2);
    t += 61_000;
    expect(await c.peek('k')).toBe(0);
    expect(await c.bump('k', 60)).toBe(1);
  });
});

describe('timed jobs Worker', () => {
  it('maps each cron to its job', () => {
    expect(jobFor('15 5 * * *')).toBe('snapshot');
    expect(jobFor('30 5 * * *')).toBe('forecast');
    expect(jobFor('*/15 * * * *')).toBe('emailRetry');
    expect(jobFor('0 0 * * *')).toBeNull();
  });

  it('does nothing until SharePoint is connected, and says so', async () => {
    const lines: string[] = [];
    for (const j of ['snapshot', 'forecast', 'emailRetry'] as const) await runJob(j, {}, (l) => lines.push(l));
    expect(lines.every((l) => /not connected yet/.test(l))).toBe(true);
  });
});
