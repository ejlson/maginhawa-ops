/**
 * Example stock for demo mode: one group item list, the same five areas at every site, three regular
 * counts, and past counts dated from today's trading day. Names and figures are made up.
 */
import { addDays, OPEN_SITE_CODES, weekday, type StockArea, type StockCount, type StockItem, type StockPlan } from '@maginhawa/core';
import type { StockData } from './stock';

const I = (id: string, name: string, category: string, unit: string, costPence: number | null, parts = false): StockItem =>
  ({ id, name, category, unit, parts, costPence, active: true });

export const DEMO_ITEMS: StockItem[] = [
  I('pork', 'Pork belly', 'Meat and fish', 'kg', 980, true),
  I('chicken', 'Chicken thigh 5kg', 'Meat and fish', 'bags', 1900),
  I('ribeye', 'Ribeye 8oz', 'Meat and fish', 'portions', 885),
  I('prawns', 'Tiger prawns', 'Meat and fish', 'kg', 1650, true),
  I('lumpia', 'Lumpia, frozen', 'Frozen', 'packs', 640),
  I('icecream', 'Ube ice cream', 'Frozen', 'tubs', 1150),
  I('rice', 'Jasmine rice 20kg', 'Dry goods', 'bags', 2600),
  I('soy', 'Soy sauce 1.9L', 'Dry goods', 'bottles', 520),
  I('vinegar', 'Cane vinegar 1L', 'Dry goods', 'bottles', 310),
  I('ubejam', 'Ube jam', 'Dry goods', 'jars', null),
  I('pandan', 'Pandan extract', 'Dry goods', 'bottles', null),
  I('rum', 'Tanduay rum 70cl', 'Spirits', 'bottles', 1420, true),
  I('gin', "Gordon's gin 70cl", 'Spirits', 'bottles', 1310, true),
  I('jameson', 'Jameson 70cl', 'Spirits', 'bottles', 1840, true),
  I('vodka', 'Smirnoff 70cl', 'Spirits', 'bottles', 1190, true),
  I('calamansi', 'Calamansi syrup 1L', 'Soft drinks', 'bottles', 680),
  I('prosecco', 'Prosecco DOC', 'Wine', 'bottles', 710),
  I('red', 'House red', 'Wine', 'bottles', 590),
  I('white', 'House white', 'Wine', 'bottles', 560),
  I('sanmig', 'San Miguel 330ml', 'Beer', 'bottles', 92),
  I('guinness', 'Guinness keg 50L', 'Beer', 'kegs', 16200, true),
  I('coke', 'Coke bag-in-box', 'Soft drinks', 'boxes', 7400),
];

const AREAS: [string, string, string[]][] = [
  ['walkin', 'Walk-in chiller', ['pork', 'chicken', 'ribeye']],
  ['freezer', 'Freezer', ['prawns', 'lumpia', 'icecream']],
  ['dry', 'Dry store', ['rice', 'soy', 'vinegar', 'ubejam', 'pandan']],
  ['bar', 'Bar', ['rum', 'gin', 'jameson', 'vodka', 'calamansi', 'prosecco', 'red', 'white', 'sanmig']],
  ['cellar', 'Cellar', ['guinness', 'coke']],
];

/** Typical amount on the shelf. */
const BASE: Record<string, number> = {
  pork: 14.5, chicken: 6, ribeye: 30, prawns: 6.2, lumpia: 22, icecream: 9, rice: 5, soy: 8, vinegar: 10, ubejam: 6, pandan: 4,
  rum: 6.4, gin: 8.2, jameson: 4, vodka: 7.5, calamansi: 5, prosecco: 18, red: 24, white: 22, sanmig: 70, guinness: 2.5, coke: 3,
};

/** A steady wobble from the names, so each site and count differs but the demo is the same every time. */
function wobble(key: string): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return 0.8 + (h % 40) / 100;
}

function qtyFor(site: string, item: StockItem, n: number): number {
  const q = BASE[item.id]! * wobble(`${site}|${item.id}|${n}`);
  return item.parts ? Math.round(q * 10) / 10 : Math.round(q);
}

const BY = ['Jo Reyes', 'Sam Cruz', 'Maria S.'];

export function demoStock(businessDate: string): StockData {
  const areas: StockArea[] = [];
  const plans: StockPlan[] = [];
  const counts: StockCount[] = [];
  // The last full count was the Sunday before last; the one before that, 4 weeks earlier.
  const lastFull = addDays(businessDate, -weekday(businessDate) - 7);
  const prevFull = addDays(lastFull, -28);
  // The last Monday or Thursday before today, for meat and fish.
  let meatDay = addDays(businessDate, -1);
  while (![1, 4].includes(weekday(meatDay))) meatDay = addDays(meatDay, -1);

  for (const site of OPEN_SITE_CODES) {
    for (const [id, name, itemIds] of AREAS) areas.push({ id: `${site}-${id}`, siteCode: site, name, itemIds });
    plans.push(
      { id: `${site}-bar`, siteCode: site, name: 'Bar spot count', kind: 'spot', schedule: { kind: 'daily' }, itemIds: ['rum', 'gin', 'jameson', 'vodka', 'prosecco'] },
      { id: `${site}-meat`, siteCode: site, name: 'Meat and fish', kind: 'spot', schedule: { kind: 'weekdays', days: [1, 4] }, itemIds: ['pork', 'chicken', 'ribeye', 'prawns'] },
      { id: `${site}-full`, siteCode: site, name: 'Full stocktake', kind: 'full', schedule: { kind: 'every4weeks', from: prevFull } },
    );

    const make = (planId: string, name: string, kind: 'full' | 'spot', date: string, itemIds: string[] | null, n: number, at = '10:30') => {
      const siteAreas = AREAS.map(([id, area, ids]) => ({ id: `${site}-${id}`, name: area, itemIds: itemIds ? ids.filter((i) => itemIds.includes(i)) : ids }))
        .filter((a) => a.itemIds.length > 0);
      const lines: StockCount['lines'] = {};
      siteAreas.flatMap((a) => a.itemIds).forEach((id, k) => {
        const item = DEMO_ITEMS.find((i) => i.id === id)!;
        lines[id] = { qty: qtyFor(site, item, n), by: BY[k % 3]!, at: `${date}T${at}:00Z` };
      });
      const costs = Object.fromEntries(Object.keys(lines).map((id) => [id, DEMO_ITEMS.find((i) => i.id === id)!.costPence]));
      counts.push({
        id: `${site}-${planId}-${date}`, siteCode: site, planId: `${site}-${planId}`, name, kind, businessDate: date,
        startedAt: `${date}T09:00:00Z`, startedBy: BY[0]!, areas: siteAreas, lines, costs,
        sentAt: `${date}T${at}:00Z`, sentBy: BY[0]!, corrections: [],
      });
      return counts[counts.length - 1]!;
    };

    const prev = make('full', 'Full stocktake', 'full', prevFull, null, 1);
    // Belly hasn't sent its latest full count yet: head office sees it as late.
    const last = site === 'BEL' ? null : make('full', 'Full stocktake', 'full', lastFull, null, 2);
    // Two figures to talk about: Bunso's Prosecco was 18 last time; Kentish Town's ribeye dropped from 30 to 11.
    if (site === 'BUN' && last) last.lines.prosecco!.qty = 18;
    if (site === 'MKT') { prev.lines.ribeye!.qty = 30; if (last) last.lines.ribeye!.qty = 11; }
    make('meat', 'Meat and fish', 'spot', meatDay, ['pork', 'chicken', 'ribeye', 'prawns'], 3, '10:12');
    make('bar', 'Bar spot count', 'spot', addDays(businessDate, -1), ['rum', 'gin', 'jameson', 'vodka', 'prosecco'], 4, '23:40');
  }
  return { items: DEMO_ITEMS.map((i) => ({ ...i })), areas, plans, counts };
}
