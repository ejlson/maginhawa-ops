import { describe, expect, it } from 'vitest';
import { checkPin, lockedFor, makePinRecord, pinIssues, PIN_MAX_TRIES } from '../src/pin';

const now = new Date('2026-10-27T10:00:00Z');

describe('choosing a PIN', () => {
  it('must be four numbers', () => {
    expect(pinIssues('48')).toEqual(['Use 4 numbers']);
    expect(pinIssues('48a1')).toEqual(['Use 4 numbers']);
    expect(pinIssues('4817')).toEqual([]);
  });
  it('turns down ones that are easy to guess', () => {
    for (const p of ['0000', '7777', '1234', '4321']) expect(pinIssues(p)).toEqual(['Too easy to guess. Pick another']);
  });
});

describe('checking a PIN', () => {
  it('is never stored as typed, and two people with the same PIN get different hashes', async () => {
    const a = await makePinRecord('4817');
    const b = await makePinRecord('4817');
    expect(JSON.stringify(a)).not.toContain('4817');
    expect(a.hash).not.toBe(b.hash);
  });

  it('lets the right PIN in and resets the count', async () => {
    const r = { ...(await makePinRecord('4817', 'salt')), failures: 2 };
    const out = await checkPin(r, '4817', now);
    expect(out.ok).toBe(true);
    expect(out.record.failures).toBe(0);
  });

  it('counts wrong tries, then locks for five minutes', async () => {
    let r = await makePinRecord('4817', 'salt');
    for (let i = 1; i < PIN_MAX_TRIES; i++) {
      const out = await checkPin(r, '1111', now);
      expect(out).toMatchObject({ ok: false, message: `Wrong PIN. ${PIN_MAX_TRIES - i} ${PIN_MAX_TRIES - i === 1 ? 'try' : 'tries'} left.` });
      r = out.record;
    }
    const locked = await checkPin(r, '1111', now);
    expect(locked).toMatchObject({ ok: false, message: 'Too many wrong tries. Try again in 5 min, or ask your manager.' });
    // Even the right PIN waits out the lock.
    expect((await checkPin(locked.record, '4817', new Date(now.getTime() + 60_000))).ok).toBe(false);
    expect(lockedFor(locked.record, new Date(now.getTime() + 60_000))).toBe(4);
    expect((await checkPin(locked.record, '4817', new Date(now.getTime() + 5 * 60_000))).ok).toBe(true);
  });
});
