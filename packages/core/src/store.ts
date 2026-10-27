/**
 * All data access goes through this one interface (scalability rule 9), so the
 * back end can change without touching the screens.
 *
 * - MemoryStore: in-memory, for tests and the server's dry runs.
 * - The web app wraps it with on-device storage (see apps/eod-web/app/lib/store.ts).
 * - A SharePoint store (Microsoft Graph) plugs in here once Entra and the site are connected;
 *   toSharePointFields() below already maps a report to the list columns.
 */
import type { EodDraft } from './schema';
import type { DayResult } from './calc';
import type { Issue } from './checks';
import { LOCKED_MESSAGE, SyncError, stampSections, STALE_MESSAGE, type SectionStamps } from './sync';

export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'sent-back';

export interface StoredReport {
  draft: EodDraft;
  status: ReportStatus;
  submittedAt: string | null;
  submittedBy: string | null;
  /** Official figures, set by the server on submit. */
  official: DayResult | null;
  issues: Issue[];
  /** Set by the store on every write: the SharePoint item ETag. Missing on reports saved before versioning. */
  version?: string;
  /** Who last changed each section, and when. Set by the store. */
  sections?: SectionStamps;
  /** The submit attempt that won, so a retry of that attempt is a no-op. */
  submitId?: string | null;
}

export interface SaveOptions {
  /**
   * The version this save started from. null = "nothing was stored yet".
   * Left out = save regardless (seeding and tests only).
   */
  baseVersion?: string | null;
  /** Who is saving, for the section stamps. */
  by?: string;
  now?: Date;
}

export interface SubmitOptions {
  /** Submit only if the stored report is still this version. */
  baseVersion?: string | null;
  /** One per press of Submit, reused by retries of that press. Falls back to the report's clientId. */
  submitId?: string;
  now?: Date;
}

/**
 * Every write is conditional (compare-and-set on `version`). Each method throws a
 * SyncError when it can't go ahead: 'conflict' (stale version), 'locked' (already
 * submitted, for drafts) or 'already-submitted' (someone else's submit won).
 */
export interface EodStore {
  get(siteCode: string, businessDate: string): Promise<StoredReport | null>;
  saveDraft(draft: EodDraft, opts?: SaveOptions): Promise<StoredReport>;
  /** Returns what is stored: the new report, or the first one when this was a retry. */
  submit(report: StoredReport, opts?: SubmitOptions): Promise<StoredReport>;
  listByDate(businessDate: string): Promise<StoredReport[]>;
  setStatus(siteCode: string, businessDate: string, status: ReportStatus): Promise<void>;
}

export const reportKey = (siteCode: string, businessDate: string) => `${siteCode}|${businessDate}`;

export const isEditable = (status: ReportStatus) => status === 'draft' || status === 'sent-back';

/**
 * In memory. Each method checks and writes without awaiting in between, so in one
 * JavaScript process every write is atomic, the same guarantee SharePoint gives with If-Match.
 */
export class MemoryStore implements EodStore {
  protected rows = new Map<string, StoredReport>();
  private counter = 0;

  protected nextVersion() {
    return `${++this.counter}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }

  async get(siteCode: string, businessDate: string) {
    return structuredClone(this.rows.get(reportKey(siteCode, businessDate)) ?? null);
  }

  async saveDraft(draft: EodDraft, opts: SaveOptions = {}) {
    const key = reportKey(draft.siteCode, draft.businessDate);
    const existing = this.rows.get(key);
    if (existing && !isEditable(existing.status)) throw new SyncError('locked', LOCKED_MESSAGE, structuredClone(existing));
    if (opts.baseVersion !== undefined && (existing?.version ?? null) !== opts.baseVersion) {
      if (existing) throw new SyncError('conflict', STALE_MESSAGE, structuredClone(existing));
    }
    const row: StoredReport = {
      // The report keeps the identity it was first stored with.
      draft: { ...structuredClone(draft), clientId: existing?.draft.clientId ?? draft.clientId },
      status: existing?.status ?? 'draft',
      submittedAt: null, submittedBy: null, official: null, issues: [],
      version: this.nextVersion(),
      sections: stampSections(existing?.draft ?? null, draft, existing?.sections, opts.by ?? 'Someone', opts.now ?? new Date()),
      submitId: null,
    };
    this.rows.set(key, row);
    return structuredClone(row);
  }

  async submit(report: StoredReport, opts: SubmitOptions = {}) {
    const key = reportKey(report.draft.siteCode, report.draft.businessDate);
    const existing = this.rows.get(key);
    if (existing && !isEditable(existing.status)) {
      // The same press of Submit, retried: keep the first, never duplicate.
      const attempt = (r: StoredReport) => r.submitId ?? r.draft.clientId;
      if (attempt(existing) === (opts.submitId ?? report.draft.clientId)) return structuredClone(existing);
      throw new SyncError('already-submitted', LOCKED_MESSAGE, structuredClone(existing));
    }
    if (opts.baseVersion !== undefined && existing && existing.version !== undefined && existing.version !== opts.baseVersion) {
      throw new SyncError('conflict', STALE_MESSAGE, structuredClone(existing));
    }
    const row: StoredReport = {
      ...structuredClone(report),
      version: this.nextVersion(),
      sections: stampSections(existing?.draft ?? null, report.draft, existing?.sections, report.submittedBy ?? 'Someone', opts.now ?? new Date()),
      submitId: opts.submitId ?? null,
    };
    this.rows.set(key, row);
    return structuredClone(row);
  }

  async listByDate(businessDate: string) {
    return [...this.rows.values()].filter((r) => r.draft.businessDate === businessDate).map((r) => structuredClone(r));
  }

  async setStatus(siteCode: string, businessDate: string, status: ReportStatus) {
    const row = this.rows.get(reportKey(siteCode, businessDate));
    if (!row) throw new Error('No report for that site and day.');
    row.status = status;
    row.version = this.nextVersion();
  }
}

/** Maps a submitted report to the SharePoint TradingDays / TradingSessions columns (docs/tech-plan/sharepoint). */
export function toSharePointFields(r: StoredReport) {
  const d = r.draft;
  const o = r.official;
  const pounds = (p: number | null | undefined) => (p === null || p === undefined ? null : p / 100);
  const day = {
    Title: `${d.siteCode}|${d.businessDate}`,
    BusinessDate: d.businessDate,
    Status: r.status === 'submitted' ? 'Submitted' : r.status === 'approved' ? 'Approved' : r.status === 'sent-back' ? 'SentBack' : 'Draft',
    ClientId: d.clientId,
    WageCost: pounds(d.wages.wageCost),
    NextShiftNotes: d.handover.map((h) => `${h.category}: ${h.body}`).join('\n'),
    SubmittedAt: r.submittedAt,
    TotalGross: pounds(o?.totalGross),
    TotalNet: pounds(o?.totalNet),
    DineInNet: pounds(o?.dineInNet),
    Covers: o?.covers ?? null,
    ASPHNet: pounds(o?.perHeadDineIn),
    WagePct: o?.wagePct ?? null,
    WageRAG: o?.wageRag ? o.wageRag[0]!.toUpperCase() + o.wageRag.slice(1) : null,
    NetVsTarget: pounds(o?.netVsTarget),
    CheckIssues: r.issues.filter((i) => i.level !== 'ok').map((i) => `${i.level}: ${i.title}`).join('\n'),
    CalcVersion: o?.calcVersion ?? null,
  };
  const sessions = (['lunch', 'dinner'] as const).filter((k) => d.ran[k]).map((k) => {
    const s = d.sessions[k];
    const res = o?.sessions[k];
    return {
      Title: `${d.siteCode}|${d.businessDate}|${k}`,
      BusinessDate: d.businessDate,
      Session: k === 'lunch' ? 'Lunch' : 'Dinner',
      Gross: pounds(s.gross), ServiceCharge: pounds(s.serviceCharge), Tax: pounds(s.vat), DiscountsComps: pounds(s.discounts),
      FoodSales: pounds(s.food), DrinkSales: pounds(s.drink), BookedCovers: s.booked, Walkins: s.walkins,
      CashInEpos: pounds(s.cash.tillCash), CashCollected: pounds(res?.cash.taken),
      CashExplanation: s.cash.reason ? `${s.cash.reason}${s.cash.note ? ` · ${s.cash.note}` : ''}` : '',
      Net: pounds(res?.net), Covers: res?.covers ?? null, CashVariance: pounds(res?.cash.difference),
    };
  });
  const delivery = (o?.delivery ?? []).filter((x) => x.traded).map((x) => ({
    Title: `${d.siteCode}|${d.businessDate}|${x.platformId}`, Platform: x.name, Gross: pounds(x.gross), EstimatedNet: pounds(x.net),
  }));
  return { day, sessions, delivery };
}
