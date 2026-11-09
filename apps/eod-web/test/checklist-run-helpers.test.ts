import { describe, expect, it } from 'vitest';
import { blockingLabel, rowState } from '../app/components/checklist-run-helpers';

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
