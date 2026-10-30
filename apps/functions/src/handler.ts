/**
 * POST /submit-eod. Re-checks the report with @maginhawa/core, stores the official
 * figures, hands the Power Automate flow its message (FlowOutbox), then emails finance.
 * Every outside service is passed in, so the handler is fully testable and the real
 * ones (SharePoint via Graph, Entra, mail) plug in later.
 */
import { eodSummaryEmail, flowMessage, submitReport, type DefinitionRecord, type EmailMessage, type EodStore, type FlowOutbox, type SiteSettings, type StoredReport } from '@maginhawa/core';
import { recordReport, type VersionIndex } from './version-index';

export interface Caller {
  name: string;
  /** Sites this person may submit for. */
  siteCodes: string[];
  /** From their Entra ID group. Staff can't correct a finished checklist. */
  role?: 'staff' | 'supervisor' | 'manager' | 'headoffice';
}

/** Checks the bearer token (Entra ID) and says who is calling. Null = not signed in. */
export type Authenticate = (req: Request) => Promise<Caller | null>;

export interface SubmitDeps {
  authenticate: Authenticate;
  store: EodStore;
  settingsFor: (siteCode: string) => Promise<SiteSettings | null>;
  targetNetFor?: (siteCode: string, businessDate: string) => Promise<number | null>;
  sendEmail: (msg: EmailMessage) => Promise<void>;
  now?: () => Date;
  /** Netlify Blobs: so other devices' polls see the submit without asking SharePoint. */
  index?: VersionIndex;
  /** The report builder's versions; the one approved for the report's trading day decides the figures. */
  definitions?: () => Promise<DefinitionRecord | null>;
  /** The FlowOutbox list the "EOD submitted" flow starts from. Left out = Power Automate isn't switched on. */
  flow?: FlowOutbox;
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export function createSubmitHandler(deps: SubmitDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

    const caller = await deps.authenticate(req);
    if (!caller) return json(401, { error: 'Sign in again, then submit.' });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'The report could not be read.' });
    }
    // Either the draft itself, or { draft, baseVersion, submitId } from a device that syncs.
    const envelope = typeof body === 'object' && body && 'draft' in body ? (body as { draft: unknown; baseVersion?: string | null; submitId?: string }) : null;
    const condition = envelope ? { baseVersion: envelope.baseVersion ?? null, submitId: envelope.submitId } : {};
    if (envelope) body = envelope.draft;
    const siteCode = typeof body === 'object' && body && 'siteCode' in body ? String((body as { siteCode: unknown }).siteCode) : '';
    if (!caller.siteCodes.includes(siteCode)) return json(403, { error: 'You can only submit for your own site.' });

    const settings = await deps.settingsFor(siteCode);
    if (!settings) return json(400, { error: 'Unknown site.' });
    const businessDate = (body as { businessDate?: string }).businessDate ?? '';
    // Independent reads: ask for both at once.
    const [targetNet, definitions] = await Promise.all([
      deps.targetNetFor ? deps.targetNetFor(siteCode, businessDate) : null,
      deps.definitions ? deps.definitions() : null,
    ]);
    const res = await submitReport(body, { store: deps.store, settings, submittedBy: caller.name, now: deps.now?.(), targetNet, definitions, ...condition });
    // 409: someone else sent it first, or changed it since this person last looked. `current` is what is stored.
    const at = (deps.now?.() ?? new Date()).getTime();
    if (!res.ok && (res.code === 'already-submitted' || res.code === 'conflict')) {
      if (res.current) await recordReport(deps.index, res.current, at);
      return json(409, { error: res.error, code: res.code, current: res.current });
    }
    if (!res.ok) return json(422, { error: res.error, code: res.code, issues: res.issues ?? [] });
    await recordReport(deps.index, res.report, at);
    // Before the replay shortcut: a retry may be the first attempt that got this far. Adding twice is a no-op.
    await queueFlow(deps, res.report, settings);
    // A retry after lost signal: finance already has the email, unless the first attempt never got that far.
    if (res.replayed && res.report.emailedAt) return json(200, { report: res.report, replayed: true, emailed: true });

    // The report is safely stored; an email failure must not make the manager resubmit (the email retry job sends it later).
    const emailed = await emailFinance(deps, res.report, settings);
    return json(200, { report: res.report, emailed, ...(res.replayed ? { replayed: true } : {}) });
  };
}

/** Sends finance the summary and stamps it, so it is never sent twice. False = not sent; try again later. */
export async function emailFinance(deps: Pick<SubmitDeps, 'store' | 'sendEmail' | 'now'>, report: StoredReport, settings: SiteSettings): Promise<boolean> {
  try {
    await deps.sendEmail(eodSummaryEmail(report, settings));
  } catch {
    return false;
  }
  try {
    await deps.store.markEmailed(report.draft.siteCode, report.draft.businessDate, deps.now?.() ?? new Date());
  } catch {
    // Sent but not stamped: the retry job may send it once more. A duplicate beats a missing one.
  }
  return true;
}

/** Gives the flow its message. Never fails the submit: the email retry job adds anything missing later. */
export async function queueFlow(deps: Pick<SubmitDeps, 'flow'>, report: StoredReport, settings: SiteSettings): Promise<'added' | 'exists' | 'failed' | 'off'> {
  if (!deps.flow) return 'off';
  const message = flowMessage(report, settings);
  if (!message) return 'failed';
  try {
    return await deps.flow.add(message);
  } catch {
    return 'failed';
  }
}
