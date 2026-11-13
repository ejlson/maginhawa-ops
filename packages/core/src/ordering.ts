/**
 * Ordering and waste (docs/reports/next-modules-scope.md §3). Orders start filled in from each site's
 * usual levels (par levels), a delivery starts with everything ticked, and waste starts with the item's
 * usual amount and reason, so most tasks are one or two taps. Money is whole pence.
 */
import { roundPence, type Pence } from './money';

export interface Supplier {
  id: string;
  name: string;
  /** Order by this time (site time, HH:MM) for delivery after `leadDays`. */
  orderBy: string;
  leadDays: number;
  /** How orders go out: email in v1. */
  email: string;
}

/** How one stock item is bought: the pack, what's in it (in the item's own unit) and its price. */
export interface SupplierItem {
  itemId: string;
  supplierId: string;
  /** "5 kg box", "case of 6". */
  pack: string;
  /** How many of the item's units are in one pack (5 for a 5 kg box of an item counted in kg). */
  packSize: number;
  packPrice: Pence;
}

/** The level a site wants after a delivery, in the item's own unit. */
export interface ParLevel { siteCode: string; itemId: string; par: number }

export interface OrderLine { itemId: string; packs: number; packPrice: Pence }

export interface Order {
  id: string;
  siteCode: string;
  supplierId: string;
  lines: OrderLine[];
  /** When it was sent to the team to place. */
  sentAt: string | null;
  sentBy: string | null;
  /** When someone on the team placed it with the supplier (phone, portal, email). For now the app
   *  doesn't contact suppliers itself: it tells the team, who place the order and mark it here. */
  placedAt: string | null;
  placedBy: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  /** itemId → packs that didn't come. */
  missing: Record<string, number>;
}

export interface PriceChange {
  id: string;
  itemId: string;
  supplierId: string;
  /** Pack prices. */
  from: Pence;
  to: Pence;
  seenAt: string;
  seenAtSite: string;
  status: 'open' | 'accepted' | 'queried';
}

export const WASTE_REASONS = ['Out of date', 'Made too much', 'Dropped or burnt', 'Spoiled', 'Sent back'] as const;
export type WasteReason = (typeof WASTE_REASONS)[number];

export interface WasteEntry {
  id: string;
  siteCode: string;
  itemId: string;
  qty: number;
  reason: WasteReason;
  /** Cost of one unit when it was logged. */
  unitCost: Pence;
  by: string;
  at: string;
}

/** Packs to order to get back to the usual level. Never negative; part packs round up. */
export function suggestPacks(onHand: number, par: number, packSize: number): number {
  if (packSize <= 0 || onHand >= par) return 0;
  return Math.ceil((par - onHand) / packSize - 1e-9);
}

export const isLow = (onHand: number | null, par: number) => onHand !== null && onHand < par;

export const orderTotal = (lines: Pick<OrderLine, 'packs' | 'packPrice'>[]): Pence => lines.reduce((n, l) => n + l.packs * l.packPrice, 0);

/** Money to chase for packs that didn't come. */
export function creditDue(order: Pick<Order, 'lines' | 'missing'>): Pence {
  return order.lines.reduce((n, l) => n + Math.min(order.missing[l.itemId] ?? 0, l.packs) * l.packPrice, 0);
}

/** "+8%", "−5%": change in price, to the nearest whole percent. */
export function priceChangeText(from: Pence, to: Pence): string {
  const pct = Math.round(((to - from) / from) * 100);
  return pct >= 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

export const wasteValue = (qty: number, unitCost: Pence): Pence => roundPence(qty * unitCost);

/** Waste as a share of what was bought, to one decimal place. Nothing bought → null. */
export function wasteShare(waste: Pence, purchases: Pence): number | null {
  if (purchases <= 0) return null;
  return Math.round((waste / purchases) * 1000) / 10;
}

/** The time left before an order cut-off, in words: "2 h 40 min left", "Closed for today". */
export function cutOffText(now: Date, orderBy: string, timeZone = 'Europe/London'): string {
  const hm = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone });
  const [h, m] = hm.split(':').map(Number);
  const [bh, bm] = orderBy.split(':').map(Number);
  const left = (bh! * 60 + bm!) - (h! * 60 + m!);
  if (left <= 0) return 'Closed for today';
  return left >= 60 ? `${Math.floor(left / 60)} h ${left % 60} min left` : `${left} min left`;
}

const csvCell = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Waste for finance: one row each, valued at cost ex VAT. */
export function wasteCsv(rows: WasteEntry[], itemName: (id: string) => string, siteName: (code: string) => string): string {
  const out = ['Site,Date,Item,Quantity,Reason,Unit cost (£),Value (£),Logged by'];
  for (const w of rows) out.push([siteName(w.siteCode), w.at.slice(0, 10), itemName(w.itemId), w.qty, w.reason, (w.unitCost / 100).toFixed(2), (wasteValue(w.qty, w.unitCost) / 100).toFixed(2), w.by].map(csvCell).join(','));
  return out.join('\n');
}
