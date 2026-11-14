/**
 * Each person's own home layout, saved on this device (the widget list, role defaults and rules live in
 * @maginhawa/core, home.ts): order and hidden widgets, compact tiles, the main card's style, and
 * optionally a different set for opening, service and closing.
 */
import { useCallback, useState } from 'react';
import { DEFAULT_HOME, resolveLayout, SHIFT_DEFAULTS, WIDGETS, type CardStyle, type Shift, type WidgetId, type WidgetSet } from '@maginhawa/core';
import type { Role } from './auth';
import { storage } from './storage';

export { DEFAULT_HOME, resolveLayout, shiftAt, SHIFTS, WIDGETS, widgetAllowed } from '@maginhawa/core';
export type { CardStyle, Shift, WidgetId, WidgetInfo, WidgetSet } from '@maginhawa/core';
/** The role defaults under their earlier name. */
export const DEFAULT_LAYOUT = DEFAULT_HOME;

interface Saved extends WidgetSet {
  small?: WidgetId[];
  card?: CardStyle;
  byShift?: boolean;
  shifts?: Partial<Record<Shift, WidgetSet>>;
}

const key = (role: Role, person: string) => `mgh.home.v1:${role}:${person}`;

/**
 * This person's home. `shift` is the set being looked at when sets change with the shift:
 * the one for now on the home, or the one being edited in Customise.
 */
export function useHomeLayout(role: Role, person: string, canDoEod: boolean, shift: Shift = 'service') {
  const [saved, setSaved] = useState<Saved | null>(() => storage.get<Saved | null>(key(role, person), null));
  const write = useCallback((next: Saved | null) => { storage.set(key(role, person), next); setSaved(next); }, [role, person]);
  const byShift = Boolean(saved?.byShift);
  const set = byShift
    ? resolveLayout(saved?.shifts?.[shift] ?? null, role, canDoEod, SHIFT_DEFAULTS[shift])
    : resolveLayout(saved, role, canDoEod);
  const base: Saved = saved ?? resolveLayout(null, role, canDoEod);
  return {
    ...set,
    byShift,
    small: saved?.small ?? [],
    card: saved?.card ?? ('standard' as CardStyle),
    custom: saved !== null,
    /** Save the order and hidden list (for this shift, when sets change with the shift). */
    save: (order: WidgetId[], hidden: WidgetId[]) => write(byShift
      ? { ...base, shifts: { ...base.shifts, [shift]: { order, hidden } } }
      : { ...base, order, hidden }),
    setSmall: (id: WidgetId, on: boolean) => {
      const small = (base.small ?? []).filter((x) => x !== id);
      write({ ...base, small: on ? [...small, id] : small });
    },
    setCard: (card: CardStyle) => write({ ...base, card }),
    setByShift: (on: boolean) => write({ ...base, byShift: on }),
    /** Everything saved, to put back after a Reset (Undo). */
    snapshot: saved,
    restore: (s: Saved | null) => write(s),
    reset: () => write(null),
  };
}
