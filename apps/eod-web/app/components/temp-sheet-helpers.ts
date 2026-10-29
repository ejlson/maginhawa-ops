import { evaluate, type Checkpoint } from '@maginhawa/core';

/** Readings people are likely to get, either side of the limit. */
export function quickValues(c: Checkpoint): number[] {
  const base = c.min ?? c.max;
  if (base === undefined) return [];
  const offsets = c.min !== undefined ? [-3, 0, 2, 5, 7, 12] : [-5, -3, -1, 0, 2, 5];
  return [...new Set(offsets.map((o) => base + o))].sort((a, b) => a - b);
}

/** "Passes · 5°C above the limit", or why it fails. */
export function verdict(c: Checkpoint, n: number, today: string): { ok: boolean | null; text: string } {
  const e = evaluate(c, n, today);
  if (e.passed === false) return { ok: false, text: e.reason };
  if (e.passed !== true) return { ok: null, text: `${n}°C` };
  const gap = c.min !== undefined ? n - c.min : c.max !== undefined ? c.max - n : 0;
  const side = c.min !== undefined ? 'above' : 'under';
  return { ok: true, text: gap === 0 ? 'Passes · right on the limit' : `Passes · ${Number(gap.toFixed(1))}°C ${side} the limit` };
}
