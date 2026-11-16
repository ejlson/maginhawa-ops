import { describe, expect, it } from 'vitest';
import { unitOne } from '../app/lib/ops-helpers';

describe('unitOne', () => {
  it('makes one of a plural unit, for "a bottle" style prices', () => {
    expect(unitOne('bottles')).toBe('bottle');
    expect(unitOne('bags')).toBe('bag');
    expect(unitOne('boxes')).toBe('box');
    expect(unitOne('punches')).toBe('punch');
    expect(unitOne('dishes')).toBe('dish');
  });

  it('leaves units that are already one alone', () => {
    expect(unitOne('kg')).toBe('kg');
    expect(unitOne('ml')).toBe('ml');
    expect(unitOne('box')).toBe('box');
    expect(unitOne('each')).toBe('each');
    expect(unitOne('gs')).toBe('gs'); // too short to be a plural
  });
});
