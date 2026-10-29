import { describe, expect, it } from 'vitest';
import { IDLE_AFTER_MS, PollingTransport, type LiveEnv } from '../src/live';

function fakeEnv() {
  let t = 0;
  let tick: (() => void) | null = null;
  const listeners = new Map<string, Set<() => void>>();
  const env: LiveEnv & { visible: boolean } = {
    visible: true,
    addEventListener: (type, fn) => { listeners.set(type, (listeners.get(type) ?? new Set()).add(fn)); },
    removeEventListener: (type, fn) => { listeners.get(type)?.delete(fn); },
    isVisible: () => env.visible,
    setInterval: (fn) => { tick = fn; return 1; },
    clearInterval: () => { tick = null; },
    now: () => t,
  };
  /** Moves the clock on in 10 s steps, running the interval each time. */
  const advance = (ms: number) => { for (let i = 0; i < ms / 10_000; i++) { t += 10_000; tick?.(); } };
  const fire = (type: string) => listeners.get(type)?.forEach((fn) => fn());
  return { env, advance, fire, listeners };
}

describe('polling', () => {
  it('every 10 s while in use, every 30 s once idle, and catches up on a tap', () => {
    const { env, advance, fire } = fakeEnv();
    let pokes = 0;
    new PollingTransport(env).subscribe('eod', () => pokes++);
    advance(IDLE_AFTER_MS - 10_000);
    expect(pokes).toBe(11); // every 10 s until two minutes untouched
    pokes = 0;
    advance(60_000);
    expect(pokes).toBe(2); // idle: 30 s
    fire('pointerdown');
    expect(pokes).toBe(3); // picked up: refresh at once
    advance(30_000);
    expect(pokes).toBe(6); // back to 10 s
  });

  it('never while hidden, and straight away when shown again', () => {
    const { env, advance, fire } = fakeEnv();
    let pokes = 0;
    new PollingTransport(env).subscribe('eod', () => pokes++);
    env.visible = false;
    advance(60_000);
    expect(pokes).toBe(0);
    env.visible = true;
    fire('visibilitychange');
    expect(pokes).toBe(1);
  });

  it('unsubscribing removes every listener', () => {
    const { env, listeners } = fakeEnv();
    new PollingTransport(env).subscribe('eod', () => {})();
    expect([...listeners.values()].every((s) => s.size === 0)).toBe(true);
  });
});
