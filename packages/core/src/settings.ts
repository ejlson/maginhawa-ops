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

export const SITES = [
  { code: 'BIN', name: 'Bintang' },
  { code: 'GUA', name: 'Guanabana' },
  { code: 'BEL', name: 'Belly' },
  { code: 'RAM', name: 'Ramo' },
  { code: 'HOO', name: 'Hoodwood' },
  { code: 'BUN', name: 'Bunso' },
  { code: 'CAF', name: 'Cafe Mamasons' },
  { code: 'MKT', name: 'Mamasons Kentish Town' },
  { code: 'MCT', name: 'Mamasons China Town' },
] as const;

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
