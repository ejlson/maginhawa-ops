/**
 * Each site's colour (the Nov 2026 redesign). One seed colour per site says which site you're in:
 * the badge, the main card's gradient, the selected tab and the progress circles. It never means
 * status: green, amber and red stay global. Head office picks from tested presets or a custom hue;
 * the text colour on top is always worked out here so it stays readable.
 */

export interface ColourPreset {
  id: string;
  name: string;
  /** The seed colour. */
  hex: string;
  /** A pale tint of it, used for the glow in the gradient and soft backgrounds. */
  light: string;
}

export const COLOUR_PRESETS: readonly ColourPreset[] = [
  { id: 'indigo', name: 'Indigo', hex: '#3B5BDB', light: '#A5B8FF' },
  { id: 'leaf', name: 'Leaf', hex: '#5C940D', light: '#D8F5A2' },
  { id: 'plum', name: 'Plum', hex: '#9C36B5', light: '#F3C4FF' },
  { id: 'walnut', name: 'Walnut', hex: '#A0612A', light: '#F5D0A9' },
  { id: 'mango', name: 'Mango', hex: '#F59F00', light: '#FFE8A3' },
  { id: 'rose', name: 'Rose', hex: '#D6336C', light: '#FFC9DE' },
  { id: 'teal', name: 'Teal', hex: '#0C8599', light: '#99E9F2' },
  { id: 'lantern', name: 'Lantern', hex: '#C92A2A', light: '#FFB37A' },
  { id: 'ocean', name: 'Ocean', hex: '#1971C2', light: '#A5D8FF' },
  { id: 'grape', name: 'Grape', hex: '#6741D9', light: '#D0BFFF' },
  { id: 'olive', name: 'Olive', hex: '#868E2C', light: '#E9EDB0' },
  { id: 'slate', name: 'Slate', hex: '#495057', light: '#DEE2E6' },
];

/** Suggested defaults, by site code. Head office can change any of them. */
export const DEFAULT_SITE_COLOURS: Readonly<Record<string, string>> = {
  BIN: 'indigo',
  GUA: 'leaf',
  BEL: 'plum',
  RAM: 'slate',
  HOO: 'walnut',
  BUN: 'mango',
  CAF: 'rose',
  MKT: 'teal',
  MCT: 'lantern',
};

/** Two letters shown with the colour (never colour alone), from the site's name rather than its code. */
export const SITE_MONOGRAMS: Readonly<Record<string, string>> = {
  BIN: 'BN', GUA: 'GB', BEL: 'BL', RAM: 'RA', HOO: 'HW', BUN: 'BU', CAF: 'CM', MKT: 'KT', MCT: 'CT',
};

export const siteMonogram = (siteCode: string) => SITE_MONOGRAMS[siteCode] ?? siteCode.slice(0, 2).toUpperCase();

/** What head office chose for a site: a preset, or a custom hue (0–360). */
export type SiteColourChoice = { preset: string } | { hue: number };

export interface SiteColour {
  /** "Mango", or "Custom". */
  name: string;
  hex: string;
  light: string;
  /** Text and icons drawn on the seed colour. */
  on: '#FFFFFF' | '#1D1D1F';
  /** True when a custom colour's lightness was nudged so text on it stays readable. */
  adjusted: boolean;
}

const INK = '#1D1D1F';
const WHITE = '#FFFFFF';
/** Used for anything without a site (head office's own screens) and for unknown codes. */
const FALLBACK = 'slate';

const presetById = (id: string) => COLOUR_PRESETS.find((p) => p.id === id);

/** The colour a site uses, from head office's choices (if any) or the default. */
export function siteColour(siteCode: string | null | undefined, choices: Readonly<Record<string, SiteColourChoice>> = {}): SiteColour {
  const choice: SiteColourChoice | undefined = siteCode ? choices[siteCode] : undefined;
  if (choice && 'hue' in choice) return customColour(choice.hue);
  const id = choice && 'preset' in choice ? choice.preset : (siteCode && DEFAULT_SITE_COLOURS[siteCode]) || FALLBACK;
  const p = presetById(id) ?? presetById(FALLBACK)!;
  return { name: p.name, hex: p.hex, light: p.light, on: textOn(p.hex), adjusted: false };
}

/**
 * A custom colour from a hue. Lightness and chroma are fixed (OKLCH .66 / .15) so every hue looks
 * like it belongs with the presets; if text on it would still be hard to read, it's darkened a little.
 */
export function customColour(hue: number): SiteColour {
  const h = ((Math.round(hue) % 360) + 360) % 360;
  let l = 0.66;
  let hex = oklchToHex(l, 0.15, h);
  let adjusted = false;
  // Prefer white text; darken until it reads, or fall back to dark text if the colour is naturally light.
  while (bestText(hex).ratio < 4.5 && l > 0.5) {
    l -= 0.02;
    hex = oklchToHex(l, 0.15, h);
    adjusted = true;
  }
  return { name: 'Custom', hex, light: oklchToHex(0.93, 0.06, h), on: textOn(hex), adjusted };
}

/** White or near-black text, whichever is easier to read on this colour. */
export function textOn(hex: string): '#FFFFFF' | '#1D1D1F' {
  return bestText(hex).text;
}

function bestText(hex: string): { text: '#FFFFFF' | '#1D1D1F'; ratio: number } {
  const w = contrastRatio(hex, WHITE);
  const d = contrastRatio(hex, INK);
  // Lean towards white: it suits the gradient cards, as long as it passes for large text.
  return w >= 3 && w >= d * 0.75 ? { text: WHITE, ratio: w } : { text: INK, ratio: d };
}

/** WCAG 2 contrast ratio between two hex colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function luminance(hex: string): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) throw new Error(`Not a colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** OKLCH to an sRGB hex, clamped into gamut. */
export function oklchToHex(l: number, c: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const lin = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
  const toHex = (v: number) => {
    const x = Math.min(1, Math.max(0, v));
    const s = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(s * 255).toString(16).padStart(2, '0');
  };
  return `#${lin.map(toHex).join('')}`.toUpperCase();
}

/** Accepts only choices the app can draw; anything else is dropped, so a bad stored value falls back to the default. */
export function cleanColourChoices(raw: unknown): Record<string, SiteColourChoice> {
  const out: Record<string, SiteColourChoice> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [code, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    if (typeof o.preset === 'string' && presetById(o.preset)) out[code] = { preset: o.preset };
    else if (typeof o.hue === 'number' && Number.isFinite(o.hue)) out[code] = { hue: ((Math.round(o.hue) % 360) + 360) % 360 };
  }
  return out;
}
