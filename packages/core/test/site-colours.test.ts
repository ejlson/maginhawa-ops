import { describe, expect, it } from 'vitest';
import {
  COLOUR_PRESETS, DEFAULT_SITE_COLOURS, SITES, cleanColourChoices, contrastRatio, customColour, oklchToHex, siteColour, siteMonogram, textOn,
} from '../src';

describe('site colours', () => {
  it('gives every open site its own default colour', () => {
    const ids = SITES.map((s) => DEFAULT_SITE_COLOURS[s.code]);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(SITES.length);
  });

  it('uses the default, then head office’s choice', () => {
    expect(siteColour('BUN').name).toBe('Mango');
    expect(siteColour('BUN', { BUN: { preset: 'teal' } }).hex).toBe('#0C8599');
    expect(siteColour('BUN', { BUN: { hue: 200 } }).name).toBe('Custom');
  });

  it('falls back to Slate for no site or an unknown one', () => {
    expect(siteColour(null).name).toBe('Slate');
    expect(siteColour('ZZZ').name).toBe('Slate');
    expect(siteColour('BUN', { BUN: { preset: 'nope' } }).name).toBe('Slate');
  });

  it('picks readable text on every preset', () => {
    for (const p of COLOUR_PRESETS) {
      expect(contrastRatio(p.hex, textOn(p.hex))).toBeGreaterThanOrEqual(3);
    }
    expect(textOn('#F59F00')).toBe('#1D1D1F');
    expect(textOn('#3B5BDB')).toBe('#FFFFFF');
  });

  it('keeps custom colours readable at every hue', () => {
    for (let h = 0; h < 360; h += 15) {
      const c = customColour(h);
      expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(contrastRatio(c.hex, c.on)).toBeGreaterThanOrEqual(3);
    }
  });

  it('converts OKLCH like CSS does', () => {
    expect(oklchToHex(1, 0, 0)).toBe('#FFFFFF');
    expect(oklchToHex(0, 0, 0)).toBe('#000000');
    expect(oklchToHex(0.628, 0.2577, 29.23)).toBe('#FF0000');
  });

  it('measures contrast like WCAG', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('gives every site its own two letters', () => {
    const monos = SITES.map((s) => siteMonogram(s.code));
    expect(monos.every((m) => /^[A-Z]{2}$/.test(m))).toBe(true);
    expect(new Set(monos).size).toBe(SITES.length);
    expect(siteMonogram('MKT')).toBe('KT');
    expect(siteMonogram('xyz')).toBe('XY');
  });

  it('drops stored choices it can’t draw', () => {
    expect(cleanColourChoices({ BUN: { preset: 'teal' }, BIN: { hue: 400 }, BEL: { preset: 'nope' }, HOO: 'x' }))
      .toEqual({ BUN: { preset: 'teal' }, BIN: { hue: 40 } });
    expect(cleanColourChoices(null)).toEqual({});
  });
});
