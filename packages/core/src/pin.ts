/**
 * Staff PINs for the shared kitchen iPad: so a checklist is saved under the person who did it,
 * not whoever last touched the screen. Four digits, never stored as typed, and a short lock after
 * repeated wrong tries. A PIN proves who is at the iPad; it is not a password for anything else.
 */

export const PIN_LENGTH = 4;
/** Wrong tries allowed before the person is locked out for a while. */
export const PIN_MAX_TRIES = 5;
export const PIN_LOCK_MINUTES = 5;

export interface PinRecord {
  /** PBKDF2-SHA-256 of the PIN, hex. */
  hash: string;
  salt: string;
  failures: number;
  lockedUntil: string | null;
}

const EASY = new Set(['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321', '3210']);

/** What's wrong with a new PIN, in plain words. Empty = fine. */
export function pinIssues(pin: string): string[] {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) return [`Use ${PIN_LENGTH} numbers`];
  if (/^(\d)\1+$/.test(pin) || EASY.has(pin)) return ['Too easy to guess. Pick another'];
  return [];
}

const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

export function newSalt(): string {
  return hex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const key = await subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100_000 }, key, 256);
  return hex(bits);
}

export async function makePinRecord(pin: string, salt = newSalt()): Promise<PinRecord> {
  return { hash: await hashPin(pin, salt), salt, failures: 0, lockedUntil: null };
}

export type PinCheck =
  | { ok: true; record: PinRecord }
  | { ok: false; record: PinRecord; message: string };

/** Minutes left on a lock, or 0 if the person can try. */
export function lockedFor(r: Pick<PinRecord, 'lockedUntil'>, now: Date): number {
  if (!r.lockedUntil) return 0;
  return Math.max(0, Math.ceil((Date.parse(r.lockedUntil) - now.getTime()) / 60_000));
}

/** Checks a typed PIN and returns the record to save: tries reset on success, counted on failure. */
export async function checkPin(r: PinRecord, pin: string, now: Date): Promise<PinCheck> {
  const wait = lockedFor(r, now);
  if (wait) return { ok: false, record: r, message: `Too many wrong tries. Try again in ${wait} min, or ask your manager.` };
  if ((await hashPin(pin, r.salt)) === r.hash) return { ok: true, record: { ...r, failures: 0, lockedUntil: null } };
  const failures = r.failures + 1;
  if (failures >= PIN_MAX_TRIES) {
    return { ok: false, record: { ...r, failures: 0, lockedUntil: new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000).toISOString() }, message: `Too many wrong tries. Try again in ${PIN_LOCK_MINUTES} min, or ask your manager.` };
  }
  const left = PIN_MAX_TRIES - failures;
  return { ok: false, record: { ...r, failures }, message: `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.` };
}
