/**
 * Every /api/* route, in one place. Cloudflare Pages calls this from
 * apps/eod-web/functions/api/[[path]].ts; the local test server (npm run dev:shared) calls it too.
 *
 *   /api/auth/start · /api/auth/verify · /api/auth/sign-out · /api/auth/device · /api/me   sign-in.ts
 *   /api/eod-draft · /api/submit-eod · /api/checklist-sync · /api/presence                 the app's data
 *   /api/site-flow · /api/report-definition                                                head office
 *
 * Until the server settings are filled in, data routes answer 503 and the app keeps work on the
 * device (not-connected.ts). Connection points are marked: each needs the SharePoint (Graph) store.
 */
import { createAuthenticate, type StaffDirectory } from './access';
import { createSubmitHandler, json, type Authenticate } from './handler';
import { createDefinitionHandler } from './report-definition-handler';
import { createSessionAuthenticate, createSignInHandlers, identifyFromSession, kvCounters, MemoryCounters, type Counters, type SignInDeps } from './sign-in';
import { createSiteFlowHandler } from './site-flow-handler';
import { createChecklistSyncHandler, createEodDraftHandler, createPresenceHandler } from './sync-handlers';
import { devSendEmail, devSettingsFor, sharedDev, type SharedDev } from './dev-shared';
import { eodStoreNotReady, notConnected, notReady, SERVER_SETTINGS, type Env } from './not-connected';
import { kvVersionIndex, type KVLike, type VersionIndex } from './version-index';

/** Cloudflare bindings (not plain settings). */
export interface ApiBindings {
  /** Workers KV: version index, access cache, sign-in counters. */
  CACHE?: KVLike;
}

/** Settings the sign-in needs on top of SharePoint: the cookie key and the mailbox codes come from. */
export const SIGN_IN_SETTINGS = [...SERVER_SETTINGS, 'SESSION_SECRET', 'MAIL_FROM'] as const;

const ROUTES = ['auth/start', 'auth/verify', 'auth/sign-out', 'auth/device', 'me', 'eod-draft', 'submit-eod', 'checklist-sync', 'presence', 'site-flow', 'report-definition'] as const;
type Route = (typeof ROUTES)[number];

/** The route name from /api/<name>, or null. */
export function routeOf(url: URL): Route | null {
  const m = url.pathname.match(/^\/api\/(.+?)\/?$/);
  return m && (ROUTES as readonly string[]).includes(m[1]!) ? (m[1] as Route) : null;
}

/** Changes must come from the app's own pages (on top of SameSite cookies). */
export function sameOrigin(req: Request): boolean {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const origin = req.headers.get('Origin');
  return !origin || origin === new URL(req.url).origin;
}

/** Practice mode (local only): anyone with an email "signs in" as head office, and the code is printed in the terminal. */
function devSignIn(env: Env, dev: SharedDev): { deps: SignInDeps; authenticate: Authenticate } {
  const secret = env.SESSION_SECRET || 'practice-mode-only-not-a-real-secret-0123456789';
  const directory: StaffDirectory = {
    async byEmail(email) {
      const name = email.split('@')[0]!.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return { id: email, name, role: 'headoffice', siteCode: 'BUN', email, addedAt: '2026-01-01T00:00:00Z', addedBy: 'Practice mode', leftAt: null };
    },
  };
  const people = createAuthenticate({ identify: identifyFromSession(secret), directory });
  const session = createSessionAuthenticate({ secret, people, directory });
  // Signed in with a code → the session; otherwise the demo picker's header (dev-shared.ts).
  const authenticate: Authenticate = async (req) => (await session(req)) ?? dev.authenticate(req);
  return { deps: { secret, directory, sendEmail: devSendEmail, counters: devCounters(), secureCookie: false }, authenticate };
}

const COUNTERS = Symbol.for('maginhawa.devCounters');
const devCounters = (): Counters => ((globalThis as { [COUNTERS]?: Counters })[COUNTERS] ??= new MemoryCounters());

export function createApi(env: Env, bindings: ApiBindings = {}) {
  const index: VersionIndex | undefined = bindings.CACHE ? kvVersionIndex(bindings.CACHE) : undefined;

  /** The connected sign-in. Connection points: the Staff list and Graph sendMail. */
  function connectedSignIn(): { deps: SignInDeps; authenticate: Authenticate } {
    const secret = env.SESSION_SECRET!;
    const directory: StaffDirectory = { byEmail: notReady }; // Connection point: Staff list, filtered on Email.
    const counters = bindings.CACHE ? kvCounters(bindings.CACHE) : new MemoryCounters();
    const people = createAuthenticate({ identify: identifyFromSession(secret), directory, cache: index });
    return {
      deps: { secret, directory, counters, sendEmail: notReady }, // Connection point: Graph sendMail from MAIL_FROM to msg.to.
      authenticate: createSessionAuthenticate({ secret, people, directory }),
    };
  }

  return async (req: Request): Promise<Response> => {
    const route = routeOf(new URL(req.url));
    if (!route) return json(404, { error: 'Not found.' });
    if (!sameOrigin(req)) return json(403, { error: 'This request came from another site.' });

    const dev = sharedDev(env);
    if (!dev) {
      const off = notConnected(route.startsWith('auth/') || route === 'me' ? SIGN_IN_SETTINGS : SERVER_SETTINGS, undefined, env);
      if (off) return off;
    }
    const signIn = dev ? devSignIn(env, dev) : connectedSignIn();
    const authenticate = signIn.authenticate;

    switch (route) {
      case 'auth/start': return createSignInHandlers(signIn.deps).start(req);
      case 'auth/verify': return createSignInHandlers(signIn.deps).verify(req);
      case 'auth/sign-out': return createSignInHandlers(signIn.deps).signOut(req);
      case 'auth/device': return createSignInHandlers(signIn.deps).device(req);
      case 'me': return createSignInHandlers(signIn.deps).me(req);
      case 'eod-draft':
        // Connection point: store → the SharePoint EodStore (PATCH with If-Match: <ETag>).
        return createEodDraftHandler({ authenticate, store: dev?.eod ?? eodStoreNotReady, index: dev?.index ?? index })(req);
      case 'checklist-sync':
        // Connection point: store → a SharePoint ChecklistBackend (one Graph $batch per batch).
        return createChecklistSyncHandler({ authenticate, store: dev?.checklists ?? { apply: notReady, changes: notReady }, index: dev?.index ?? index })(req);
      case 'presence':
        // Connection point: presence → KV entries with a short expiry.
        return createPresenceHandler({ authenticate, presence: dev?.presence ?? { beat: notReady } })(req);
      case 'site-flow':
        // Connection point: store → the PowerAutomateFrom column on the Sites list.
        return createSiteFlowHandler({ authenticate, store: dev?.siteFlow ?? { list: notReady, set: notReady }, available: dev ? true : env.FLOW_OUTBOX === '1' })(req);
      case 'report-definition':
        // Connection point: store → the ReportDefinitions list (GET item + PATCH with If-Match: <ETag>).
        return createDefinitionHandler({ authenticate, store: { get: notReady, save: notReady }, groupSettings: async () => ({ dayCloseTime: '04:00', timezone: 'Europe/London' }) })(req);
      case 'submit-eod': {
        if (dev) return createSubmitHandler({ authenticate, store: dev.eod, settingsFor: devSettingsFor, sendEmail: devSendEmail, index: dev.index, flow: dev.flow })(req);
        const off = notConnected([...SERVER_SETTINGS, 'MAIL_FROM', 'MAIL_TO'], 'The server is not connected to SharePoint yet. Your report is saved on this device.', env);
        if (off) return off;
        // Connection point: store (SharePoint EodStore), sendEmail (Graph sendMail MAIL_FROM → MAIL_TO),
        // definitions (ReportDefinitions), flow (FlowOutbox when FLOW_OUTBOX=1), settingsFor (Sites list, incl. flowFrom).
        return createSubmitHandler({ authenticate, store: eodStoreNotReady, settingsFor: async () => null, sendEmail: notReady, index })(req);
      }
    }
  };
}

