import { lastQty, suggestPacks, type StockCount, type StockItem } from '@maginhawa/core';
import type { OpsValue } from './ops';

/** What's on the shelf: the latest sent count for that item at the site. */
export const onHand = (counts: StockCount[], siteCode: string, itemId: string) => lastQty(counts, siteCode, itemId, null);

export interface Suggestion { item: StockItem; onHand: number | null; par: number; packs: number; pack: string; packSize: number; packPrice: number; supplierId: string }

/** Every active item with its suggested order, for one site. Items below their usual level have packs > 0. */
export function suggestions(items: StockItem[], counts: StockCount[], ops: OpsValue, siteCode: string): Suggestion[] {
  const out: Suggestion[] = [];
  for (const item of items) {
    if (!item.active) continue;
    const buy = ops.buying(item.id);
    const par = ops.par(item.id, siteCode);
    if (!buy || par === null) continue;
    const have = onHand(counts, siteCode, item.id);
    out.push({ item, onHand: have, par, packs: have === null ? 0 : suggestPacks(have, par, buy.packSize), pack: buy.pack, packSize: buy.packSize, packPrice: buy.packPrice, supplierId: buy.supplierId });
  }
  return out;
}

/** "4 kg", "half a box" style: the number and the unit, trimmed. */
export const amountText = (n: number, unit: string) => `${Number.isInteger(n) ? n : n.toFixed(1)} ${n === 1 ? unit.replace(/s$/, '') : unit}`;

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Packs in words: "3 boxes", "1 bag". */
export function packsText(n: number, pack: string): string {
  const word = pack.replace(/^[\d.]+\s*(kg|g|l|ml)?\s*/i, '').replace(/^case of \d+$/, 'case').replace(/^box of \d+$/, 'box') || 'pack';
  if (n === 1) return `1 ${word}`;
  const pl = word.endsWith('x') || word.endsWith('s') ? `${word}es` : `${word}s`;
  return `${n} ${pl}`;
}

/** Download a text file (CSV); quietly does nothing where downloads aren't possible (tests, old browsers). */
export function download(name: string, text: string, type = 'text/csv;charset=utf-8') {
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch { /* nothing to do */ }
}
