/**
 * Food safety: the records that show "due diligence" under the Food Safety Act 1990 (s.21).
 * Pure rules, no storage. Scope and sources in HANDOFF.md §8a. Limits marked "guidance" come
 * from FSA guidance or other regulations and should be confirmed with an environmental health officer.
 */
import { addDays, daysBetween } from './data-quality';
import { evaluate, type AnswerValue, type ChecklistRun, type ChecklistTemplate } from './checklists';

// ── 1 · Corrections to locked records ─────────────────────────────────

/** A change to an answer after the checklist was finished. The old value is kept. */
export interface Correction {
  previous: AnswerValue;
  value: AnswerValue;
  reason: string;
  by: string;
  /** Server time. */
  at: string;
}

/** What's wrong with a correction, or null if it can be saved. */
export function correctionProblem(c: { previous: AnswerValue; value: AnswerValue; reason: string }): string | null {
  if (c.value === null || c.value === undefined || c.value === '') return 'Enter the right answer.';
  if (JSON.stringify(c.previous) === JSON.stringify(c.value)) return "That's the same as the answer already saved.";
  if (c.reason.trim().length < 5) return 'Say why it needs correcting.';
  return null;
}

// ── 2 · Records for an inspector ──────────────────────────────────────

export const PACK_SECTIONS = ['checks', 'faults', 'allergens', 'cooking', 'probes', 'deliveries', 'training', 'complaints', 'inspections'] as const;
export type PackSection = (typeof PACK_SECTIONS)[number];

export const PACK_LABELS: Record<PackSection, string> = {
  checks: 'Temperatures and checks', faults: 'Faults and what we did', allergens: 'Allergen matrix and changes',
  cooking: 'Cooking and cooling', probes: 'Probe calibration', deliveries: 'Deliveries and suppliers',
  training: 'Training certificates', complaints: 'Complaints', inspections: 'Inspections and notices',
};

/** Notes printed with a section: what is deliberately left out. */
export const PACK_NOTES: Partial<Record<PackSection, string>> = {
  training: 'Health answers are left out.',
  complaints: 'Customer details are left out.',
};

export type PackPreset = '4w' | '3m' | '12m';
export const PACK_PRESETS: Record<PackPreset, { label: string; days: number }> = {
  '4w': { label: '4 weeks', days: 28 }, '3m': { label: '3 months', days: 91 }, '12m': { label: '12 months', days: 365 },
};

export interface DateRange { from: string; to: string }

/** The range ending today (inclusive). */
export const packRange = (preset: PackPreset, today: string): DateRange => ({ from: addDays(today, -(PACK_PRESETS[preset].days - 1)), to: today });

export const inRange = (date: string, r: DateRange) => date.slice(0, 10) >= r.from && date.slice(0, 10) <= r.to;

export function validRange(r: DateRange, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.from) || !/^\d{4}-\d{2}-\d{2}$/.test(r.to)) return 'Pick both dates.';
  if (r.from > r.to) return 'The start date is after the end date.';
  if (r.to > today) return "The end date can't be in the future.";
  return null;
}

// ── 3 · How long records are kept ─────────────────────────────────────

export const RECORD_TYPES = ['checks', 'faults', 'allergens', 'complaints', 'training', 'fitness', 'inspections'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export interface KeepRule {
  months: number;
  /** Counted from when the person leaves, not from the record's date. */
  fromLeaving?: boolean;
}
export type KeepPolicy = Record<RecordType, KeepRule>;

export const RECORD_LABELS: Record<RecordType, { title: string; sub?: string }> = {
  checks: { title: 'Temperatures and checks', sub: 'Including corrections' },
  faults: { title: 'Faults and fixes' },
  allergens: { title: 'Allergen matrix versions' },
  complaints: { title: 'Complaints and incidents' },
  training: { title: 'Training certificates', sub: 'Counted from when the person leaves' },
  fitness: { title: 'Fit-to-work answers', sub: 'Health data, kept short (UK GDPR)' },
  inspections: { title: 'Inspections and notices' },
};

/** Suggestions only: there's no fixed legal period for food-safety records (HANDOFF.md §8a). */
export const DEFAULT_KEEP: KeepPolicy = {
  checks: { months: 24 }, faults: { months: 24 }, allergens: { months: 36 }, complaints: { months: 36 },
  training: { months: 24, fromLeaving: true }, fitness: { months: 6 }, inspections: { months: 72 },
};

export function keepText(r: KeepRule): string {
  const span = r.months % 12 === 0 ? `${r.months / 12} year${r.months === 12 ? '' : 's'}` : `${r.months} month${r.months === 1 ? '' : 's'}`;
  return r.fromLeaving ? `Leaves + ${span}` : span;
}

const addMonths = (date: string, months: number): string => {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
};

/** The last day a record must be kept. Null while the person still works here. */
export function keepUntil(type: RecordType, recordDate: string, policy: KeepPolicy, leftOn?: string | null): string | null {
  const rule = policy[type];
  if (rule.fromLeaving) return leftOn ? addMonths(leftOn, rule.months) : null;
  return addMonths(recordDate, rule.months);
}

/** Records past their keep date. They are only listed: head office must say yes before anything is cleared. */
export function dueToClear<T extends { type: RecordType; date: string; leftOn?: string | null }>(records: T[], policy: KeepPolicy, today: string): T[] {
  return records.filter((r) => {
    const until = keepUntil(r.type, r.date, policy, r.leftOn);
    return until !== null && until < today;
  });
}

// ── 4 · Allergens ─────────────────────────────────────────────────────

/** The 14 allergens that must be declared in the UK (Food Information Regulations 2014). */
export const ALLERGENS = [
  'Celery', 'Cereals with gluten', 'Crustaceans', 'Eggs', 'Fish', 'Lupin', 'Milk',
  'Molluscs', 'Mustard', 'Tree nuts', 'Peanuts', 'Sesame', 'Soya', 'Sulphites',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export interface DishVersion {
  version: number;
  allergens: Allergen[];
  note: string;
  by: string;
  at: string;
}

export interface Dish {
  id: string;
  name: string;
  course: string;
  /** null = on every site's menu. */
  siteCode: string | null;
  versions: DishVersion[];
  /** Person → the version they last confirmed reading. */
  readBy: Record<string, number>;
}

export const currentVersion = (d: Pick<Dish, 'versions'>): DishVersion | undefined => d.versions[d.versions.length - 1];

export function allergenChange(before: Allergen[], after: Allergen[]): { added: Allergen[]; removed: Allergen[] } {
  return { added: after.filter((a) => !before.includes(a)), removed: before.filter((a) => !after.includes(a)) };
}

/** "Added sulphites", "Removed milk, added eggs", "No change to allergens". */
export function changeText(c: { added: Allergen[]; removed: Allergen[] }): string {
  const list = (xs: Allergen[]) => xs.map((x) => x.toLowerCase()).join(', ');
  const parts = [c.removed.length ? `removed ${list(c.removed)}` : '', c.added.length ? `added ${list(c.added)}` : ''].filter(Boolean);
  const s = parts.join(', ');
  return s ? s[0]!.toUpperCase() + s.slice(1) : 'No change to allergens';
}

/** A new version, or an error if nothing changed. Versions are never edited or removed. */
export function nextVersion(d: Pick<Dish, 'versions'>, allergens: Allergen[], note: string, by: string, at: string): DishVersion | string {
  const cur = currentVersion(d);
  const sorted = ALLERGENS.filter((a) => allergens.includes(a));
  if (cur && JSON.stringify(cur.allergens) === JSON.stringify(sorted)) return 'Nothing has changed.';
  if (cur && !note.trim()) return 'Say why it changed, e.g. a new supplier.';
  return { version: (cur?.version ?? 0) + 1, allergens: sorted, note: note.trim(), by, at };
}

export const hasRead = (d: Dish, person: string) => (d.readBy[person] ?? 0) >= (currentVersion(d)?.version ?? 0);

export const readCount = (d: Dish, people: string[]) => people.filter((p) => hasRead(d, p)).length;

// ── 5 · Cooking, reheating, cooling, fridges ─────────────────────────

/** Guidance: core temperature after cooking or reheating. */
export const COOK_MIN_C = 75;
export const REHEAT_MIN_C = 75;
export const HOT_HOLD_MIN_C = 63;
/** Legal limit for chilled food is 8°C; we warn from 5°C. */
export const FRIDGE_WARN_C = 5;
export const FRIDGE_MAX_C = 8;
/** Guidance: cooked food into the fridge within 90 minutes. */
export const COOLING_MINUTES = 90;

export function coreTempResult(c: number): { safe: boolean; text: string } {
  return c >= COOK_MIN_C ? { safe: true, text: `Safe: ${COOK_MIN_C}°C or above` } : { safe: false, text: `Too low: needs ${COOK_MIN_C}°C or above` };
}

export function fridgeBand(c: number): 'ok' | 'warn' | 'fail' {
  if (c > FRIDGE_MAX_C) return 'fail';
  if (c > FRIDGE_WARN_C) return 'warn';
  return 'ok';
}

export interface CoolingState {
  state: 'cooling' | 'late' | 'done' | 'done-late';
  dueAt: string;
  /** Minutes until due (negative once late). */
  minutesLeft: number;
}

export function coolingStatus(startedAt: string, now: Date, inFridgeAt?: string | null): CoolingState {
  const due = new Date(new Date(startedAt).getTime() + COOLING_MINUTES * 60_000);
  if (inFridgeAt) {
    const late = new Date(inFridgeAt).getTime() > due.getTime();
    return { state: late ? 'done-late' : 'done', dueAt: due.toISOString(), minutesLeft: Math.round((due.getTime() - new Date(inFridgeAt).getTime()) / 60_000) };
  }
  const left = Math.round((due.getTime() - now.getTime()) / 60_000);
  return { state: left < 0 ? 'late' : 'cooling', dueAt: due.toISOString(), minutesLeft: left };
}

// ── 6 · Probe calibration ─────────────────────────────────────────────

export const ICE_RANGE: readonly [number, number] = [-1, 1];
export const BOIL_RANGE: readonly [number, number] = [99, 101];
export const CALIBRATE_EVERY_DAYS = 7;

const within = (n: number, [lo, hi]: readonly [number, number]) => Number.isFinite(n) && n >= lo && n <= hi;

export function calibrationResult(ice: number, boil: number): { passed: boolean; iceOk: boolean; boilOk: boolean } {
  const iceOk = within(ice, ICE_RANGE);
  const boilOk = within(boil, BOIL_RANGE);
  return { passed: iceOk && boilOk, iceOk, boilOk };
}

export interface Calibration { date: string; ice: number; boil: number; by: string }
export interface Probe { id: string; name: string; calibrations: Calibration[] }

export type ProbeState = 'ok' | 'due' | 'failed' | 'never';

/** A failed probe stays out of use until it passes again; a pass lasts a week. */
export function probeStatus(p: Pick<Probe, 'calibrations'>, today: string): { state: ProbeState; last?: Calibration; dueOn?: string } {
  const last = [...p.calibrations].sort((a, b) => a.date.localeCompare(b.date)).pop();
  if (!last) return { state: 'never' };
  if (!calibrationResult(last.ice, last.boil).passed) return { state: 'failed', last };
  const dueOn = addDays(last.date, CALIBRATE_EVERY_DAYS);
  return { state: today >= dueOn ? 'due' : 'ok', last, dueOn };
}

/** Only probes that passed can be used for temperature checks. A due probe can still be used today. */
export const usableProbe = (p: Pick<Probe, 'calibrations'>, today: string) => {
  const s = probeStatus(p, today).state;
  return s === 'ok' || s === 'due';
};

// ── 7 · Deliveries, suppliers and recalls ─────────────────────────────

export interface DeliveryItem { name: string; batch: string; useBy: string }

export interface Delivery {
  id: string;
  siteCode: string;
  supplier: string;
  receivedAt: string;
  receivedBy: string;
  /** Chilled goods, °C. null if nothing chilled. */
  chilledC: number | null;
  packagingOk: boolean;
  items: DeliveryItem[];
  rejected: string[];
}

export function deliveryProblems(d: Pick<Delivery, 'supplier' | 'chilledC' | 'packagingOk' | 'items'>, approved: string[], today: string): string[] {
  const out: string[] = [];
  if (!approved.includes(d.supplier)) out.push(`${d.supplier || 'This supplier'} isn't on the approved list`);
  if (d.chilledC !== null && d.chilledC > FRIDGE_MAX_C) out.push(`Chilled goods too warm: ${d.chilledC}°C`);
  if (!d.packagingOk) out.push('Packaging damaged');
  for (const i of d.items) {
    if (!i.batch.trim()) out.push(`${i.name || 'An item'} has no batch code`);
    if (i.useBy && i.useBy < today) out.push(`${i.name} is past its use-by date`);
  }
  return out;
}

export interface FoodAlert {
  id: string;
  title: string;
  reason: string;
  issuedOn: string;
  /** Exact codes, or ranges like "CM-4460 to CM-4479". */
  batches: string[];
}

export type AlertAction = 'set-aside' | 'sent-back' | 'not-in-stock';
export const ALERT_ACTIONS: Record<AlertAction, string> = { 'set-aside': 'Set aside, not used', 'sent-back': 'Sent back', 'not-in-stock': 'Not in stock' };

const norm = (s: string) => s.trim().toUpperCase();

/** Exact match, or within a range of codes that share a prefix and differ in the trailing number. */
export function batchMatches(batch: string, pattern: string): boolean {
  const b = norm(batch);
  const range = pattern.split(/\s+(?:to|-|–)\s+/i);
  if (range.length !== 2) return b === norm(pattern);
  const split = (s: string) => /^(.*?)(\d+)$/.exec(norm(s));
  const [lo, hi, x] = [split(range[0]!), split(range[1]!), split(b)];
  if (!lo || !hi || !x || lo[1] !== hi[1] || x[1] !== lo[1]) return false;
  const n = Number(x[2]);
  return n >= Number(lo[2]) && n <= Number(hi[2]);
}

/** Items received that a food alert covers. */
export function alertMatches(alert: Pick<FoodAlert, 'batches'>, deliveries: Delivery[]): { delivery: Delivery; item: DeliveryItem }[] {
  return deliveries.flatMap((delivery) => delivery.items.filter((item) => alert.batches.some((p) => batchMatches(item.batch, p))).map((item) => ({ delivery, item })));
}

// ── 8 · Customer complaints ───────────────────────────────────────────

export const COMPLAINT_KINDS = ['Foreign body', 'Felt ill after eating', 'Allergic reaction', 'Not what I ordered', 'Undercooked', 'Other'] as const;
export const COMPLAINT_ACTIONS = ['Replaced the dish', 'Refunded', 'Checked the rest of the batch', 'Took the dish off', 'Told the head chef'] as const;

export interface Complaint {
  id: string;
  siteCode: string;
  at: string;
  kind: string;
  dish: string;
  batch: string;
  details: string;
  photos: number;
  itemKept: boolean;
  actions: string[];
  /** Only kept when the customer agreed. */
  customerContact: string | null;
  by: string;
}

export function complaintProblem(c: Pick<Complaint, 'kind' | 'details' | 'actions'> & { contactConsent: boolean; customerContact: string }): string | null {
  if (!c.kind) return 'Pick what happened.';
  if (c.details.trim().length < 5) return 'Say what happened in a few words.';
  if (!c.actions.length) return 'Pick at least one thing you did.';
  if (c.customerContact.trim() && !c.contactConsent) return 'Only save their contact if they say yes.';
  return null;
}

/** What an inspector's pack shows: never the customer's details. */
export const complaintForInspector = ({ customerContact: _c, ...rest }: Complaint) => rest;

/** Kinds that head office should see straight away. */
export const isSerious = (kind: string) => kind === 'Felt ill after eating' || kind === 'Allergic reaction' || kind === 'Foreign body';

// ── 9 · Training and fitness to work ──────────────────────────────────

export const CERT_KINDS = ['Food hygiene Level 2', 'Food hygiene Level 3', 'Allergen awareness'] as const;
export const EXPIRY_WARN_DAYS = 30;

export interface Certificate { person: string; kind: string; expires: string }

export type CertState = 'ok' | 'expiring' | 'expired' | 'missing';

export function certStatus(c: Pick<Certificate, 'expires'> | undefined, today: string): { state: CertState; days: number | null } {
  if (!c) return { state: 'missing', days: null };
  const days = daysBetween(today, c.expires);
  if (days < 0) return { state: 'expired', days };
  if (days <= EXPIRY_WARN_DAYS) return { state: 'expiring', days };
  return { state: 'ok', days };
}

/** Guidance: stay off work until 48 hours after vomiting or diarrhoea stop. */
export const EXCLUSION_HOURS = 48;

export interface FitnessAnswer {
  person: string;
  at: string;
  /** Vomiting or diarrhoea in the last 48 hours. */
  ill: boolean;
  /** When the symptoms stopped; null if still ill or unknown. */
  stoppedAt: string | null;
}

/** When someone may come back, or null if they're fit now. Still ill → 48 hours from now at the earliest. */
export function backToWorkAt(a: FitnessAnswer, now: Date): Date | null {
  if (!a.ill) return null;
  const from = a.stoppedAt ? new Date(a.stoppedAt) : now;
  const back = new Date(from.getTime() + EXCLUSION_HOURS * 3_600_000);
  return back.getTime() > now.getTime() ? back : null;
}

// ── 10 · Inspections and notices ──────────────────────────────────────

export const REMIND_DAYS_BEFORE = 7;

export interface Notice {
  id: string;
  kind: 'Improvement notice' | 'Prohibition notice' | 'Written warning';
  title: string;
  servedOn: string;
  fixBy: string;
  appealBy: string | null;
  closedOn: string | null;
  repairId?: string;
}

export interface Visit {
  id: string;
  date: string;
  who: 'Environmental health' | 'Trading standards' | 'Other';
  rating: number | null;
  outcome: string;
}

export interface SiteCompliance {
  siteCode: string;
  council: string;
  registeredOn: string;
  visits: Visit[];
  notices: Notice[];
}

/** The latest food hygiene rating from a visit. */
export const currentRating = (s: Pick<SiteCompliance, 'visits'>) =>
  [...s.visits].filter((v) => v.rating !== null).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

export function noticeDeadlines(n: Notice, today: string): { fixDays: number; appealDays: number | null; remind: boolean; overdue: boolean } {
  const fixDays = daysBetween(today, n.fixBy);
  const appealDays = n.appealBy ? daysBetween(today, n.appealBy) : null;
  const near = (d: number | null) => d !== null && d >= 0 && d <= REMIND_DAYS_BEFORE;
  return { fixDays, appealDays, remind: !n.closedOn && (near(fixDays) || near(appealDays)), overdue: !n.closedOn && fixDays < 0 };
}

// ── 11 · 4-weekly review ──────────────────────────────────────────────

export const REVIEW_EVERY_DAYS = 28;
export const REPEAT_WINDOW_DAYS = 7;
export const REPEAT_MIN = 3;

export const REVIEW_QUESTIONS = [
  { id: 'dishes', title: 'New dishes or suppliers', sub: 'Update the allergen matrix' },
  { id: 'staff', title: 'New staff', sub: 'Check their training' },
  { id: 'equipment', title: 'New or changed equipment', sub: 'Add it to the checklists' },
] as const;

export interface Review { id: string; siteCode: string; on: string; by: string; answers: Record<string, boolean> }

export const reviewDue = (last: Pick<Review, 'on'> | undefined, today: string) => !last || daysBetween(last.on, today) >= REVIEW_EVERY_DAYS;

export interface RepeatFault { templateId: string; checkpointId: string; title: string; count: number; dates: string[] }

/** The same check failing again and again in the last week: a sign the cause hasn't been fixed. */
export function repeatFaults(runs: ChecklistRun[], templates: ChecklistTemplate[], today: string, opts = { days: REPEAT_WINDOW_DAYS, min: REPEAT_MIN }): RepeatFault[] {
  const from = addDays(today, -(opts.days - 1));
  const seen = new Map<string, RepeatFault>();
  for (const r of runs) {
    if (r.recheckOf || r.businessDate < from || r.businessDate > today) continue;
    const t = templates.find((x) => x.id === r.templateId);
    for (const c of t?.checkpoints ?? []) {
      if (evaluate(c, r.answers[c.id], r.businessDate).passed !== false) continue;
      const k = `${t!.id}|${c.id}`;
      const f = seen.get(k) ?? { templateId: t!.id, checkpointId: c.id, title: c.title, count: 0, dates: [] };
      f.count++;
      f.dates.push(r.businessDate);
      seen.set(k, f);
    }
  }
  return [...seen.values()].filter((f) => f.count >= opts.min).sort((a, b) => b.count - a.count);
}
