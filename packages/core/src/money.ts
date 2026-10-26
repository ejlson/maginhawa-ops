/**
 * Money is held as whole pence (integers) everywhere, so sums never drift.
 * Convert at the edges only: parse what a manager types, format for display.
 */
export type Pence = number;

/** Parses what a manager types ("£1,200.00", "1200", " 12.5 ") into pence. Empty or invalid → null. */
export function parsePounds(input: string | number | null | undefined): Pence | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : null;
  const cleaned = input.replace(/[£,\s]/g, '').replace('−', '-');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!m) return null;
  // Work on the digits as text, so 1.005 becomes 101p rather than 100p from float maths.
  const [, sign, whole = '', frac = ''] = m;
  const digits = (frac + '000').slice(0, 3);
  let p = Number(whole || '0') * 100 + Number(digits.slice(0, 2));
  if (Number(digits[2]) >= 5) p += 1;
  return sign === '-' ? -p : p;
}

/** Parses a whole count ("12", "1,000"). Empty or invalid → null. */
export function parseCount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isInteger(input) && input >= 0 ? input : null;
  const cleaned = input.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

/** £1,234.50 · negative values use a true minus sign: −£20.00 */
export function formatPounds(p: Pence): string {
  const s = gbp.format(Math.abs(p) / 100);
  return p < 0 ? `−${s}` : s;
}

/** Splits £2,687.50 into ["£2,687", ".50"] for the hero figure (pence smaller and lighter). */
export function splitPounds(p: Pence): [string, string] {
  const s = formatPounds(p);
  const dot = s.lastIndexOf('.');
  return [s.slice(0, dot), s.slice(dot)];
}

/** Rounds half away from zero to whole pence. */
export function roundPence(value: number): Pence {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** A percentage to one decimal place, e.g. 29.8. Returns null when the base is zero. */
export function percent(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}
