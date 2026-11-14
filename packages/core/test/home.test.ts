import { describe, expect, it } from 'vitest';
import { DEFAULT_HOME, resolveLayout, SHIFT_DEFAULTS, shiftAt, WIDGETS, widgetAllowed, type WidgetId } from '../src';

const ids = Object.keys(WIDGETS) as WidgetId[];

describe('home widgets: role defaults (docs/specs/bento-home/SPEC.md)', () => {
  it('starts each role with the agreed widgets', () => {
    expect(DEFAULT_HOME.staff).toEqual(['checklists', 'food', 'recipes']);
    expect(DEFAULT_HOME.supervisor).toEqual(['checklists', 'eod', 'stock', 'food', 'recipes']);
    expect(DEFAULT_HOME.manager).toEqual(['checklists', 'eod', 'stock', 'food', 'recipes', 'repairs']);
    expect(DEFAULT_HOME.headoffice).toEqual(DEFAULT_HOME.manager);
  });

  it('keeps Handover off by default for everyone, and Repairs for managers only', () => {
    for (const set of Object.values(DEFAULT_HOME)) expect(set).not.toContain('handover');
    expect(DEFAULT_HOME.staff).not.toContain('repairs');
    expect(DEFAULT_HOME.supervisor).not.toContain('repairs');
  });

  it('never starts anyone with a widget their role cannot use', () => {
    for (const [role, set] of Object.entries(DEFAULT_HOME)) {
      for (const id of set) expect(widgetAllowed(id, role as keyof typeof DEFAULT_HOME, role !== 'staff')).toBe(true);
    }
  });
});

describe('home widgets: who may have each one', () => {
  it('keeps the EOD with those who close, money with managers, On shift off staff', () => {
    expect(widgetAllowed('eod', 'staff', false)).toBe(false);
    expect(widgetAllowed('eod', 'headoffice', true)).toBe(true);
    expect(widgetAllowed('week', 'supervisor', true)).toBe(false);
    expect(widgetAllowed('week', 'manager', true)).toBe(true);
    expect(widgetAllowed('onshift', 'staff', false)).toBe(false);
    expect(widgetAllowed('checklists', 'staff', false)).toBe(true);
  });
});

describe('home widgets: reading a saved layout back', () => {
  it('with nothing saved, shows the role default and offers the rest it may have', () => {
    const l = resolveLayout(null, 'staff', false);
    expect(l.order).toEqual(DEFAULT_HOME.staff);
    expect(l.hidden).not.toContain('eod');
    expect([...l.order, ...l.hidden].sort()).toEqual(ids.filter((id) => widgetAllowed(id, 'staff', false)).sort());
  });

  it('drops anything the person may not have, even if it was saved', () => {
    const l = resolveLayout({ order: ['eod', 'week', 'checklists'], hidden: ['onshift'] }, 'staff', false);
    expect(l.order).toEqual(['checklists']);
    expect(l.hidden).not.toContain('onshift');
  });

  it('keeps the saved order and puts widgets added since under Add widgets', () => {
    const l = resolveLayout({ order: ['food', 'checklists'], hidden: ['recipes'] }, 'staff', false);
    expect(l.order).toEqual(['food', 'checklists']);
    expect(l.hidden[0]).toBe('recipes');
    expect(l.hidden).toContain('day');
  });

  it('shift sets start from their own defaults', () => {
    expect(resolveLayout(null, 'manager', true, SHIFT_DEFAULTS.closing).order[0]).toBe('eod');
    expect(resolveLayout(null, 'staff', false, SHIFT_DEFAULTS.closing).order).not.toContain('eod');
  });
});

describe('home widgets: the shift by the site clock', () => {
  it('is opening until 11:00, service until 22:00, then closing', () => {
    expect(shiftAt(new Date('2026-07-01T09:59:00Z'))).toBe('opening'); // 10:59 BST
    expect(shiftAt(new Date('2026-07-01T10:00:00Z'))).toBe('service'); // 11:00 BST
    expect(shiftAt(new Date('2026-07-01T20:59:00Z'))).toBe('service'); // 21:59 BST
    expect(shiftAt(new Date('2026-07-01T21:00:00Z'))).toBe('closing'); // 22:00 BST
    expect(shiftAt(new Date('2026-07-01T01:00:00Z'))).toBe('closing'); // 02:00 BST, still last night
  });
});
