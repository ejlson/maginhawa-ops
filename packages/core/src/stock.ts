/**
 * Stock counts (docs/reports/stock-count-scope.md, phase 1).
 *
 * Anyone at a site can count. A count walks the site's storage areas in shelf order, one item at a
 * time, in each item's own unit (bottles, kg, bags…); part units are allowed where it makes sense
 * (5.4 bottles of rum). Once sent, a count is locked: a correction needs a supervisor or above and a
 * reason, and keeps the old figure. Costs are set by head office, ex VAT, in pence per unit.
 *
 * Money is whole pence throughout (money.ts), so values add up exactly.
 */
import { addDays, daysBetween, weekday } from './data-quality';
import { roundPence, type Pence } from './money';
import type { Allergen } from './food-safety';

export interface StockItem {
  id: string;
  name: string;
  /** Spirits, Wine, Beer, Meat and fish, Dry goods… Used to group the list in settings. */
  category: string;
  /** What you count in, plural: "bottles", "kg", "bags". */
  unit: string;
  /** Part units allowed (tenths of a bottle). Otherwise whole numbers only. */
  parts: boolean;
  /** Cost of one unit, ex VAT, in pence. null = head office hasn't set it yet: counted but not valued. */
  costPence: Pence | null;
  active: boolean;
  /** Allergens this ingredient carries (for the recipe check). */
  allergens?: Allergen[];
}

/** A storage area at one site, with its items in the order they sit on the shelves. */
export interface StockArea {
  id: string;
  siteCode: string;
  name: string;
  itemIds: string[];
}

/** When a count is due. */
export type StockSchedule =
  | { kind: 'daily' }
  /** 0 = Sunday … 6 = Saturday. */
  | { kind: 'weekdays'; days: number[] }
  /** Every 4 weeks from a first date (a Sunday, usually). */
  | { kind: 'every4weeks'; from: string };

/** A count a site does regularly: the full stocktake, or a spot count of a few costly items. */
export interface StockPlan {
  id: string;
  siteCode: string;
  name: string;
  kind: 'full' | 'spot';
  schedule: StockSchedule;
  /** Spot counts: just these items. Full counts: every item in every area. */
  itemIds?: string[];
}

export interface StockLine {
  qty: number;
  by: string;
  at: string;
  /** Someone looked at a big change from last time and said it's right. */
  okay?: boolean;
}

export interface StockCorrection { itemId: string; from: number; to: number; reason: string; by: string; at: string }

/** One count. Areas and items are copied in when it starts, so later list changes never alter it. */
export interface StockCount {
  id: string;
  siteCode: string;
  planId: string;
  name: string;
  kind: 'full' | 'spot';
  businessDate: string;
  startedAt: string;
  startedBy: string;
  areas: { id: string; name: string; itemIds: string[] }[];
  /** itemId → what was counted. */
  lines: Record<string, StockLine>;
  /** Cost of each item when the count was sent (pence per unit, null = no cost). Fixed from then on. */
  costs?: Record<string, Pence | null>;
  sentAt: string | null;
  sentBy: string | null;
  corrections: StockCorrection[];
}

/** A count is more than half above or below the item's last count. */
export const SWING_SHARE = 0.5;

// ---- schedules ----

export function dueOn(schedule: StockSchedule, date: string): boolean {
  switch (schedule.kind) {
    case 'daily': return true;
    case 'weekdays': return schedule.days.includes(weekday(date));
    case 'every4weeks': {
      const d = daysBetween(schedule.from, date);
      return d >= 0 && d % 28 === 0;
    }
  }
}

/** The first day on or after `from` that the count is due (within a year). */
export function nextDue(schedule: StockSchedule, from: string): string | null {
  for (let i = 0; i <= 366; i++) {
    const d = addDays(from, i);
    if (dueOn(schedule, d)) return d;
  }
  return null;
}

export function stockScheduleText(s: StockSchedule): string {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (s.kind === 'daily') return 'Every day';
  if (s.kind === 'every4weeks') return 'Every 4 weeks';
  const names = [...s.days].sort((a, b) => a - b).map((d) => DAYS[d]!);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : `Every ${names[0] ?? ''}`.trim();
}

// ---- starting a count ----

/** The areas and items a plan covers at its site, in shelf order. Spot counts keep only their items. */
export function areasFor(plan: StockPlan, areas: StockArea[], items: StockItem[]): StockCount['areas'] {
  const live = new Set(items.filter((i) => i.active).map((i) => i.id));
  const wanted = plan.itemIds ? new Set(plan.itemIds) : null;
  return areas
    .filter((a) => a.siteCode === plan.siteCode)
    .map((a) => ({ id: a.id, name: a.name, itemIds: a.itemIds.filter((id) => live.has(id) && (!wanted || wanted.has(id))) }))
    .filter((a) => a.itemIds.length > 0);
}

export function itemIdsOf(count: Pick<StockCount, 'areas'>): string[] {
  return count.areas.flatMap((a) => a.itemIds);
}

// ---- quantities ----

/**
 * What someone types: "5", "5.4", "5,4", " 12 ". Part units only to one decimal place, and only for
 * items that allow them. Empty or invalid → null.
 */
export function parseQty(text: string, parts: boolean): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  if (!(parts ? /^\d+(\.\d)?$/ : /^\d+$/).test(t)) return null;
  return Number(t);
}

/** Keeps tenths exact when stepping with − and +. */
export const stepQty = (qty: number, by: number) => Math.max(0, Math.round((qty + by) * 10) / 10);

export function qtyText(qty: number, unit: string): string {
  const n = Number.isInteger(qty) ? String(qty) : qty.toFixed(1);
  return `${n} ${qty === 1 ? unit.replace(/s$/, '') : unit}`;
}

// ---- progress ----

export interface AreaProgress { id: string; name: string; total: number; counted: number; status: 'todo' | 'started' | 'done'; by: string[] }

export function areaProgress(count: Pick<StockCount, 'areas' | 'lines'>): AreaProgress[] {
  return count.areas.map((a) => {
    const counted = a.itemIds.filter((id) => count.lines[id]);
    const by = [...new Set(counted.map((id) => count.lines[id]!.by))];
    return {
      id: a.id, name: a.name, total: a.itemIds.length, counted: counted.length, by,
      status: counted.length === 0 ? 'todo' : counted.length === a.itemIds.length ? 'done' : 'started',
    };
  });
}

/** The first area that isn't finished, in shelf order. */
export const nextArea = (count: Pick<StockCount, 'areas' | 'lines'>) => areaProgress(count).find((a) => a.status !== 'done') ?? null;

export const uncounted = (count: Pick<StockCount, 'areas' | 'lines'>) => itemIdsOf(count).filter((id) => !count.lines[id]);

/** The item's figure in the most recent sent count at the site before this one (corrections included). */
export function lastQty(counts: StockCount[], siteCode: string, itemId: string, before: StockCount | null): number | null {
  const earlier = counts
    .filter((c) => c.siteCode === siteCode && c.sentAt && c.id !== before?.id && (!before || c.startedAt < before.startedAt) && c.lines[itemId])
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const c = earlier[0];
  return c ? qtyOf(c, itemId) : null;
}

/** The figure that stands for an item: the latest correction if there is one, else what was counted. */
export function qtyOf(count: Pick<StockCount, 'lines' | 'corrections'>, itemId: string): number | null {
  const fixes = count.corrections.filter((c) => c.itemId === itemId);
  if (fixes.length) return fixes[fixes.length - 1]!.to;
  return count.lines[itemId]?.qty ?? null;
}

/** More than half above or below last time. Nothing to compare with (or zero last time) never swings. */
export function isSwing(qty: number, last: number | null): boolean {
  if (last === null || last <= 0) return false;
  return Math.abs(qty - last) / last > SWING_SHARE;
}

export interface Swing { itemId: string; qty: number; last: number; okay: boolean }

export function swings(count: StockCount, counts: StockCount[]): Swing[] {
  const out: Swing[] = [];
  for (const id of itemIdsOf(count)) {
    const qty = qtyOf(count, id);
    if (qty === null) continue;
    const last = lastQty(counts, count.siteCode, id, count);
    if (last !== null && isSwing(qty, last)) out.push({ itemId: id, qty, last, okay: !!count.lines[id]?.okay });
  }
  return out;
}

/** What still stops sending: only items not counted. Swings are warnings. */
export function sendProblem(count: Pick<StockCount, 'areas' | 'lines' | 'sentAt'>): string | null {
  if (count.sentAt) return 'Already sent';
  const left = uncounted(count).length;
  if (left) return `Count the last ${left} first`;
  return null;
}

// ---- value ----

export function lineValue(qty: number, costPence: Pence | null): Pence | null {
  return costPence === null ? null : roundPence(qty * costPence);
}

/** Stock value, using the costs fixed when the count was sent (or today's costs before then). */
export function countValue(count: StockCount, items: StockItem[]): { value: Pence; noCost: string[] } {
  const cost = (id: string) => (count.costs && id in count.costs ? count.costs[id]! : items.find((i) => i.id === id)?.costPence ?? null);
  let value = 0;
  const noCost: string[] = [];
  for (const id of itemIdsOf(count)) {
    const qty = qtyOf(count, id);
    if (qty === null) continue;
    const v = lineValue(qty, cost(id));
    if (v === null) noCost.push(id);
    else value += v;
  }
  return { value, noCost };
}

export const costsNow = (count: Pick<StockCount, 'areas'>, items: StockItem[]): Record<string, Pence | null> =>
  Object.fromEntries(itemIdsOf(count).map((id) => [id, items.find((i) => i.id === id)?.costPence ?? null]));

/** Cost of sales for a period: opening stock + purchases − closing stock (+ transfers in − transfers out). */
export function costOfSales(p: { opening: Pence; purchases: Pence; closing: Pence; transfersIn?: Pence; transfersOut?: Pence }): Pence {
  return p.opening + p.purchases + (p.transfersIn ?? 0) - (p.transfersOut ?? 0) - p.closing;
}

/** Gross profit as a percentage of net sales, to one decimal place. No sales → null. */
export function grossProfitPct(netSales: Pence, cost: Pence): number | null {
  if (netSales <= 0) return null;
  return Math.round(((netSales - cost) / netSales) * 1000) / 10;
}

// ---- corrections ----

export function stockCorrectionProblem(p: { previous: number | null; value: number | null; reason: string }): string | null {
  if (p.value === null) return 'Type the right figure';
  if (p.previous !== null && p.value === p.previous) return "That's the same as what's there";
  if (p.reason.trim().length < 4) return 'Say why it needs correcting';
  return null;
}

// ---- export ----

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per item counted, for finance's spreadsheet. Pounds to 2 decimal places, ex VAT. */
export function stockCsv(counts: StockCount[], items: StockItem[], siteName: (code: string) => string): string {
  const head = ['Site', 'Date', 'Count', 'Area', 'Item', 'Unit', 'Quantity', 'Unit cost (£)', 'Value (£)', 'Counted by', 'Corrected'];
  const rows = [head.join(',')];
  const pounds = (p: Pence | null) => (p === null ? '' : (p / 100).toFixed(2));
  for (const c of counts) {
    for (const a of c.areas) {
      for (const id of a.itemIds) {
        const qty = qtyOf(c, id);
        if (qty === null) continue;
        const item = items.find((i) => i.id === id);
        const cost = c.costs && id in c.costs ? c.costs[id]! : item?.costPence ?? null;
        const fixed = c.corrections.filter((x) => x.itemId === id);
        rows.push([
          siteName(c.siteCode), c.businessDate, c.name, a.name, item?.name ?? id, item?.unit ?? '', qty,
          pounds(cost), pounds(lineValue(qty, cost)), c.lines[id]?.by ?? '', fixed.length ? `${fixed[0]!.from} → ${qty}: ${fixed[fixed.length - 1]!.reason}` : '',
        ].map(csvCell).join(','));
      }
    }
  }
  return rows.join('\n');
}
