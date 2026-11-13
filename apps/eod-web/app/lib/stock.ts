/**
 * Stock counts for the signed-in site (docs/reports/stock-count-scope.md, phase 1).
 * Saved on this device in demo mode, with example items, areas and past counts to start, like food
 * safety. Connected mode will use the StockItems, StockCounts and StockCountLines SharePoint lists
 * behind the same hook. A sent count is locked; corrections are added, never written over.
 */
import { createContext, useContext } from 'react';
import type { Pence, StockArea, StockCount, StockItem, StockPlan } from '@maginhawa/core';

export interface StockData {
  /** The group's item list and costs (head office). */
  items: StockItem[];
  /** Each site's storage areas, items in shelf order. */
  areas: StockArea[];
  /** The counts each site does regularly. */
  plans: StockPlan[];
  counts: StockCount[];
}

export interface StockValue {
  data: StockData;
  siteCode: string;
  /** This site's plans, areas and counts (newest first). */
  site: { plans: StockPlan[]; areas: StockArea[]; counts: StockCount[] };
  item: (id: string) => StockItem | undefined;
  /** Starts a count from a plan (or carries on the one already open) and returns its id. */
  start: (planId: string, by: string) => string;
  /** Saves one figure as it's typed. Ignored once the count is sent. */
  setLine: (countId: string, itemId: string, qty: number | null, by: string) => void;
  /** "It's right": someone looked at a big change from last time. */
  markOkay: (countId: string, itemId: string) => void;
  send: (countId: string, by: string) => void;
  /** Supervisor and above, after sending: keeps the old figure. */
  correct: (countId: string, itemId: string, to: number, reason: string, by: string) => void;
  /** Head office: the item list and costs. */
  setItem: (item: StockItem) => void;
  addItem: (x: { name: string; category: string; unit: string; parts: boolean; costPence: Pence | null }) => void;
}

export const Ctx = createContext<StockValue | null>(null);

export function useStock(): StockValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStock must be used inside StockProvider');
  return v;
}
