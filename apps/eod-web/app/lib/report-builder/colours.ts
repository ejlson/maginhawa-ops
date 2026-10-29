/**
 * The colour of each type of box on the map. Finance pick from a small palette; green, amber and red
 * are left out because they mean good, watch and wrong. Picking a colour another type has swaps the two,
 * so no two types look alike. Remembered on this device only: it changes how the builder looks, not the report.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { storage } from '../storage';

export const PALETTE = {
  indigo: { name: 'Indigo', l: '#5856D6', d: '#8E8CFF' },
  purple: { name: 'Purple', l: '#9A3FCB', d: '#D68BFF' },
  teal: { name: 'Teal', l: '#16879D', d: '#5FD0E6' },
  slate: { name: 'Slate', l: '#5B6B82', d: '#A5B1C2' },
  plum: { name: 'Plum', l: '#A23B72', d: '#F08FC0' },
  graphite: { name: 'Graphite', l: '#48484A', d: '#C7C7CC' },
  sand: { name: 'Sand', l: '#8A7350', d: '#D6C29B' },
} as const;
export type ColourId = keyof typeof PALETTE;
export const ROLES = [['in', 'Inputs'], ['set', 'Settings'], ['calc', 'Calculations'], ['act', 'Checks & actions']] as const;
export type Role = (typeof ROLES)[number][0];
export type Colours = Record<Role, ColourId>;
export const DEFAULT_COLOURS: Colours = { in: 'indigo', set: 'slate', calc: 'purple', act: 'teal' };
const KEY = 'mgh.rb.colours';

export function loadColours(): Colours {
  const c = storage.get<Partial<Colours> | null>(KEY, null);
  return c && ROLES.every(([k]) => c[k] && c[k]! in PALETTE) ? (c as Colours) : { ...DEFAULT_COLOURS };
}

/** Gives `role` colour `id`; whichever type had it takes `role`'s old colour. Returns the type it swapped with. */
export function pickColour(c: Colours, role: Role, id: ColourId): { colours: Colours; swapped: Role | null } {
  const other = ROLES.find(([k]) => k !== role && c[k] === id)?.[0] ?? null;
  const next = { ...c, [role]: id };
  if (other) next[other] = c[role];
  return { colours: next, swapped: other };
}

const rgba = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

/** The CSS variables for these colours. Defaults set nothing, so the stylesheet's own values stand. */
export function colourVars(c: Colours, dark: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  ROLES.forEach(([k]) => {
    if (c[k] === DEFAULT_COLOURS[k]) return;
    const hex = PALETTE[c[k]][dark ? 'd' : 'l'];
    out[`--r-${k}`] = hex;
    out[`--r-${k}bg`] = rgba(hex, dark ? 0.16 : 0.11);
  });
  return out;
}

function isDark(): boolean {
  if (typeof document === 'undefined') return false;
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t === 'dark';
  return !!globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function useColours() {
  const [colours, setColours] = useState<Colours>(loadColours);
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const update = () => setDark(isDark());
    const mq = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', update);
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(update);
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq?.removeEventListener?.('change', update); mo?.disconnect(); };
  }, []);
  const set = useCallback((next: Colours) => { setColours(next); storage.set(KEY, next); }, []);
  const style = useMemo(() => colourVars(colours, dark) as CSSProperties, [colours, dark]);
  return { colours, set, style };
}
