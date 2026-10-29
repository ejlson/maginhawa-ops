/**
 * Each site's current version, kept in Netlify Blobs so a poll that finds nothing new
 * never reaches Graph (SharePoint's API is throttled per tenant; Blobs is not).
 *
 *   EOD:        "eod|BUN|2026-10-05" → the report's version (its ETag), or "none" before anyone starts it
 *   Checklists: "checklists|BUN"     → the highest change cursor at the site
 *
 * Our own writes update the entry straight away. An entry is only trusted for
 * INDEX_TRUST_MS after it was last checked, so a change made outside these functions
 * (someone editing the SharePoint list by hand) still shows up within about a minute.
 */
import { getStore } from '@netlify/blobs';

export interface IndexEntry {
  value: string;
  /** When we last wrote it or checked it against SharePoint (ms since epoch). */
  at: number;
}

export interface VersionIndex {
  get(key: string): Promise<IndexEntry | null>;
  set(key: string, entry: IndexEntry): Promise<void>;
}

export const INDEX_TRUST_MS = 60_000;
/** Stored for a day nobody has started yet, so those polls skip SharePoint too. */
export const NO_REPORT = 'none';

export const eodKey = (site: string, date: string) => `eod|${site}|${date}`;
export const checklistKey = (site: string) => `checklists|${site}`;

/** The entry, if it is recent enough to answer a poll without asking SharePoint. */
export async function trusted(index: VersionIndex | undefined, key: string, now: number): Promise<string | null> {
  if (!index) return null;
  try {
    const e = await index.get(key);
    return e && now - e.at < INDEX_TRUST_MS ? e.value : null;
  } catch {
    return null; // Blobs unavailable: fall through to SharePoint.
  }
}

/** Records a version. A failure here only costs one extra Graph call later. */
export async function record(index: VersionIndex | undefined, key: string, value: string | number | null | undefined, now: number) {
  if (!index || value == null || value === '') return;
  try {
    await index.set(key, { value: String(value), at: now });
  } catch {
    /* ignore */
  }
}

export class MemoryVersionIndex implements VersionIndex {
  entries = new Map<string, IndexEntry>();
  async get(key: string) { return this.entries.get(key) ?? null; }
  async set(key: string, entry: IndexEntry) { this.entries.set(key, entry); }
}

/** Strong consistency, so a write on one function instance is seen by the next poll on another. */
export function blobsVersionIndex(): VersionIndex {
  const store = getStore({ name: 'site-versions', consistency: 'strong' });
  return {
    get: async (key) => (await store.get(key, { type: 'json' })) as IndexEntry | null,
    set: async (key, entry) => { await store.setJSON(key, entry); },
  };
}

/** Like record, but never moves a cursor backwards when two batches finish out of order.
 * An equal cursor still refreshes `at`, so a check that found nothing new extends the trust. */
export async function raise(index: VersionIndex | undefined, key: string, cursor: number, now: number) {
  if (!index || !cursor) return;
  try {
    const e = await index.get(key);
    if (!e || Number(e.value) <= cursor) await index.set(key, { value: String(cursor), at: now });
  } catch {
    /* ignore */
  }
}
