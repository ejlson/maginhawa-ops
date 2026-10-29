/**
 * Example trading history for every site since March 2023, so head office can see the trends and
 * forecasts in demo mode. All figures are made up. Never used once the app is connected.
 */
import { addDays, SITES, weekday, type TradingDayRow } from '@maginhawa/core';

const FIRST_DAY = '2023-03-01';

/** Size, wage level and cash habits per site. Guanabana is the one to watch; Bintang the one doing well. */
const PROFILE: Record<string, { scale: number; wages: number; shortRate: number; recent?: number }> = {
  BIN: { scale: 1.15, wages: 0.265, shortRate: 0.01, recent: 1.08 },
  GUA: { scale: 0.8, wages: 0.335, shortRate: 0.02, recent: 0.88 },
  BEL: { scale: 1.3, wages: 0.29, shortRate: 0.06 },
  HOO: { scale: 1, wages: 0.28, shortRate: 0.02 },
  BUN: { scale: 1, wages: 0.29, shortRate: 0.02 },
  CAF: { scale: 0.55, wages: 0.245, shortRate: 0.01 },
  MKT: { scale: 1.05, wages: 0.275, shortRate: 0.02 },
  MCT: { scale: 0.95, wages: 0.28, shortRate: 0.03 },
};

// Sunday … Saturday.
const LUNCH = [1.3, 0.7, 0.75, 0.8, 0.85, 1.1, 1.4];
const DINNER = [1.0, 0.65, 0.7, 0.8, 1.0, 1.45, 1.55];
// January … December.
const SEASON = [0.85, 0.9, 0.95, 1, 1.02, 1.05, 1.06, 0.97, 1, 1.02, 1.05, 1.22];

function rng(seed: string) {
  let s = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 2166136261);
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

const cache = new Map<string, TradingDayRow[]>();

/** Every site's example days from March 2023 up to and including `lastDate`. Christmas Day is closed. */
export function demoHistory(lastDate: string): TradingDayRow[] {
  const hit = cache.get(lastDate);
  if (hit) return hit;
  const rows: TradingDayRow[] = [];
  const total = Math.round((Date.parse(`${lastDate}T00:00:00Z`) - Date.parse(`${FIRST_DAY}T00:00:00Z`)) / 86_400_000);
  for (const site of SITES) {
    const p = PROFILE[site.code]!;
    const r = rng(site.code);
    for (let i = 0; i <= total; i++) {
      const date = addDays(FIRST_DAY, i);
      const noise = () => 1 + (r() - 0.5) * 0.24;
      if (date.slice(5) === '12-25') continue;
      const wd = weekday(date);
      const growth = 1 + 0.06 * (i / 365);
      const recent = p.recent && total - i < 21 ? p.recent : 1;
      const k = p.scale * SEASON[+date.slice(5, 7) - 1]! * growth * recent;
      const lunch = Math.round(110000 * k * LUNCH[wd]! * noise());
      const dinner = Math.round(210000 * k * DINNER[wd]! * noise());
      const delivery = Math.round(30000 * k * (wd === 0 || wd >= 5 ? 1.3 : 1) * noise());
      const net = lunch + dinner + delivery;
      rows.push({
        siteCode: site.code,
        date,
        net: { lunch, dinner, delivery },
        covers: { lunch: Math.round(lunch / 1800), dinner: Math.round(dinner / 2600) },
        wages: Math.round(net * p.wages * (1 + (r() - 0.5) * 0.1)),
        cashDiff: r() < p.shortRate ? -2000 : 0,
      });
    }
  }
  cache.set(lastDate, rows);
  return rows;
}
