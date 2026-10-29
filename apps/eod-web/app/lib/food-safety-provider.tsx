import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { SiteCompliance } from '@maginhawa/core';
import { storage } from './storage';
import { now } from './clock';
import { demoFoodSafety } from './food-safety-demo';
import { type FoodSafetyData, id, type FoodSafetyValue, Ctx } from './food-safety';

const KEY = 'mgh.food-safety.v1';
export function FoodSafetyProvider({ siteCode, businessDate, children, initial }: { siteCode: string; businessDate: string; children: ReactNode; initial?: FoodSafetyData }) {
  const [data, setData] = useState<FoodSafetyData>(() => initial ?? storage.get<FoodSafetyData | null>(KEY, null) ?? demoFoodSafety(businessDate, siteCode));
  const save = useCallback((change: (d: FoodSafetyData) => FoodSafetyData) => {
    setData((prev) => {
      const next = change(structuredClone(prev));
      storage.set(KEY, next);
      return next;
    });
  }, []);

  const forSite = useCallback((code: string): FoodSafetyValue['site'] => ({
    staff: data.staff.filter((s) => s.siteCode === code && !s.leftOn),
    dishes: data.dishes.filter((d) => d.siteCode === null || d.siteCode === code),
    cooks: data.cooks.filter((c) => c.siteCode === code),
    probes: data.probes.filter((p) => p.siteCode === code),
    deliveries: data.deliveries.filter((d) => d.siteCode === code),
    complaints: data.complaints.filter((c) => c.siteCode === code),
    certificates: data.certificates.filter((c) => c.siteCode === code),
    fitness: data.fitness.filter((f) => f.siteCode === code),
    compliance: data.compliance.find((c) => c.siteCode === code),
    reviews: data.reviews.filter((r) => r.siteCode === code),
  }), [data]);

  const value = useMemo<FoodSafetyValue>(() => {
    const onSite = (change: (c: SiteCompliance) => void) => save((d) => {
      let c = d.compliance.find((x) => x.siteCode === siteCode);
      if (!c) d.compliance.push(c = { siteCode, council: '', registeredOn: '', visits: [], notices: [] });
      change(c);
      return d;
    });
    return {
      data, siteCode, site: forSite(siteCode), forSite,
      setKeep: (keep) => save((d) => ({ ...d, keep })),
      addDishVersion: (dishId, v) => save((d) => {
        const dish = d.dishes.find((x) => x.id === dishId);
        if (dish) { dish.versions.push(v); dish.readBy[v.by] = v.version; }
        return d;
      }),
      addDish: (x, v) => {
        const newId = id('dish');
        save((d) => ({ ...d, dishes: [...d.dishes, { id: newId, name: x.name, course: x.course, siteCode, versions: [v], readBy: { [v.by]: v.version } }] }));
        return newId;
      },
      markRead: (dishId, person) => save((d) => {
        const dish = d.dishes.find((x) => x.id === dishId);
        if (dish) dish.readBy[person] = dish.versions[dish.versions.length - 1]?.version ?? 0;
        return d;
      }),
      addCook: (c) => save((d) => ({ ...d, cooks: [...d.cooks, { ...c, id: id('cook'), siteCode }] })),
      addCoolingCheck: (cookId, tempC) => save((d) => {
        d.cooks.find((c) => c.id === cookId)?.checks.push({ at: now().toISOString(), tempC });
        return d;
      }),
      intoFridge: (cookId) => save((d) => {
        const c = d.cooks.find((x) => x.id === cookId);
        if (c && !c.inFridgeAt) c.inFridgeAt = now().toISOString();
        return d;
      }),
      calibrate: (probeId, c) => save((d) => {
        d.probes.find((p) => p.id === probeId)?.calibrations.push(c);
        return d;
      }),
      addDelivery: (x) => save((d) => ({ ...d, deliveries: [...d.deliveries, { ...x, id: id('delivery'), siteCode }] })),
      actOnAlert: (alertId, action, by) => save((d) => ({ ...d, alertActions: { ...d.alertActions, [`${alertId}|${siteCode}`]: { action, by, at: now().toISOString() } } })),
      addComplaint: (c) => save((d) => ({ ...d, complaints: [...d.complaints, { ...c, id: id('complaint'), siteCode }] })),
      addCertificate: (c) => save((d) => ({ ...d, certificates: [...d.certificates, { ...c, siteCode }] })),
      addFitness: (a) => save((d) => ({ ...d, fitness: [...d.fitness, { ...a, siteCode }] })),
      addVisit: (v) => onSite((c) => { c.visits.push({ ...v, id: id('visit') }); }),
      addNotice: (n) => onSite((c) => { c.notices.push({ ...n, id: id('notice'), closedOn: null }); }),
      closeNotice: (noticeId) => onSite((c) => {
        const n = c.notices.find((x) => x.id === noticeId);
        if (n) n.closedOn = now().toISOString().slice(0, 10);
      }),
      addReview: (r) => save((d) => ({ ...d, reviews: [...d.reviews, { ...r, id: id('review'), siteCode }] })),
    };
  }, [data, siteCode, forSite, save]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
