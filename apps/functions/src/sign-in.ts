/**
 * Email code sign-in. Anyone whose email is on an active Staff row can sign in with a 6-digit
 * code sent to that email. The email can be from any provider; typing the code proves it is theirs.
 *
 *   POST /api/auth/start   { email }             → a challenge (the code goes by email)
 *   POST /api/auth/verify  { challenge, code }   → session cookie
 *   POST /api/auth/sign-out                      → clears the cookie
 *   POST /api/auth/device  { siteCode }          → turns this device into a site's kitchen iPad
 *   GET  /api/me                                 → who is signed in (and refreshes the cookie)
 *
 * Nothing about a code is stored on the server: the challenge is signed with SESSION_SECRET and
 * holds the email, expiry and a hash of the code, so it works whichever Cloudflare location
 * answers. Counters (wrong tries, codes asked for) are best-effort limits on top.
 * Sessions are signed cookies too; the Staff row is re-read at least every 5 minutes (access.ts),
 * so leavers and "sign out everywhere" take effect without a session table.
 */
import { isActive, isEmail, normaliseEmail, signInCodeEmail, type EmailMessage, type Person } from '@maginhawa/core';
import { callerFor, type Identity, type StaffDirectory } from './access';
import type { Authenticate, Caller } from './handler';
import { json } from './handler';

export const CODE_MINUTES = 10;
export const CODE_TRIES = 5;
export const SESSION_DAYS = 30;
export const SESSION_MAX_DAYS = 90;
export const DEVICE_DAYS = 90;
/** Codes asked for: per email, and per network address. */
export const LIMIT_PER_EMAIL = { count: 3, seconds: 15 * 60 };
export const LIMIT_PER_ADDRESS = { count: 20, seconds: 60 * 60 };

export const SESSION_COOKIE = 'mgh_session';
const DAY = 86_400_000;

/** Best-effort counters with an expiry (KV in production, memory in tests and practice mode). */
export interface Counters {
  /** Adds one and returns the new count. The count disappears after `seconds`. */
  bump(key: string, seconds: number): Promise<number>;
  peek(key: string): Promise<number>;
}

export class MemoryCounters implements Counters {
  private m = new Map<string, { n: number; until: number }>();
  constructor(private now: () => number = Date.now) {}
  async bump(key: string, seconds: number) {
    const e = this.m.get(key);
    const live = e && e.until > this.now() ? e : { n: 0, until: this.now() + seconds * 1000 };
    live.n++;
    this.m.set(key, live);
    return live.n;
  }
  async peek(key: string) {
    const e = this.m.get(key);
    return e && e.until > this.now() ? e.n : 0;
  }
}

/** Counters in Workers KV. Not atomic, so two tries at the same moment may count once: fine for limits. */
export function kvCounters(kv: import('./version-index').KVLike, now: () => number = Date.now): Counters {
  const read = async (key: string) => {
    const raw = await kv.get(key);
    const e = raw ? (JSON.parse(raw) as { n: number; until: number }) : null;
    return e && e.until > now() ? e : null;
  };
  return {
    async bump(key, seconds) {
      const e = (await read(key)) ?? { n: 0, until: now() + seconds * 1000 };
      e.n++;
      // KV's shortest expiry is 60 seconds; `until` keeps the real window.
      await kv.put(key, JSON.stringify(e), { expirationTtl: Math.max(60, Math.ceil((e.until - now()) / 1000)) });
      return e.n;
    },
    async peek(key) { return (await read(key))?.n ?? 0; },
  };
}

/** Kitchen iPads that have been turned off (SharePoint Devices list later). */
export interface DeviceRegistry {
  isRevoked(deviceId: string): Promise<boolean>;
}

export interface SignInDeps {
  /** At least 32 random characters, kept as a Cloudflare secret. */
  secret: string;
  directory: StaffDirectory;
  sendEmail: (msg: EmailMessage) => Promise<void>;
  counters: Counters;
  devices?: DeviceRegistry;
  now?: () => number;
  /** Six digits. Tests pass their own. */
  newCode?: () => string;
  /** False only on http://localhost, where browsers won't keep a Secure cookie. */
  secureCookie?: boolean;
  /** Sign-in log (SharePoint SignInLog later). Never given the code. */
  log?: (event: SignInEvent) => void | Promise<void>;
}

export interface SignInEvent {
  at: string;
  action: 'code-sent' | 'code-not-sent' | 'signed-in' | 'wrong-code' | 'locked' | 'device-enrolled' | 'signed-out';
  email?: string;
  siteCode?: string;
  address?: string;
}

// ── signing ──────────────────────────────────────────────────────────

const enc = new TextEncoder();
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

/** Compares without leaking where the first difference is. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** `payload.signature`; `extra` is signed but not carried (the code, for challenges). */
async function seal(secret: string, payload: object, extra = ''): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(secret, `${body}|${extra}`)}`;
}

async function open<T>(secret: string, token: string | null | undefined, extra = ''): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig || !same(sig, await hmac(secret, `${body}|${extra}`))) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromB64url(body))) as T;
  } catch {
    return null;
  }
}

export const randomCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, '0');
const randomId = () => b64url(crypto.getRandomValues(new Uint8Array(12)));

// ── tokens ───────────────────────────────────────────────────────────

interface Challenge { e: string; x: number; n: string }

/** A signed-in person (k: 'user') or a kitchen iPad (k: 'device'). */
export type Session =
  | { k: 'user'; e: string; iat: number; first: number; exp: number }
  | { k: 'device'; id: string; site: string; by: string; iat: number; exp: number };

export async function readSession(secret: string, req: Request, now: number): Promise<Session | null> {
  const s = await open<Session>(secret, cookie(req, SESSION_COOKIE));
  return s && s.exp > now ? s : null;
}

export function cookie(req: Request, name: string): string | null {
  const raw = req.headers.get('Cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=') || null;
  }
  return null;
}

function setCookie(value: string, maxAgeMs: number, secure: boolean): string {
  return [`${SESSION_COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`, ...(secure ? ['Secure'] : [])].join('; ');
}

const withCookie = (res: Response, c: string) => { res.headers.append('Set-Cookie', c); return res; };

// ── who is calling ───────────────────────────────────────────────────

/** For access.ts: the email in a person's session. Kitchen iPads are handled by createSessionAuthenticate. */
export function identifyFromSession(secret: string, now: () => number = Date.now) {
  return async (req: Request): Promise<Identity | null> => {
    const s = await readSession(secret, req, now());
    return s?.k === 'user' ? { email: s.e, signedInAt: s.first } : null;
  };
}

/**
 * Who is calling, for every handler: a person (through the cached Staff check in access.ts) or a
 * kitchen iPad. An iPad acts as staff at its one site, and stops working when the manager who set
 * it up leaves or loses that site, or when it is turned off.
 */
export function createSessionAuthenticate(deps: { secret: string; people: Authenticate; directory: StaffDirectory; devices?: DeviceRegistry; now?: () => number }): Authenticate {
  const now = deps.now ?? Date.now;
  return async (req) => {
    const s = await readSession(deps.secret, req, now());
    if (!s) return null;
    if (s.k === 'user') return deps.people(req);
    if (await deps.devices?.isRevoked(s.id)) return null;
    const by = await deps.directory.byEmail(s.by);
    const manager = by ? callerFor(by) : null;
    if (!manager || !mayEnrol(manager, s.site)) return null;
    return { name: `Kitchen iPad · ${s.site}`, role: 'staff', siteCodes: [s.site] } satisfies Caller;
  };
}

const mayEnrol = (c: Caller, site: string) => (c.role === 'manager' || c.role === 'headoffice') && c.siteCodes.includes(site);

/** Still allowed to sign in: active, has a site, and the sign-in started after any "sign out everywhere". */
export function stillValid(p: Person | null, signedInAt: number): p is Person {
  if (!p || !isActive(p) || !callerFor(p)) return false;
  return !p.sessionsValidAfter || signedInAt >= Date.parse(p.sessionsValidAfter);
}

// ── the handlers ─────────────────────────────────────────────────────

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const address = (req: Request) => req.headers.get('CF-Connecting-IP') ?? 'local';
const iso = (t: number) => new Date(t).toISOString();

export function createSignInHandlers(deps: SignInDeps) {
  const now = deps.now ?? Date.now;
  const secure = deps.secureCookie ?? true;
  const log = async (e: Omit<SignInEvent, 'at'>) => { try { await deps.log?.({ at: iso(now()), ...e }); } catch { /* never block sign-in on the log */ } };

  /** Same answer whether or not the email is on the team, so the screen never says who works here. */
  async function start(req: Request): Promise<Response> {
    const raw = String((await body(req)).email ?? '');
    if (!isEmail(raw)) return json(400, { error: 'Type your email address.' });
    const email = normaliseEmail(raw);
    const from = address(req);
    const [perEmail, perAddress] = await Promise.all([
      deps.counters.bump(`code|email|${email}`, LIMIT_PER_EMAIL.seconds),
      deps.counters.bump(`code|addr|${from}`, LIMIT_PER_ADDRESS.seconds),
    ]);
    if (perEmail > LIMIT_PER_EMAIL.count || perAddress > LIMIT_PER_ADDRESS.count) {
      return json(429, { error: 'Too many codes asked for. Wait 15 minutes, then try again.' });
    }
    const code = (deps.newCode ?? randomCode)();
    const challenge = await seal(deps.secret, { e: email, x: now() + CODE_MINUTES * 60_000, n: randomId() } satisfies Challenge, code);
    const person = await deps.directory.byEmail(email);
    if (stillValid(person, now())) {
      await deps.sendEmail(signInCodeEmail(email, code, CODE_MINUTES));
      await log({ action: 'code-sent', email, address: from });
    } else {
      await log({ action: 'code-not-sent', email, address: from });
    }
    return json(200, { challenge, minutes: CODE_MINUTES });
  }

  async function verify(req: Request): Promise<Response> {
    const b = await body(req);
    const code = String(b.code ?? '').replace(/\s/g, '');
    const token = String(b.challenge ?? '');
    // Read the nonce first (unsigned) only to count tries; nothing is trusted until the signature matches.
    const peeked = peek<Challenge>(token);
    if (!peeked || !/^\d{6}$/.test(code)) return json(400, { error: 'Type the 6-digit code from the email.' });
    const tries = await deps.counters.bump(`tries|${peeked.n}`, CODE_MINUTES * 60);
    if (tries > CODE_TRIES) {
      await log({ action: 'locked', email: peeked.e, address: address(req) });
      return json(400, { error: 'Too many wrong codes. Ask for a new one.', code: 'locked' });
    }
    const c = await open<Challenge>(deps.secret, token, code);
    if (!c) {
      await log({ action: 'wrong-code', email: peeked.e, address: address(req) });
      return json(400, { error: "That code isn't right. Check the email and try again." });
    }
    if (c.x < now()) return json(400, { error: 'That code has run out. Ask for a new one.', code: 'expired' });
    if ((await deps.counters.bump(`used|${c.n}`, CODE_MINUTES * 60)) > 1) return json(400, { error: 'That code has already been used. Ask for a new one.', code: 'used' });
    const person = await deps.directory.byEmail(c.e);
    if (!stillValid(person, now())) return json(403, { error: "This email can't sign in. Ask your manager." });
    const t = now();
    const session: Session = { k: 'user', e: c.e, iat: t, first: t, exp: t + SESSION_DAYS * DAY };
    await log({ action: 'signed-in', email: c.e, address: address(req) });
    return withCookie(json(200, { me: meOf(person), firstTime: !person.emailVerifiedAt }), setCookie(await seal(deps.secret, session), SESSION_DAYS * DAY, secure));
  }

  async function signOut(req: Request): Promise<Response> {
    const s = await readSession(deps.secret, req, now());
    await log({ action: 'signed-out', email: s?.k === 'user' ? s.e : undefined, siteCode: s?.k === 'device' ? s.site : undefined });
    return withCookie(json(200, { ok: true }), setCookie('', 0, secure));
  }

  /** Who is signed in. A person's cookie is renewed for another 30 days, up to 90 days after the code. */
  async function me(req: Request): Promise<Response> {
    const t = now();
    const s = await readSession(deps.secret, req, t);
    if (!s) return json(401, { error: 'Not signed in.' });
    if (s.k === 'device') {
      const by = await deps.directory.byEmail(s.by);
      const manager = by && stillValid(by, 0) ? callerFor(by) : null;
      if (!manager || !mayEnrol(manager, s.site) || (await deps.devices?.isRevoked(s.id))) return withCookie(json(401, { error: 'This iPad has been turned off. Ask a manager to set it up again.' }), setCookie('', 0, secure));
      return json(200, { me: { kind: 'device', siteCode: s.site, name: `Kitchen iPad · ${s.site}` } });
    }
    const person = await deps.directory.byEmail(s.e);
    if (!stillValid(person, s.first)) return withCookie(json(401, { error: 'Sign in again.' }), setCookie('', 0, secure));
    const res = json(200, { me: meOf(person) });
    if (t - s.iat > DAY) {
      const exp = Math.min(t + SESSION_DAYS * DAY, s.first + SESSION_MAX_DAYS * DAY);
      withCookie(res, setCookie(await seal(deps.secret, { ...s, iat: t, exp }), exp - t, secure));
    }
    return res;
  }

  /** A manager (or head office) turns the iPad they are signed in on into a site's kitchen iPad. */
  async function device(req: Request): Promise<Response> {
    const t = now();
    const s = await readSession(deps.secret, req, t);
    if (s?.k !== 'user') return json(401, { error: 'Sign in as a manager first.' });
    const person = await deps.directory.byEmail(s.e);
    const caller = stillValid(person, s.first) ? callerFor(person) : null;
    const site = String((await body(req)).siteCode ?? '');
    if (!caller || !mayEnrol(caller, site)) return json(403, { error: 'Only a manager of this restaurant can set up its kitchen iPad.' });
    const session: Session = { k: 'device', id: randomId(), site, by: s.e, iat: t, exp: t + DEVICE_DAYS * DAY };
    await log({ action: 'device-enrolled', email: s.e, siteCode: site });
    return withCookie(json(200, { me: { kind: 'device', siteCode: site, name: `Kitchen iPad · ${site}` }, deviceId: session.id }), setCookie(await seal(deps.secret, session), DEVICE_DAYS * DAY, secure));
  }

  return { start, verify, signOut, me, device };
}

/** What the app needs about the person signed in. */
function meOf(p: Person) {
  const c = callerFor(p)!;
  return { kind: 'user' as const, name: p.name, email: p.email, role: c.role, siteCode: p.siteCode, siteCodes: c.siteCodes };
}

/** Reads a token's payload without checking it. Only for counting tries before the real check. */
function peek<T>(token: string): T | null {
  const [b] = token.split('.');
  if (!b) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromB64url(b))) as T;
  } catch {
    return null;
  }
}
