/**
 * The EOD calculation rules (HANDOFF.md §5). Pure functions, all money in pence.
 * The app shows these live; the server re-runs them on submit for the official figures.
 */
import { percent, roundPence, type Pence } from './money';
import type { DeliveryPlatform, SiteSettings } from './settings';
import type { CashCount, DeliveryEntry, EodDraft, Session, SessionKey } from './schema';
import type { FigureType } from './report-definition';

export const CALC_VERSION = 'core-1.0.0';

const v = (p: Pence | null | undefined): Pence => p ?? 0;

/** Net sales = gross − service charge − VAT − discounts & comps. */
export function sessionNet(s: Pick<Session, 'gross' | 'serviceCharge' | 'vat' | 'discounts'>): Pence {
  return v(s.gross) - v(s.serviceCharge) - v(s.vat) - v(s.discounts);
}

/** Covers = booked + walk-ins. */
export function sessionCovers(s: Pick<Session, 'booked' | 'walkins'>): number {
  return (s.booked ?? 0) + (s.walkins ?? 0);
}

/** Spend a head (dine-in only): net or gross ÷ covers. Null when there are no covers. */
export function perHead(amount: Pence, covers: number): Pence | null {
  return covers > 0 ? roundPence(amount / covers) : null;
}

export interface FoodDrink {
  foodPct: number | null;
  drinkPct: number | null;
  /** food + drink − net. Zero means they match. */
  gap: Pence;
  matches: boolean;
  /** Needs a look: doesn't match and the manager hasn't confirmed it's right. */
  needsCheck: boolean;
}

/** Food % and drink % are worked out from net. Warn when food + drink ≠ net. */
export function foodDrink(s: Session, net: Pence): FoodDrink {
  const entered = s.food !== null || s.drink !== null;
  const gap = v(s.food) + v(s.drink) - net;
  const matches = !entered || gap === 0;
  return {
    foodPct: entered ? percent(v(s.food), net) : null,
    drinkPct: entered ? percent(v(s.drink), net) : null,
    gap,
    matches,
    needsCheck: !matches && !s.foodDrinkConfirmed,
  };
}

export function countedTotal(counted: Record<string, number>): Pence {
  return Object.entries(counted).reduce((sum, [denom, n]) => sum + Number(denom) * n, 0);
}

export type CashStatus = 'not-started' | 'balanced' | 'short' | 'over';

export interface CashResult {
  counted: Pence;
  /** Counted in the drawer − float. */
  taken: Pence;
  /** Taken − cash on the till report. Negative = short. */
  difference: Pence | null;
  status: CashStatus;
  /** Outside tolerance and no reason picked yet: blocks submit. */
  needsReason: boolean;
}

export function cash(c: CashCount, settings: Pick<SiteSettings, 'float' | 'cashTolerance'>): CashResult {
  const counted = countedTotal(c.counted);
  const taken = counted - settings.float;
  const started = Object.keys(c.counted).length > 0 || c.tillCash !== null;
  if (!started || c.tillCash === null) {
    return { counted, taken, difference: null, status: 'not-started', needsReason: false };
  }
  const difference = taken - c.tillCash;
  const status: CashStatus = Math.abs(difference) <= settings.cashTolerance ? 'balanced' : difference < 0 ? 'short' : 'over';
  return { counted, taken, difference, status, needsReason: status !== 'balanced' && c.reason === null };
}

/** Lines must add up to the till's discounts & comps total. Positive gap = still to list. */
export function adjustmentGap(s: Session): { listed: Pence; gap: Pence } {
  const listed = s.adjustments.filter((a) => a.kind !== 'void').reduce((sum, a) => sum + v(a.amount), 0);
  return { listed, gap: v(s.discounts) - listed };
}

/** Delivery net = gross (ex VAT where prices include it) × the platform's share. */
export function deliveryNet(entry: Pick<DeliveryEntry, 'gross' | 'traded'>, platform: DeliveryPlatform, vatRatePct: number): Pence {
  if (!entry.traded || entry.gross === null) return 0;
  const exVat = platform.pricesIncludeVat ? entry.gross / (1 + vatRatePct / 100) : entry.gross;
  return roundPence((exVat * platform.estimatedNetPct) / 100);
}

export type Rag = 'green' | 'amber' | 'red';

/** Green under amber, amber from amber up to red, red above red. */
export function wageRag(wagePct: number | null, settings: Pick<SiteSettings, 'wageAmberPct' | 'wageRedPct'>): Rag | null {
  if (wagePct === null) return null;
  if (wagePct > settings.wageRedPct) return 'red';
  if (wagePct >= settings.wageAmberPct) return 'amber';
  return 'green';
}

/**
 * The trading day for a moment in time. A report opened before the day-close time
 * (04:00 by default, site-local) counts as the previous day. Returns YYYY-MM-DD.
 */
export function tradingDate(at: Date, settings: Pick<SiteSettings, 'dayCloseTime' | 'timezone'>): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: settings.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const [ch, cm] = settings.dayCloseTime.split(':').map(Number);
  const minutes = get('hour') * 60 + get('minute');
  const local = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  if (minutes < (ch ?? 4) * 60 + (cm ?? 0)) local.setUTCDate(local.getUTCDate() - 1);
  return local.toISOString().slice(0, 10);
}

export interface SessionResult {
  ran: boolean;
  net: Pence;
  gross: Pence;
  covers: number;
  perHead: Pence | null;
  perHeadGross: Pence | null;
  foodDrink: FoodDrink;
  cash: CashResult;
  adjustments: { listed: Pence; gap: Pence };
}

export interface DeliveryResult {
  platformId: string;
  name: string;
  traded: boolean;
  gross: Pence;
  net: Pence;
  refundPending: boolean;
}

/** One figure as the review screen, the email and the flow show it. */
export interface ShownFigure {
  name: string;
  type: FigureType;
  value: number | null;
}

/** The approved report-builder version the figures were worked out with (report-live.ts). */
export interface DefinitionSummary {
  version: number;
  /** Every figure by id: money in pence, percentages as fractions, yes/no as 1/0. */
  figures: Record<string, number>;
  errors: Record<string, string>;
  /** Calculations and checks finance added in the builder, for the review screen and the email. */
  added: (ShownFigure & { id: string })[];
  /** What the summary email shows, in order. */
  email: ShownFigure[];
  /** What the Power Automate message carries, in order. Missing on reports worked out before the flow action existed. */
  flow?: ShownFigure[];
}

export interface DayResult {
  sessions: Record<SessionKey, SessionResult>;
  delivery: DeliveryResult[];
  dineInNet: Pence;
  deliveryNet: Pence;
  totalNet: Pence;
  totalGross: Pence;
  covers: number;
  perHeadDineIn: Pence | null;
  perHeadGrossDineIn: Pence | null;
  wageCost: Pence | null;
  wagePct: number | null;
  wageRag: Rag | null;
  tips: Pence;
  netVsTarget: Pence | null;
  calcVersion: string;
  /** Set when the figures came from an approved report-builder version. */
  definition?: DefinitionSummary;
}

/** Works out the whole day from a draft. Sessions or delivery that didn't run count as zero. */
export function computeDay(d: EodDraft, settings: SiteSettings, target?: { netSales: Pence | null }): DayResult {
  const sessionResult = (key: SessionKey): SessionResult => {
    const s = d.sessions[key];
    const ran = d.ran[key];
    const net = ran ? sessionNet(s) : 0;
    const covers = ran ? sessionCovers(s) : 0;
    const gross = ran ? v(s.gross) : 0;
    return {
      ran,
      net,
      gross,
      covers,
      perHead: perHead(net, covers),
      perHeadGross: perHead(gross, covers),
      foodDrink: foodDrink(s, net),
      cash: cash(s.cash, settings),
      adjustments: adjustmentGap(s),
    };
  };
  const sessions = { lunch: sessionResult('lunch'), dinner: sessionResult('dinner') };

  const delivery: DeliveryResult[] = d.delivery.map((e) => {
    const platform = settings.platforms.find((p) => p.id === e.platformId);
    const traded = d.ran.delivery && e.traded;
    return {
      platformId: e.platformId,
      name: platform?.name ?? e.platformId,
      traded,
      gross: traded ? v(e.gross) : 0,
      net: platform ? deliveryNet({ ...e, traded }, platform, settings.vatRatePct) : 0,
      refundPending: e.refundPending,
    };
  });

  const dineInNet = sessions.lunch.net + sessions.dinner.net;
  const delNet = delivery.reduce((sum, x) => sum + x.net, 0);
  const totalNet = dineInNet + delNet;
  const covers = sessions.lunch.covers + sessions.dinner.covers;
  const wageCost = d.wages.wageCost;
  const wagePct = wageCost === null ? null : percent(wageCost, totalNet);

  return {
    sessions,
    delivery,
    dineInNet,
    deliveryNet: delNet,
    totalNet,
    totalGross: sessions.lunch.gross + sessions.dinner.gross + delivery.reduce((sum, x) => sum + x.gross, 0),
    covers,
    perHeadDineIn: perHead(dineInNet, covers),
    perHeadGrossDineIn: perHead(sessions.lunch.gross + sessions.dinner.gross, covers),
    wageCost,
    wagePct,
    wageRag: wageRag(wagePct, settings),
    tips: v(d.tips.card) + v(d.tips.cash),
    netVsTarget: target?.netSales != null ? totalNet - target.netSales : null,
    calcVersion: CALC_VERSION,
  };
}
