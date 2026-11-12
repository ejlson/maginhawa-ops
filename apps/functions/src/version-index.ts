/**
 * Each site's current version, kept in Workers KV so a poll that finds nothing new
 * never reaches Graph (SharePoint's API is throttled per tenant; KV is not).
 *
 *   EOD:        "eod|BUN|2026-10-05" → the report's version (its ETag), or "none" before anyone starts it
 *   Checklists: "checklists|BUN"     → the highest change cursor at the site
 *
 * Our own writes update the entry straight away. An entry is only trusted for
 * INDEX_TRUST_MS after it was last checked, so a change made outside these functions
 * (someone editing the SharePoint list by hand) still shows up within about a minute.
 */
import type { StoredReport } from '@maginhawa/core';

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

/** The entry, if it is recent enough (within `trustMs`) to answer without asking SharePoint. */
export async function trusted(index: VersionIndex | undefined, key: string, now: number, trustMs = INDEX_TRUST_MS): Promise<string | null> {
  if (!index) return null;
  try {
    const e = await index.get(key);
    return e && now - e.at < trustMs ? e.value : null;
  } catch {
    return null; // Cache unavailable: fall through to SharePoint.
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

/** Records a stored report's version under its site and trading day. */
export const recordReport = (index: VersionIndex | undefined, report: Pick<StoredReport, 'draft' | 'version'>, now: number) =>
  record(index, eodKey(report.draft.siteCode, report.draft.businessDate), report.version, now);

export class MemoryVersionIndex implements VersionIndex {
  entries = new Map<string, IndexEntry>();
  async get(key: string) { return this.entries.get(key) ?? null; }
  async set(key: string, entry: IndexEntry) { this.entries.set(key, entry); }
}

/** The part of a Workers KV namespace we use (so this package needn't depend on Cloudflare's types). */
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/** Entries expire after a day: an old version is only ever a reason to ask SharePoint. */
const KV_TTL_SECONDS = 86_400;

/**
 * Workers KV. Unlike Netlify Blobs it is eventually consistent: another Cloudflare location can
 * see an old entry for up to about 60 seconds. Every entry is only trusted for INDEX_TRUST_MS
 * anyway, so the worst case is a device seeing someone else's change about a minute later.
 * Our users are all in London, so in practice they share one location.
 */
export function kvVersionIndex(kv: KVLike): VersionIndex {
  return {
    get: async (key) => {
      const raw = await kv.get(key);
      return raw ? (JSON.parse(raw) as IndexEntry) : null;
    },
    set: async (key, entry) => { await kv.put(key, JSON.stringify(entry), { expirationTtl: KV_TTL_SECONDS }); },
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
