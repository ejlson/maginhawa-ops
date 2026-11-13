/**
 * The message Power Automate gets when an EOD is submitted. Pure functions: the server decides where it goes.
 *
 * The server never calls a flow. It adds the message to the FlowOutbox SharePoint list, and the "EOD submitted"
 * flow (flows/MaginhawaOps) starts on the new row. So there is no trigger URL to leak, no Premium licence, and a
 * message survives the flow being off: it waits in the list. Figures are worked out here, never in the flow.
 *
 * Which figures go is up to finance: the "Send to Power Automate" action in the report builder.
 * Which sites use it is up to head office, in the same place: each site is switched on or off by itself.
 * Handover notes are left out on purpose (they can name staff; UK GDPR data minimisation).
 */
import { figureText } from './email';
import { formatPounds } from './money';
import type { FigureType } from './report-definition';
import type { SiteSettings } from './settings';
import type { StoredReport } from './store';

/** Bump when a field changes meaning; the flow checks it. */
export const FLOW_SCHEMA = 'maginhawa.eod.submitted/1';

export interface FlowFigure {
  name: string;
  type: FigureType;
  /** Money in pence, percentages as fractions (0.2 = 20%), yes/no as 1/0. Null = not worked out. */
  value: number | null;
  /** Ready to show, e.g. "£2,687.50" or "29.8%". */
  text: string;
}

export interface FlowMessage {
  schema: typeof FLOW_SCHEMA;
  /** SiteCode|yyyy-mm-dd|submitId: one message per submit. */
  key: string;
  site: { code: string; name: string };
  businessDate: string;
  /** e.g. "Monday 5 October". */
  dayLabel: string;
  submittedAt: string | null;
  submittedBy: string | null;
  summary: {
    net: number;
    netText: string;
    covers: number;
    /** e.g. 29.8. Null when no wage cost was entered. */
    wagePct: number | null;
    wageRag: 'green' | 'amber' | 'red' | null;
    netVsTarget: number | null;
    netVsTargetText: string | null;
  };
  /** The figures finance picked for the flow in the report builder, in their order. */
  figures: FlowFigure[];
  /** The report's warnings by title: the "To look at" list in the email. */
  toLookAt: string[];
  /** Report-builder version that worked the figures out. Null = today's built-in rules. */
  definitionVersion: number | null;
}

export const flowKey = (r: StoredReport) => `${r.draft.siteCode}|${r.draft.businessDate}|${r.submitId ?? r.submittedAt ?? 'unsent'}`;

/** Null when the report has no official figures yet (not submitted). */
export function flowMessage(r: StoredReport, settings: Pick<SiteSettings, 'siteName'>): FlowMessage | null {
  const o = r.official;
  if (!o) return null;
  const d = r.draft;
  const signed = (p: number) => `${p >= 0 ? '+' : '−'}${formatPounds(Math.abs(p))}`;
  return {
    schema: FLOW_SCHEMA,
    key: flowKey(r),
    site: { code: d.siteCode, name: settings.siteName },
    businessDate: d.businessDate,
    dayLabel: new Date(`${d.businessDate}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
    submittedAt: r.submittedAt,
    submittedBy: r.submittedBy,
    summary: {
      net: o.totalNet,
      netText: formatPounds(o.totalNet),
      covers: o.covers,
      wagePct: o.wagePct,
      wageRag: o.wageRag,
      netVsTarget: o.netVsTarget,
      netVsTargetText: o.netVsTarget === null ? null : signed(o.netVsTarget),
    },
    figures: (o.definition?.flow ?? []).map((x) => ({ ...x, text: figureText(x.type, x.value) })),
    toLookAt: r.issues.filter((i) => i.level === 'warn').map((i) => i.title),
    definitionVersion: o.definition?.version ?? null,
  };
}

/**
 * Should this report go to the flow? Only when its site is switched on, and only if it was sent after that:
 * the retry job looks back two days, and switching a site on mustn't post those days to Teams.
 */
export function flowWanted(r: Pick<StoredReport, 'submittedAt'>, settings: Pick<SiteSettings, 'flowFrom'>) {
  return !!settings.flowFrom && !!r.submittedAt && Date.parse(r.submittedAt) >= Date.parse(settings.flowFrom);
}

/** When each site was switched on, by site code. A site that's off isn't listed. */
export type SiteFlows = Record<string, string>;

/** Which sites use the flow. SharePoint: the PowerAutomateFrom column on the Sites list. */
export interface SiteFlowStore {
  list(): Promise<SiteFlows>;
  /** Null switches the site off. */
  set(siteCode: string, from: string | null): Promise<void>;
}

/** Where messages wait for the flow. SharePoint: the FlowOutbox list. */
export interface FlowOutbox {
  /**
   * Adds the message once. The key is unique (SharePoint: Title), so adding it again changes nothing
   * and answers 'exists'. That makes every retry safe.
   */
  add(message: FlowMessage): Promise<'added' | 'exists'>;
}

export type FlowStatus = 'Queued' | 'Done' | 'Failed';

/** The FlowOutbox row the server writes. The flow itself sets Status, ProcessedAt, RunId and Error later. */
export function toFlowOutboxFields(m: FlowMessage, at: Date) {
  return {
    Title: m.key,
    SiteCode: m.site.code,
    BusinessDate: m.businessDate,
    Schema: m.schema,
    Payload: JSON.stringify(m),
    Status: 'Queued' as FlowStatus,
    QueuedAt: at.toISOString(),
  };
}

/** In memory, for tests and shared test mode. */
export class MemorySiteFlowStore implements SiteFlowStore {
  private sites: SiteFlows = {};
  async list() { return { ...this.sites }; }
  async set(siteCode: string, from: string | null) {
    if (from) this.sites[siteCode] = from;
    else delete this.sites[siteCode];
  }
}

/** In memory, for tests and shared test mode. */
export class MemoryFlowOutbox implements FlowOutbox {
  readonly items = new Map<string, FlowMessage & { status: FlowStatus }>();
  async add(message: FlowMessage): Promise<'added' | 'exists'> {
    if (this.items.has(message.key)) return 'exists';
    this.items.set(message.key, { ...structuredClone(message), status: 'Queued' });
    return 'added';
  }
}
