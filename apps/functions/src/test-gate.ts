/**
 * The password in front of the test site (Cloudflare Pages, apps/eod-web/functions/_middleware.ts).
 * The browser's own username and password box comes up before any page, file or /api route loads.
 *
 * It is on unless TEST_GATE=off, and it fails closed: with no password set, nothing loads.
 * One shared password, so it says nothing about who opened the site; the app's own email-code
 * sign-in replaces it before real use. Settings (Cloudflare secrets, Preview environment):
 *   TEST_GATE_USER      the username testers type
 *   TEST_GATE_PASSWORD  at least 16 characters
 */
import type { Env } from './not-connected';

export const MIN_PASSWORD = 16;
const REALM = 'Maginhawa test site';

const plain = (status: number, text: string, headers: Record<string, string> = {}) =>
  new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', ...headers } });

/** Compares without leaking where the first difference is. */
function same(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

function credentials(req: Request): { user: string; password: string } | null {
  const h = req.headers.get('Authorization') ?? '';
  if (!h.startsWith('Basic ')) return null;
  try {
    const raw = new TextDecoder().decode(Uint8Array.from(atob(h.slice(6).trim()), (c) => c.charCodeAt(0)));
    const i = raw.indexOf(':');
    return i < 0 ? null : { user: raw.slice(0, i), password: raw.slice(i + 1) };
  } catch {
    return null;
  }
}

/** Null = let the request through; otherwise the answer to send instead. */
export function testGate(req: Request, env: Env): Response | null {
  if (env.TEST_GATE === 'off') return null;
  const user = env.TEST_GATE_USER ?? '';
  const password = env.TEST_GATE_PASSWORD ?? '';
  if (!user || password.length < MIN_PASSWORD) {
    return plain(503, 'This test site is locked until its password is set (TEST_GATE_USER and TEST_GATE_PASSWORD, at least 16 characters).');
  }
  const given = credentials(req);
  if (given && same(given.user, user) && same(given.password, password)) return null;
  return plain(401, 'This is a private test site. Ask the person who sent you the link for the username and password.', {
    'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
  });
}

/** Every answer from the test site also asks search engines to stay away. */
export function markPrivate(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return out;
}
