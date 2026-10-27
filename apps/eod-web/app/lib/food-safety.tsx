/**
 * Food-safety records for the signed-in site (HANDOFF.md §8a): allergens, cooking and cooling, probes,
 * deliveries and recalls, complaints, training and fitness to work, inspections and reviews.
 * Saved on this device in demo mode, with example records to start; connected mode will use the
 * SharePoint lists in docs/tech-plan/sharepoint/sharepoint-lists.json behind the same hook.
 * Records are only ever added to: versions, readings and answers are never edited in place.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  type AlertAction, type Calibration, type Certificate, type Complaint, type Delivery, type Dish, type DishVersion, type FitnessAnswer,
  type FoodAlert, type KeepPolicy, type Notice, type Probe, type Review, type SiteCompliance, type Visit,
} from '@maginhawa/core';
import { storage } from './storage';
import { now } from './clock';
import { demoFoodSafety } from './food-safety-demo';

export interface CookBatch {
  id: string;
  siteCode: string;
  dish: string;
  kind: 'cook' | 'reheat';
  tempC: number;
  probeId: string;
  at: string;
  by: string;
  /** Set when cooked food is put to cool for the fridge; null if it's served or hot-held. */
  coolingStartedAt: string | null;
  checks: { at: string; tempC: number }[];
  inFridgeAt: string | null;
}

export interface StaffMember { name: string; job: string; siteCode: string; leftOn: string | null }

export interface FoodSafetyData {
  keep: KeepPolicy;
  staff: StaffMember[];
  dishes: Dish[];
  cooks: CookBatch[];
  probes: (Probe & { siteCode: string })[];
  approvedSuppliers: string[];
  deliveries: Delivery[];
  alerts: FoodAlert[];
  /** `${alertId}|${siteCode}` → what the site did about it. */
  alertActions: Record<string, { action: AlertAction; by: string; at: string }>;
  complaints: Complaint[];
  certificates: (Certificate & { siteCode: string })[];
  fitness: (FitnessAnswer & { siteCode: string })[];
  compliance: SiteCompliance[];
  reviews: Review[];
}

const KEY = 'mgh.food-safety.v1';
const id = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

interface FoodSafetyValue {
  data: FoodSafetyData;
  siteCode: string;
  /** Only this site's records (dishes on every menu count for every site). */
  site: {
    staff: StaffMember[]; dishes: Dish[]; cooks: CookBatch[]; probes: (Probe & { siteCode: string })[]; deliveries: Delivery[];
    complaints: Complaint[]; certificates: (Certificate & { siteCode: string })[]; fitness: (FitnessAnswer & { siteCode: string })[];
    compliance: SiteCompliance | undefined; reviews: Review[];
  };
  /** The same for any site: head office's records pack. */
  forSite: (siteCode: string) => FoodSafetyValue['site'];
  setKeep: (keep: KeepPolicy) => void;
  addDishVersion: (dishId: string, v: DishVersion) => void;
  addDish: (d: Pick<Dish, 'name' | 'course'>, v: DishVersion) => string;
  markRead: (dishId: string, person: string) => void;
  addCook: (c: Omit<CookBatch, 'id' | 'siteCode'>) => void;
  addCoolingCheck: (cookId: string, tempC: number) => void;
  intoFridge: (cookId: string) => void;
  calibrate: (probeId: string, c: Calibration) => void;
  addDelivery: (d: Omit<Delivery, 'id' | 'siteCode'>) => void;
  actOnAlert: (alertId: string, action: AlertAction, by: string) => void;
  addComplaint: (c: Omit<Complaint, 'id' | 'siteCode'>) => void;
  addCertificate: (c: Certificate) => void;
  addFitness: (a: FitnessAnswer) => void;
  addVisit: (v: Omit<Visit, 'id'>) => void;
  addNotice: (n: Omit<Notice, 'id' | 'closedOn'>) => void;
  closeNotice: (noticeId: string) => void;
  addReview: (r: Omit<Review, 'id' | 'siteCode'>) => void;
}

const Ctx = createContext<FoodSafetyValue | null>(null);

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

export function useFoodSafety(): FoodSafetyValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFoodSafety must be used inside FoodSafetyProvider');
  return v;
}

/** "27 Oct", "27 Oct 2025" when not this year. */
export function shortDate(iso: string, today: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' });
}

export const hm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

/** "−19°C", "4.2°C" */
export const degrees = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n)}°C`;
