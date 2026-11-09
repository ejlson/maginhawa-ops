import type { Pence } from './money';

export interface DeliveryPlatform {
  id: string;
  name: string;
  /** Share of the ex-VAT price the restaurant keeps, e.g. 55 (%). */
  estimatedNetPct: number;
  /** Platform prices shown to guests include VAT. */
  pricesIncludeVat: boolean;
  active: boolean;
}

export interface SiteSettings {
  siteCode: string;
  siteName: string;
  /** Cash float left in the drawer, taken off the count. */
  float: Pence;
  /** A cash difference within this amount (either way) counts as balanced. */
  cashTolerance: Pence;
  vatRatePct: number;
  /** Wage % from which the figure shows amber, and red. */
  wageAmberPct: number;
  wageRedPct: number;
  /** Reports opened before this local time count as the previous trading day. */
  dayCloseTime: string;
  timezone: string;
  /** Warn when discounts and comps exceed this share of gross. */
  discountWarnPct: number;
  /** Warn when net differs from the same weekday last week by more than this. */
  netSwingWarnPct: number;
  platforms: DeliveryPlatform[];
  /** Values for settings finance added in the report builder, by figure id (e.g. a card fee rate as 0.0175). */
  definitionSettings?: Record<string, number>;
  /** When head office switched Power Automate on for this site. Unset = off. Reports sent before it don't go to the flow. */
  flowFrom?: string | null;
}

/** Example settings for local and demo use. Real values come from SharePoint (Sites, DeliveryPlatforms, RulesThresholds). */
export const DEFAULT_SETTINGS: SiteSettings = {
  siteCode: 'BUN',
  siteName: 'Bunso',
  float: 15000,
  cashTolerance: 100,
  vatRatePct: 20,
  wageAmberPct: 30,
  wageRedPct: 35,
  dayCloseTime: '04:00',
  timezone: 'Europe/London',
  discountWarnPct: 8,
  netSwingWarnPct: 40,
  platforms: [
    { id: 'deliveroo', name: 'Deliveroo', estimatedNetPct: 55, pricesIncludeVat: true, active: true },
    { id: 'ubereats', name: 'Uber Eats', estimatedNetPct: 55, pricesIncludeVat: true, active: true },
  ],
};

/**
 * Every site the group has had, including closed ones, so old records still show a name.
 * A closed site keeps its code; it just drops out of pickers, counts and forecasts.
 */
export const ALL_SITES = [
  { code: 'BIN', name: 'Bintang', open: true },
  { code: 'GUA', name: 'Guanabana', open: true },
  { code: 'BEL', name: 'Belly', open: true },
  { code: 'RAM', name: 'Ramo', open: false },
  { code: 'HOO', name: 'Hoodwood', open: true },
  { code: 'BUN', name: 'Bunso', open: true },
  { code: 'CAF', name: 'Cafe Mama & Sons', open: true },
  { code: 'MKT', name: 'Mamasons Kentish Town', open: true },
  { code: 'MCT', name: 'Mamasons China Town', open: true },
] as const;

export type Site = (typeof ALL_SITES)[number];

/** The sites trading now: what pickers, "7 of 8 in" counts and forecasts use. */
export const SITES: readonly Site[] = ALL_SITES.filter((s) => s.open);

export const OPEN_SITE_CODES: readonly string[] = SITES.map((s) => s.code);

export const isOpenSite = (code: string) => OPEN_SITE_CODES.includes(code);

/** A site by code, open or closed. */
export const findSite = (code: string): Site | undefined => ALL_SITES.find((s) => s.code === code.toUpperCase());

/** A site's name for any record, including a closed site's old ones. */
export const siteName = (code: string) => findSite(code)?.name ?? code;

export const CASH_REASONS = [
  'Refund paid in cash',
  'Paid out (petty cash)',
  'Float not reset',
  'Miscount, recounted',
  'Other',
] as const;
export type CashReason = (typeof CASH_REASONS)[number];

/** UK notes and coins, in pence, largest first. */
export const NOTES: Pence[] = [5000, 2000, 1000, 500];
export const COINS: Pence[] = [200, 100, 50, 20, 10, 5, 2, 1];

export function denominationLabel(p: Pence): string {
  return p >= 100 ? `£${p / 100}` : `${p}p`;
}
