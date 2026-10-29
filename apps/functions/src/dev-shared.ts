/**
 * Shared test mode: lets a laptop and a phone on the same Wi-Fi sync through one local
 * server before Entra ID and SharePoint are connected. Everything is kept in memory on
 * the laptop and lost when the server stops.
 *
 * It trusts a header for who is calling, so it must never run in a deployed site:
 * it only switches on with DEV_SHARED_STORE=1, and refuses whenever anything says production
 * or a deployed Netlify Function.
 */
import { DEFAULT_SETTINGS, DEV_USER_HEADER, findSite, MemoryChecklistStore, MemoryPresence, MemoryStore, SITES, type ChecklistBackend, type EmailMessage, type EodStore, type PresenceRemote, type SiteSettings } from '@maginhawa/core';
import type { Caller } from './handler';
import { MemoryVersionIndex, type VersionIndex } from './version-index';

type Env = Record<string, string | undefined>;

/** Why shared test mode is off, or null when it may run. */
export function sharedDevRefusal(env: Env = process.env): string | null {
  if (env.DEV_SHARED_STORE !== '1') return 'DEV_SHARED_STORE is not set to 1.';
  if (env.NODE_ENV === 'production') return 'Refused: NODE_ENV is production.';
  if (env.CONTEXT === 'production') return 'Refused: this is a production deploy.';
  // A deployed Netlify Function runs on AWS Lambda; `netlify dev` and Vite do not.
  if (env.AWS_LAMBDA_FUNCTION_NAME || env.LAMBDA_TASK_ROOT) return 'Refused: running as a deployed function.';
  return null;
}

const ROLES = new Set<NonNullable<Caller['role']>>(['staff', 'supervisor', 'manager', 'headoffice']);

/** Reads the demo sign-in from the header. Head office may open every site. */
export async function devAuthenticate(req: Request): Promise<Caller | null> {
  const raw = req.headers.get(DEV_USER_HEADER);
  if (!raw) return null;
  try {
    const u = JSON.parse(decodeURIComponent(raw)) as { name?: unknown; role?: unknown; siteCodes?: unknown };
    const name = typeof u.name === 'string' ? u.name.trim() : '';
    const role = u.role as Caller['role'];
    if (!name || !role || !ROLES.has(role)) return null;
    const siteCodes = role === 'headoffice'
      ? SITES.map((s) => s.code as string)
      : Array.isArray(u.siteCodes) ? u.siteCodes.filter((c): c is string => typeof c === 'string') : [];
    return { name, role, siteCodes };
  } catch {
    return null;
  }
}

export interface SharedDev {
  authenticate: (req: Request) => Promise<Caller | null>;
  eod: EodStore;
  checklists: ChecklistBackend;
  presence: PresenceRemote;
  index: VersionIndex;
}

export function createSharedDev(clock: () => Date = () => new Date()): SharedDev {
  return {
    authenticate: devAuthenticate,
    eod: new MemoryStore(),
    checklists: new MemoryChecklistStore(clock),
    presence: new MemoryPresence(),
    index: new MemoryVersionIndex(),
  };
}

// Kept on globalThis so every function sees the same stores, even when each is bundled separately (netlify dev).
const KEY = Symbol.for('maginhawa.sharedDev');
let warned = false;

/** The shared in-memory stores, or null when shared test mode is off or refused. */
export function sharedDev(env: Env = process.env): SharedDev | null {
  const refused = sharedDevRefusal(env);
  if (refused) {
    if (env.DEV_SHARED_STORE === '1' && !warned) { warned = true; console.warn(`[shared test mode] ${refused}`); }
    return null;
  }
  const g = globalThis as { [KEY]?: SharedDev };
  return (g[KEY] ??= createSharedDev());
}

/** The same settings the web app uses in demo mode. */
export async function devSettingsFor(siteCode: string): Promise<SiteSettings | null> {
  const site = findSite(siteCode);
  return site ? { ...DEFAULT_SETTINGS, siteCode, siteName: site.name } : null;
}

/** Shared test mode has no mailbox: the summary goes to the server log instead. */
export async function devSendEmail(msg: EmailMessage) {
  console.log(`[shared test mode] Email not sent: ${msg.subject}`);
}
