/**
 * The home screen as widgets (docs/specs/bento-home/SPEC.md, designs W1–W8): which widgets there are,
 * who may have each one, each role's starting layout, the shift sets, and how a saved layout is
 * read back so a person only ever gets widgets their role can use.
 */
import type { PersonRole } from './people';

export type WidgetId = 'checklists' | 'eod' | 'day' | 'stack' | 'quick' | 'stock' | 'repairs' | 'handover' | 'food' | 'recipes' | 'onshift' | 'week';
export type Shift = 'opening' | 'service' | 'closing';
export type CardStyle = 'standard' | 'rings';

export interface WidgetInfo {
  name: string;
  /** What it shows, for the Add widgets list. */
  desc: string;
  /** Wide widgets take the full width on phones and two columns on desktop. */
  wide: boolean;
  /** Can be shown as a small tile with one big number (W4). */
  compact: boolean;
}

export const WIDGETS: Record<WidgetId, WidgetInfo> = {
  checklists: { name: 'Checklists', desc: "What's late, next and done today", wide: true, compact: true },
  eod: { name: 'End of day report', desc: 'Sections left tonight', wide: true, compact: true },
  day: { name: 'Your day', desc: 'Everything due today on a time line', wide: true, compact: false },
  stack: { name: 'Smart stack', desc: 'One thing at a time, most urgent first', wide: true, compact: false },
  quick: { name: 'Quick actions', desc: 'Log a temp, report a problem, waste, order', wide: true, compact: false },
  stock: { name: 'Stock', desc: 'Counts, running low, deliveries', wide: true, compact: true },
  repairs: { name: 'Repairs', desc: 'Open jobs and report a problem', wide: false, compact: true },
  handover: { name: 'Handover', desc: 'Notes from last night', wide: false, compact: true },
  food: { name: 'Food safety', desc: 'Log a temp, deliveries, allergens', wide: true, compact: true },
  recipes: { name: 'Recipes', desc: 'Find a dish', wide: false, compact: false },
  onshift: { name: 'On shift', desc: 'Who did what today', wide: true, compact: false },
  week: { name: 'Last 7 days', desc: 'Net sales, wages and covers', wide: true, compact: false },
};

export const SHIFTS: { id: Shift; label: string }[] = [
  { id: 'opening', label: 'Opening' }, { id: 'service', label: 'Service' }, { id: 'closing', label: 'Closing' },
];

/** The part of the day by the site's clock: opening until 11:00, service until 22:00, then closing. */
export function shiftAt(d: Date, timeZone = 'Europe/London'): Shift {
  const h = Number(d.toLocaleString('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }));
  return h >= 4 && h < 11 ? 'opening' : h >= 11 && h < 22 ? 'service' : 'closing';
}

/** Who can have each widget. Money stays with supervisors and up; the EOD with those who close. */
export function widgetAllowed(id: WidgetId, role: PersonRole, canDoEod: boolean): boolean {
  if (id === 'eod') return canDoEod;
  if (id === 'week') return role === 'manager' || role === 'headoffice';
  if (id === 'onshift') return role !== 'staff';
  return true;
}

/**
 * Each role's starting layout (docs/specs/bento-home/SPEC.md): shown in this order, the rest under
 * Add widgets. Handover is off by default; Repairs only for managers.
 */
export const DEFAULT_HOME: Record<PersonRole, WidgetId[]> = {
  manager: ['checklists', 'eod', 'stock', 'food', 'recipes', 'repairs'],
  headoffice: ['checklists', 'eod', 'stock', 'food', 'recipes', 'repairs'],
  supervisor: ['checklists', 'eod', 'stock', 'food', 'recipes'],
  staff: ['checklists', 'food', 'recipes'],
};

/** Starting sets when "Change with the shift" is switched on (W7); anything not allowed drops out. */
export const SHIFT_DEFAULTS: Record<Shift, WidgetId[]> = {
  opening: ['handover', 'checklists', 'day', 'food', 'stock', 'repairs'],
  service: ['stack', 'checklists', 'quick', 'repairs', 'handover', 'onshift'],
  closing: ['eod', 'checklists', 'stock', 'handover', 'food', 'repairs'],
};

export interface WidgetSet { order: WidgetId[]; hidden: WidgetId[] }
const ALL_WIDGETS = Object.keys(WIDGETS) as WidgetId[];

/** The order to show and the ones hidden, from a saved set (if any) or a starting order, keeping only what this person may have. */
export function resolveLayout(saved: WidgetSet | null, role: PersonRole, canDoEod: boolean, start: WidgetId[] = DEFAULT_HOME[role]): WidgetSet {
  const ok = (id: WidgetId) => ALL_WIDGETS.includes(id) && widgetAllowed(id, role, canDoEod);
  const base = saved ?? { order: start, hidden: [] };
  const order = base.order.filter(ok);
  // Anything never placed: hidden (under Add widgets).
  const rest = ALL_WIDGETS.filter((id) => ok(id) && !order.includes(id));
  return { order, hidden: [...base.hidden.filter((id) => rest.includes(id)), ...rest.filter((id) => !base.hidden.includes(id))] };
}

