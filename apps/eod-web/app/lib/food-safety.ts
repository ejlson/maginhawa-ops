/**
 * Food-safety records for the signed-in site (HANDOFF.md §8a): allergens, cooking and cooling, probes,
 * deliveries and recalls, complaints, training and fitness to work, inspections and reviews.
 * Saved on this device in demo mode, with example records to start; connected mode will use the
 * SharePoint lists in docs/tech-plan/sharepoint/sharepoint-lists.json behind the same hook.
 * Records are only ever added to: versions, readings and answers are never edited in place.
 */
import { createContext, useContext } from 'react';
import type {
  AlertAction, Calibration, Certificate, Complaint, Delivery, Dish, DishVersion, FitnessAnswer, FoodAlert, KeepPolicy, Notice, Probe, Review, SiteCompliance, Visit,
} from '@maginhawa/core';

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

export const id = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export interface FoodSafetyValue {
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

export const Ctx = createContext<FoodSafetyValue | null>(null);

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
