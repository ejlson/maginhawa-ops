import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { storage } from './storage';
import { now } from './clock';
import { demoOps } from './ops-demo';
import { Ctx, type OpsData, type OpsValue } from './ops';

const KEY = 'mgh.ops.v1';
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function OpsProvider({ siteCode, businessDate, children, initial }: { siteCode: string; businessDate: string; children: ReactNode; initial?: OpsData }) {
  const [data, setData] = useState<OpsData>(() => initial ?? storage.get<OpsData | null>(KEY, null) ?? demoOps(businessDate));
  const save = useCallback((change: (d: OpsData) => void) => {
    setData((prev) => {
      const next = structuredClone(prev);
      change(next);
      storage.set(KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<OpsValue>(() => ({
    data, siteCode,
    supplier: (id) => data.suppliers.find((s) => s.id === id),
    buying: (itemId) => data.supplierItems.find((s) => s.itemId === itemId),
    par: (itemId, site = siteCode) => data.pars.find((p) => p.itemId === itemId && p.siteCode === site)?.par ?? null,
    sendOrder: (supplierId, lines, by) => {
      const id = newId('order');
      save((d) => {
        d.orders.push({ id, siteCode, supplierId, lines: lines.filter((l) => l.packs > 0), sentAt: now().toISOString(), sentBy: by, receivedAt: null, receivedBy: null, missing: {} });
      });
      return id;
    },
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
    setRecipePrice: (recipeId, pricePence) => save((d) => {
      const r = d.recipes.find((x) => x.id === recipeId);
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
