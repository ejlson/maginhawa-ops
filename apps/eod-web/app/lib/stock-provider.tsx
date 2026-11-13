import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { areasFor, costsNow, sendProblem } from '@maginhawa/core';
import { storage } from './storage';
import { now } from './clock';
import { demoStock } from './stock-demo';
import { Ctx, type StockData, type StockValue } from './stock';

const KEY = 'mgh.stock.v1';
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function StockProvider({ siteCode, businessDate, children, initial }: { siteCode: string; businessDate: string; children: ReactNode; initial?: StockData }) {
  const [data, setData] = useState<StockData>(() => initial ?? storage.get<StockData | null>(KEY, null) ?? demoStock(businessDate));
  const save = useCallback((change: (d: StockData) => void) => {
    setData((prev) => {
      const next = structuredClone(prev);
      change(next);
      storage.set(KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<StockValue>(() => {
    const site = {
      plans: data.plans.filter((p) => p.siteCode === siteCode),
      areas: data.areas.filter((a) => a.siteCode === siteCode),
      counts: data.counts.filter((c) => c.siteCode === siteCode).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    };
    return {
      data, siteCode, site,
      item: (id) => data.items.find((i) => i.id === id),
      start: (planId, by) => {
        const open = data.counts.find((c) => c.planId === planId && c.siteCode === siteCode && !c.sentAt);
        if (open) return open.id;
        const plan = data.plans.find((p) => p.id === planId);
        const id = newId('count');
        if (!plan) return id;
        save((d) => {
          d.counts.push({
            id, siteCode, planId, name: plan.name, kind: plan.kind, businessDate, startedAt: now().toISOString(), startedBy: by,
            areas: areasFor(plan, d.areas, d.items), lines: {}, sentAt: null, sentBy: null, corrections: [],
          });
        });
        return id;
      },
      setLine: (countId, itemId, qty, by) => save((d) => {
        const c = d.counts.find((x) => x.id === countId);
        if (!c || c.sentAt) return;
        if (qty === null) delete c.lines[itemId];
        else c.lines[itemId] = { qty, by, at: now().toISOString(), okay: c.lines[itemId]?.qty === qty ? c.lines[itemId]?.okay : undefined };
      }),
      markOkay: (countId, itemId) => save((d) => {
        const l = d.counts.find((x) => x.id === countId)?.lines[itemId];
        if (l) l.okay = true;
      }),
      send: (countId, by) => save((d) => {
        const c = d.counts.find((x) => x.id === countId);
        if (!c || sendProblem(c)) return;
        c.sentAt = now().toISOString();
        c.sentBy = by;
        c.costs = costsNow(c, d.items);
      }),
      correct: (countId, itemId, to, reason, by) => save((d) => {
        const c = d.counts.find((x) => x.id === countId);
        if (!c?.sentAt) return;
        const fixes = c.corrections.filter((x) => x.itemId === itemId);
        const from = fixes.length ? fixes[fixes.length - 1]!.to : c.lines[itemId]?.qty ?? 0;
        c.corrections.push({ itemId, from, to, reason: reason.trim(), by, at: now().toISOString() });
      }),
      setItem: (item) => save((d) => {
        const i = d.items.findIndex((x) => x.id === item.id);
        if (i >= 0) d.items[i] = item;
      }),
      addItem: (x) => save((d) => {
        const id = newId('item');
        d.items.push({ ...x, id, active: true });
        // It goes at the end of every area that already holds that kind of item (wine with the wine).
        const same = new Set(d.items.filter((i) => i.category === x.category && i.id !== id).map((i) => i.id));
        for (const a of d.areas) if (a.itemIds.some((i) => same.has(i))) a.itemIds.push(id);
      }),
    };
  }, [data, siteCode, businessDate, save]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
