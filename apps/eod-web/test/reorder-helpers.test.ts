import { describe, expect, it } from 'vitest';
import { dropIndex, edgeSpeed } from '../app/components/reorder-helpers';

// Four 60px rows starting at 0, 60, 120, 180.
const tops = [0, 60, 120, 180];
const heights = [60, 60, 60, 60];

describe('dropIndex', () => {
  it('stays put until the row passes the middle of the next one', () => {
    expect(dropIndex(0, 0, tops, heights)).toBe(0);
    expect(dropIndex(0, 59, tops, heights)).toBe(0);
    expect(dropIndex(0, 61, tops, heights)).toBe(1);
  });
  it('moves down and up several places', () => {
    expect(dropIndex(0, 125, tops, heights)).toBe(2);
    expect(dropIndex(3, -130, tops, heights)).toBe(1);
  });
  it('stops at the ends', () => {
    expect(dropIndex(1, 999, tops, heights)).toBe(3);
    expect(dropIndex(2, -999, tops, heights)).toBe(0);
  });
});

describe('edgeSpeed', () => {
  it("doesn't scroll in the middle of the screen", () => {
    expect(edgeSpeed(400, 80, 700)).toBe(0);
  });
  it('scrolls up near the top and down near the bottom, faster further in', () => {
    expect(edgeSpeed(70, 80, 700)).toBe(-2);
    expect(edgeSpeed(30, 80, 700)).toBe(-10);
    expect(edgeSpeed(720, 80, 700)).toBe(4);
  });
  it('has a top speed', () => {
    expect(edgeSpeed(-500, 80, 700)).toBe(-16);
    expect(edgeSpeed(2000, 80, 700)).toBe(16);
  });
});
