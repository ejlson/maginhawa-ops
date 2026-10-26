/**
 * POST /submit-eod. Re-checks the report with @maginhawa/core, stores the official
 * figures, then emails finance. Every outside service is passed in, so the handler is
 * fully testable and the real ones (SharePoint via Graph, Entra, mail) plug in later.
 */
import { eodSummaryEmail, submitReport, type EmailMessage, type EodStore, type SiteSettings } from '@maginhawa/core';

export interface Caller {
  name: string;
  /** Sites this person may submit for. */
  siteCodes: string[];
}

export interface SubmitDeps {
  /** Checks the bearer token (Entra ID) and says who is calling. Null = not signed in. */
  authenticate: (req: Request) => Promise<Caller | null>;
  store: EodStore;
  settingsFor: (siteCode: string) => Promise<SiteSettings | null>;
  targetNetFor?: (siteCode: string, businessDate: string) => Promise<number | null>;
  sendEmail: (msg: EmailMessage) => Promise<void>;
  now?: () => Date;
}

const json = (status: number, body: unknown) =>
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
    const siteCode = typeof body === 'object' && body && 'siteCode' in body ? String((body as { siteCode: unknown }).siteCode) : '';
    if (!caller.siteCodes.includes(siteCode)) return json(403, { error: 'You can only submit for your own site.' });

    const settings = await deps.settingsFor(siteCode);
    if (!settings) return json(400, { error: 'Unknown site.' });
    const businessDate = (body as { businessDate?: string }).businessDate ?? '';
    const targetNet = deps.targetNetFor ? await deps.targetNetFor(siteCode, businessDate) : null;

    const res = await submitReport(body, { store: deps.store, settings, submittedBy: caller.name, now: deps.now?.(), targetNet });
    if (!res.ok) return json(422, { error: res.error, issues: res.issues ?? [] });

    // The report is safely stored; an email failure must not make the manager resubmit.
    let emailed = true;
    try {
      await deps.sendEmail(eodSummaryEmail(res.report, settings));
    } catch {
      emailed = false;
    }
    return json(200, { report: res.report, emailed });
  };
}
