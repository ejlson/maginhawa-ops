import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { itemsAt, perSite, SITES } from '@maginhawa/core';
import { storage } from './storage';
import { now } from './clock';
import { demoOps } from './ops-demo';
import { Ctx, type OpsData, type OpsValue } from './ops';

/** Recipes saved before each site had its own are copied onto every site. */
const normalise = (d: OpsData): OpsData => (d.recipes.some((r) => !r.siteCode) ? { ...d, recipes: perSite(d.recipes, SITES.map((s) => s.code)) } : d);

const KEY = 'mgh.ops.v1';
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function OpsProvider({ siteCode, businessDate, children, initial }: { siteCode: string; businessDate: string; children: ReactNode; initial?: OpsData }) {
  const [data, setData] = useState<OpsData>(() => normalise(initial ?? storage.get<OpsData | null>(KEY, null) ?? demoOps(businessDate)));
  const save = useCallback((change: (d: OpsData) => void) => {
    setData((prev) => {
      const next = structuredClone(prev);
      change(next);
      storage.set(KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<OpsValue>(() => ({
    data: { ...data, recipes: itemsAt(data.recipes, siteCode) }, siteCode,
    allRecipes: data.recipes,
    recipesFor: (code) => itemsAt(data.recipes, code),
    saveRecipe: (recipe) => {
      const id = recipe.id ?? newId('recipe');
      const at = recipe.siteCode ?? siteCode;
      save((d) => {
        const next = { ...recipe, id, siteCode: at };
        const i = d.recipes.findIndex((x) => x.id === id && x.siteCode === at);
        if (i >= 0) d.recipes[i] = next; else d.recipes.push(next);
      });
      return id;
    },
    supplier: (id) => data.suppliers.find((s) => s.id === id),
    buying: (itemId) => data.supplierItems.find((s) => s.itemId === itemId),
    par: (itemId, site = siteCode) => data.pars.find((p) => p.itemId === itemId && p.siteCode === site)?.par ?? null,
    sendOrder: (supplierId, lines, by) => {
      const id = newId('order');
      save((d) => {
        d.orders.push({ id, siteCode, supplierId, lines: lines.filter((l) => l.packs > 0), sentAt: now().toISOString(), sentBy: by, placedAt: null, placedBy: null, receivedAt: null, receivedBy: null, missing: {} });
      });
      return id;
    },
    markPlaced: (orderId, by) => save((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      if (o && !o.placedAt) { o.placedAt = now().toISOString(); o.placedBy = by; }
    }),
    receiveOrder: (orderId, missing, by) => save((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      if (!o || o.receivedAt) return;
      o.receivedAt = now().toISOString(); o.receivedBy = by; o.missing = missing;
    }),
    settlePrice: (id, status, updateItemCost) => save((d) => {
      const p = d.priceChanges.find((x) => x.id === id);
      if (!p || p.status !== 'open') return;
      p.status = status;
      if (status === 'accepted') {
        const si = d.supplierItems.find((s) => s.itemId === p.itemId && s.supplierId === p.supplierId);
        if (si) { si.packPrice = p.to; updateItemCost(p.itemId, Math.round(p.to / si.packSize)); }
      }
    }),
    logWaste: (x) => save((d) => { d.waste.push({ ...x, id: newId('waste'), siteCode, at: now().toISOString() }); }),
    setRecipePrice: (recipeId, pricePence, at = siteCode) => save((d) => {
      const r = d.recipes.find((x) => x.id === recipeId && x.siteCode === at);
      if (r) r.pricePence = pricePence;
    }),
    addSafetyCheck: (c) => save((d) => { d.safetyChecks.push({ ...c, id: newId('check'), siteCode }); }),
    addAccident: (a) => save((d) => { d.accidents.push({ ...a, id: newId('accident'), siteCode, daysOff: null, hse: null }); }),
    updateAccident: (id, change) => save((d) => {
      const a = d.accidents.find((x) => x.id === id);
      if (a) Object.assign(a, change);
    }),
    logVisit: (v) => save((d) => {
      const s = d.schedules.find((x) => x.id === v.scheduleId);
      d.visits.push({ ...v, id: newId('visit'), businessDate: businessDate, at: now().toISOString() });
      if (s) s.booked = null;
    }),
    logExport: (e) => save((d) => { d.exportsLog.push({ ...e, at: now().toISOString() }); }),
  }), [data, siteCode, businessDate, save]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
