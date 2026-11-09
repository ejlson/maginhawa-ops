import { describe, expect, it } from 'vitest';
import { blockingLabel, finishStats, fixChoices, nextToDo, rowState } from '../app/components/checklist-run-helpers';
import { newCheckpoint } from '@maginhawa/core';

const fail = (title: string, fixed = false) => ({ checkpoint: { title }, reason: '', fixed }) as never;

describe('blockingLabel', () => {
  it('counts what is left when nothing has failed', () => {
    expect(blockingLabel({ requiredLeft: 4, failures: [] })).toBe('4 left to answer');
  });
  it('names a single failure, then what is left', () => {
    expect(blockingLabel({ requiredLeft: 3, failures: [fail('Freezer')] })).toBe('Fix freezer, then 3 left');
    expect(blockingLabel({ requiredLeft: 0, failures: [fail('Walk-in fridge')] })).toBe('Fix walk-in fridge first');
  });
  it('counts several failures and ignores fixed ones', () => {
    expect(blockingLabel({ requiredLeft: 1, failures: [fail('Freezer'), fail('Fridge 2'), fail('Fridge 1', true)] })).toBe('Fix 2 failed checks, then 1 left');
  });
});

describe('rowState', () => {
  it('maps an answer to its circle', () => {
    expect(rowState({ answered: false, passed: null }, false)).toBe('todo');
    expect(rowState({ answered: true, passed: true }, false)).toBe('done');
    expect(rowState({ answered: true, passed: null }, false)).toBe('done');
    expect(rowState({ answered: true, passed: false }, false)).toBe('fail');
    expect(rowState({ answered: true, passed: false }, true)).toBe('done');
  });
});

describe('nextToDo', () => {
  const checks = ['a', 'b', 'c'].map((id) => ({ ...newCheckpoint('yesno', id), title: id }));
  it('points at the first check not yet answered, in list order', () => {
    expect(nextToDo(checks, {}, '2026-11-09')).toBe('a');
    expect(nextToDo(checks, { a: true, c: false }, '2026-11-09')).toBe('b');
  });
  it('is empty when everything is answered', () => {
    expect(nextToDo(checks, { a: true, b: true, c: true }, '2026-11-09')).toBeNull();
  });
});

describe('fixChoices', () => {
  const all = ['Moved food to another fridge', 'Door was left open, closed it', 'Turned the thermostat down', 'Reheated the food', 'Threw the food away', 'Called the manager'];
  it('offers fridge actions for cold storage', () => {
    expect(fixChoices({ type: 'temp', max: 8 }, all)).toEqual(['Moved food to another fridge', 'Door was left open, closed it', 'Turned the thermostat down', 'Threw the food away']);
  });
  it('offers reheating first for hot holding', () => {
    expect(fixChoices({ type: 'temp', min: 63 }, all).slice(0, 3)).toEqual(['Reheated the food', 'Threw the food away', 'Called the manager']);
  });
  it('always offers four', () => {
    expect(fixChoices({ type: 'yesno' }, all)).toHaveLength(4);
  });
});

describe('finishStats', () => {
  it('times the list from first to last answer, at least a minute', () => {
    const run = { answeredBy: { a: { at: '2026-11-09T09:00:00Z' }, b: { at: '2026-11-09T09:06:20Z' } }, fixes: {} };
    expect(finishStats(run)).toEqual({ minutes: 6, fixed: 0, recheckAt: null });
    expect(finishStats({ answeredBy: { a: { at: '2026-11-09T09:00:00Z' } }, fixes: {} }).minutes).toBe(1);
  });
  it('counts fixes and finds the earliest re-check', () => {
    const run = { fixes: { a: { at: '2026-11-09T09:10:00Z', recheckInMinutes: 30 }, b: { at: '2026-11-09T09:05:00Z', recheckInMinutes: 15 } } };
    const s = finishStats(run);
    expect(s.fixed).toBe(2);
    expect(s.minutes).toBeNull();
    expect(s.recheckAt?.toISOString()).toBe('2026-11-09T09:20:00.000Z');
  });
});
