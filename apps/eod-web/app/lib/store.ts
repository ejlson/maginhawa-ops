/**
 * Reports kept on this device (demo mode, and offline drafts in connected mode).
 * Uses the same EodStore interface as the server, so swapping in SharePoint is one line.
 */
import { MemoryStore, reportKey, type StoredReport } from '@maginhawa/core';
import { storage } from './storage';

const KEY = 'mgh.reports.v1';

export class DeviceStore extends MemoryStore {
  constructor() {
    super();
    const saved = storage.get<Record<string, StoredReport>>(KEY, {});
    for (const [k, v] of Object.entries(saved)) this.rows.set(k, v);
  }

  private persist() {
    storage.set(KEY, Object.fromEntries(this.rows));
  }

  override async saveDraft(...args: Parameters<MemoryStore['saveDraft']>) {
    await super.saveDraft(...args);
    this.persist();
  }

  override async submit(...args: Parameters<MemoryStore['submit']>) {
    await super.submit(...args);
    this.persist();
  }

  override async setStatus(...args: Parameters<MemoryStore['setStatus']>) {
    await super.setStatus(...args);
    this.persist();
  }

  /** Synchronous read, so screens can render a saved draft straight away. */
  peek(siteCode: string, businessDate: string): StoredReport | null {
    return this.rows.get(reportKey(siteCode, businessDate)) ?? null;
  }
}

let shared: DeviceStore | null = null;
export const deviceStore = () => (shared ??= new DeviceStore());
/** Tests start each case with a clean store. */
export const resetDeviceStore = () => { shared = null; };
