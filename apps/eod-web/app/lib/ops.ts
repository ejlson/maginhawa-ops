/**
 * The modules after stock: ordering and waste, recipes and dish costing, health and safety, planned
 * maintenance, and the export log (docs/reports/next-modules-scope.md). Saved on this device in demo
 * mode with example data, like food safety and stock; connected mode will use the SharePoint lists in
 * the scope behind the same hook. Records are only ever added to.
 */
import { createContext, useContext } from 'react';
import type {
  Accident, Equipment, Order, ParLevel, Pence, PriceChange, Recipe, SafetyCheck, ServiceSchedule, ServiceVisit, Supplier, SupplierItem, VisitResult, WasteEntry, WasteReason,
} from '@maginhawa/core';

export interface CallOut { equipmentId: string; date: string; title: string; detail: string }
export interface ExportLogEntry { at: string; by: string; what: string; range: string }

export interface OpsData {
  suppliers: Supplier[];
  supplierItems: SupplierItem[];
  pars: ParLevel[];
  orders: Order[];
  priceChanges: PriceChange[];
  waste: WasteEntry[];
  recipes: Recipe[];
  /** Target GP for the menu, % (head office). */
  targetGp: number;
  safetyChecks: SafetyCheck[];
  accidents: Accident[];
  callPoints: Record<string, string[]>;
  equipment: Equipment[];
  schedules: ServiceSchedule[];
  visits: ServiceVisit[];
  callOuts: CallOut[];
  exportsLog: ExportLogEntry[];
}

export interface OpsValue {
  data: OpsData;
  siteCode: string;
  supplier: (id: string) => Supplier | undefined;
  /** How an item is bought (its first supplier). */
  buying: (itemId: string) => SupplierItem | undefined;
  par: (itemId: string, siteCode?: string) => number | null;
  sendOrder: (supplierId: string, lines: { itemId: string; packs: number; packPrice: Pence }[], by: string) => string;
  receiveOrder: (orderId: string, missing: Record<string, number>, by: string) => void;
  /** Head office: accept or query a new price. Accepting updates the item's cost and the pack price. */
  settlePrice: (id: string, status: 'accepted' | 'queried', updateItemCost: (itemId: string, unitCost: Pence) => void) => void;
  logWaste: (x: { itemId: string; qty: number; reason: WasteReason; unitCost: Pence; by: string }) => void;
  setRecipePrice: (recipeId: string, pricePence: Pence) => void;
  addSafetyCheck: (c: Omit<SafetyCheck, 'id' | 'siteCode'>) => void;
  addAccident: (a: Omit<Accident, 'id' | 'siteCode' | 'daysOff' | 'hse'>) => void;
  updateAccident: (id: string, change: Partial<Pick<Accident, 'daysOff' | 'hse'>>) => void;
  logVisit: (v: { scheduleId: string; result: VisitResult; certificate: string | null; by: string }) => void;
  logExport: (e: Omit<ExportLogEntry, 'at'>) => void;
}

export const Ctx = createContext<OpsValue | null>(null);

export function useOps(): OpsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOps must be used inside OpsProvider');
  return v;
}
