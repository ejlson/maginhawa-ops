/**
 * Live updates between devices. Screens don't care how a change arrives: a transport
 * just "pokes" a topic, and the screen's sync client fetches what changed (cheaply,
 * with If-None-Match or a since-cursor). Polling now; a push service such as Azure Web
 * PubSub can implement LiveTransport later without touching the screens.
 */

export interface LiveTransport {
  /** Calls `poke` whenever `topic` may have changed. Returns an unsubscribe function. */
  subscribe(topic: string, poke: () => void): () => void;
}

/** The bits of `window` and `document` polling needs, so tests can pass their own. */
export interface LiveEnv {
  addEventListener(type: 'focus' | 'online' | 'visibilitychange', fn: () => void): void;
  removeEventListener(type: 'focus' | 'online' | 'visibilitychange', fn: () => void): void;
  isVisible(): boolean;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

/** Pokes every ~10 s while the screen is visible, and straight away on focus or when back online. */
export class PollingTransport implements LiveTransport {
  constructor(private env: LiveEnv, private intervalMs = 10_000) {}

  subscribe(_topic: string, poke: () => void) {
    const tick = () => { if (this.env.isVisible()) poke(); };
    const id = this.env.setInterval(tick, this.intervalMs);
    const events = ['focus', 'online', 'visibilitychange'] as const;
    for (const e of events) this.env.addEventListener(e, tick);
    return () => {
      this.env.clearInterval(id);
      for (const e of events) this.env.removeEventListener(e, tick);
    };
  }
}

/** Pokes only when told to: for tests and for a push service's message handler. */
export class ManualTransport implements LiveTransport {
  private subs = new Map<string, Set<() => void>>();
  subscribe(topic: string, poke: () => void) {
    const set = this.subs.get(topic) ?? new Set();
    set.add(poke);
    this.subs.set(topic, set);
    return () => { set.delete(poke); };
  }
  poke(topic: string) {
    for (const fn of this.subs.get(topic) ?? []) fn();
  }
}

export interface Presence {
  /** One per device, so the same person on the iPad and their phone shows once per device. */
  deviceId: string;
  who: string;
  /** What they have open, e.g. "Dinner". Null = just the overview. */
  where: string | null;
  at: string;
}

export interface PresenceRemote {
  /** Says "I'm here", and returns who else is here (not this device). */
  beat(scope: string, me: Presence): Promise<Presence[]>;
}

/** Someone counts as here for 30 seconds after their last beat (three polls). */
export const PRESENCE_TTL_MS = 30_000;

export class MemoryPresence implements PresenceRemote {
  protected board: Record<string, Record<string, Presence>> = {};
  protected load() { /* the device version re-reads shared storage here */ }
  protected persist() { /* and writes it back here */ }

  async beat(scope: string, me: Presence) {
    this.load();
    const here = (this.board[scope] ??= {});
    here[me.deviceId] = { ...me };
    const cutoff = new Date(me.at).getTime() - PRESENCE_TTL_MS;
    for (const [id, p] of Object.entries(here)) if (new Date(p.at).getTime() < cutoff) delete here[id];
    this.persist();
    return Object.values(here).filter((p) => p.deviceId !== me.deviceId).map((p) => ({ ...p }));
  }
}

/** "Jo is in Dinner", "Jo and Sam are here". Null when nobody else is. */
export function presenceText(others: Presence[]): string | null {
  const seen = new Map<string, Presence>();
  for (const p of others) if (!seen.has(p.who) || p.where) seen.set(p.who, p);
  const list = [...seen.values()];
  if (!list.length) return null;
  if (list.length === 1) return `${list[0]!.who} is ${list[0]!.where ? `in ${list[0]!.where}` : 'here too'}`;
  const names = list.map((p) => p.who);
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are here too`;
}

/** Small key-value storage on the device (localStorage in the app). */
export interface KeyValue {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): unknown;
}

export const memoryKeyValue = (): KeyValue => {
  const m = new Map<string, string>();
  return {
    get: <T,>(k: string, fallback: T) => (m.has(k) ? (JSON.parse(m.get(k)!) as T) : fallback),
    set: (k: string, v: unknown) => m.set(k, JSON.stringify(v)),
  };
};
