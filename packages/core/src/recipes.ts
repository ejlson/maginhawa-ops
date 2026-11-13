/**
 * Recipes and dish costing (docs/reports/next-modules-scope.md §4). A recipe uses stock items in their
 * own units (0.3 kg of pork belly, shown as "300 g"), so a price change flows straight to every dish.
 * Menu prices include 20% VAT; GP is worked out on the price without VAT.
 */
import type { Allergen } from './food-safety';
import type { StockItem } from './stock';
import { roundPence, type Pence } from './money';

export const VAT_RATE = 0.2;

export interface RecipeLine {
  itemId: string;
  /** In the stock item's own unit (kg, bottles…). */
  amount: number;
  /** How the kitchen sees it: "300 g", "½, boiled". */
  shown: string;
}

export interface Recipe {
  id: string;
  name: string;
  section: string;
  /** Menu price, including VAT. */
  pricePence: Pence;
  lines: RecipeLine[];
  /** Small things costed as one figure: sauce, garnish. */
  extras: { label: string; costPence: Pence }[];
  steps: { text: string; tip: string }[];
  /** The allergen record for this dish (food safety), the source of truth. */
  allergens: Allergen[];
  /** Usual plates a day at one site, for "runs out tomorrow". */
  perDay: number;
}

export function dishCost(r: Pick<Recipe, 'lines' | 'extras'>, items: StockItem[]): Pence {
  const lines = r.lines.reduce((n, l) => n + l.amount * (items.find((i) => i.id === l.itemId)?.costPence ?? 0), 0);
  return roundPence(lines) + r.extras.reduce((n, e) => n + e.costPence, 0);
}

export const exVat = (pricePence: Pence) => pricePence / (1 + VAT_RATE);

/** Gross profit on one plate as a % of its price without VAT, one decimal place. */
export function dishGp(pricePence: Pence, cost: Pence): number {
  const ex = exVat(pricePence);
  if (ex <= 0) return 0;
  return Math.round(((ex - cost) / ex) * 1000) / 10;
}

/** The lowest menu price (inc VAT, in steps of 25p) that reaches the target GP. */
export function priceForTarget(cost: Pence, targetPct: number): Pence {
  const ex = cost / (1 - targetPct / 100);
  const inc = ex * (1 + VAT_RATE);
  return Math.ceil(inc / 25 - 1e-9) * 25;
}

export const dishesUsing = (itemId: string, recipes: Recipe[]) => recipes.filter((r) => r.lines.some((l) => l.itemId === itemId));

/** How much of an item a site uses on a usual day, in the item's unit. */
export function dailyUse(itemId: string, recipes: Recipe[]): number {
  return recipes.reduce((n, r) => n + r.lines.filter((l) => l.itemId === itemId).reduce((m, l) => m + l.amount, 0) * r.perDay, 0);
}

/** "Runs out today", "Runs out tomorrow", "Lasts about 4 days", or null if nothing uses it. */
export function runsOutText(onHand: number, perDay: number): string | null {
  if (perDay <= 0) return null;
  const days = onHand / perDay;
  if (days < 1) return 'Runs out today';
  if (days < 2) return 'Runs out tomorrow';
  return `Lasts about ${Math.floor(days)} days`;
}

/** Allergens an ingredient carries that the dish's allergen record doesn't list. Flagged, never changed for you. */
export function allergenGaps(r: Pick<Recipe, 'lines' | 'allergens'>, items: (StockItem & { allergens?: Allergen[] })[]): { allergen: Allergen; itemId: string }[] {
  const out: { allergen: Allergen; itemId: string }[] = [];
  for (const l of r.lines) {
    for (const a of items.find((i) => i.id === l.itemId)?.allergens ?? []) {
      if (!r.allergens.includes(a) && !out.some((o) => o.allergen === a)) out.push({ allergen: a, itemId: l.itemId });
    }
  }
  return out;
}
