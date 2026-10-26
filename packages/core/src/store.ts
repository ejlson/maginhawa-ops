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

export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'sent-back';

export interface StoredReport {
  draft: EodDraft;
  status: ReportStatus;
  submittedAt: string | null;
  submittedBy: string | null;
  /** Official figures, set by the server on submit. */
  official: DayResult | null;
  issues: Issue[];
}

export interface EodStore {
  get(siteCode: string, businessDate: string): Promise<StoredReport | null>;
  saveDraft(draft: EodDraft): Promise<void>;
  submit(report: StoredReport): Promise<void>;
  listByDate(businessDate: string): Promise<StoredReport[]>;
  setStatus(siteCode: string, businessDate: string, status: ReportStatus): Promise<void>;
}

export const reportKey = (siteCode: string, businessDate: string) => `${siteCode}|${businessDate}`;

export class MemoryStore implements EodStore {
  protected rows = new Map<string, StoredReport>();

  async get(siteCode: string, businessDate: string) {
    return structuredClone(this.rows.get(reportKey(siteCode, businessDate)) ?? null);
  }

  async saveDraft(draft: EodDraft) {
    const key = reportKey(draft.siteCode, draft.businessDate);
    const existing = this.rows.get(key);
    if (existing && existing.status !== 'draft' && existing.status !== 'sent-back') {
      throw new Error('This day is already submitted. Ask finance to reopen it.');
    }
    this.rows.set(key, {
      draft: structuredClone(draft),
      status: existing?.status ?? 'draft',
      submittedAt: null, submittedBy: null, official: null, issues: [],
    });
  }

  async submit(report: StoredReport) {
    const key = reportKey(report.draft.siteCode, report.draft.businessDate);
    const existing = this.rows.get(key);
    // Same clientId resubmitted (a retry): keep the first, never duplicate.
    if (existing && existing.status === 'submitted' && existing.draft.clientId === report.draft.clientId) return;
    if (existing && existing.status === 'submitted') throw new Error('This day is already submitted. Ask finance to reopen it.');
    this.rows.set(key, structuredClone(report));
  }

  async listByDate(businessDate: string) {
    return [...this.rows.values()].filter((r) => r.draft.businessDate === businessDate).map((r) => structuredClone(r));
  }

  async setStatus(siteCode: string, businessDate: string, status: ReportStatus) {
    const row = this.rows.get(reportKey(siteCode, businessDate));
    if (!row) throw new Error('No report for that site and day.');
    row.status = status;
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
