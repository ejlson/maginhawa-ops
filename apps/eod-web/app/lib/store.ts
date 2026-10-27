/**
 * Demo mode keeps the "server" on this device, using the same rules as the real one
 * (@maginhawa/core). Every call re-reads shared storage first, so two tabs of the same
 * browser behave like two devices at one site: open the app twice to try it.
 */
import { MemoryChecklistStore, MemoryPresence, MemoryStore, reportKey, type ChecklistData, type Presence, type StoredReport } from '@maginhawa/core';
import { storage } from './storage';

const KEY = 'mgh.reports.v1';

export class DeviceStore extends MemoryStore {
  private reload() {
    this.rows.clear();
    for (const [k, v] of Object.entries(storage.get<Record<string, StoredReport>>(KEY, {}))) this.rows.set(k, v);
  }

  private persist() {
    storage.set(KEY, Object.fromEntries(this.rows));
  }

  override async get(...args: Parameters<MemoryStore['get']>) {
    this.reload();
    return super.get(...args);
  }

  override async listByDate(...args: Parameters<MemoryStore['listByDate']>) {
    this.reload();
    return super.listByDate(...args);
  }

  override async saveDraft(...args: Parameters<MemoryStore['saveDraft']>) {
    this.reload();
    const out = await super.saveDraft(...args);
    this.persist();
    return out;
  }

  override async submit(...args: Parameters<MemoryStore['submit']>) {
    this.reload();
    const out = await super.submit(...args);
    this.persist();
    return out;
  }

  override async setStatus(...args: Parameters<MemoryStore['setStatus']>) {
    this.reload();
    await super.setStatus(...args);
    this.persist();
  }

  /** Synchronous read, so screens can render a saved draft straight away. */
  peek(siteCode: string, businessDate: string): StoredReport | null {
    this.reload();
    return this.rows.get(reportKey(siteCode, businessDate)) ?? null;
  }
}

/** Checklist answers, one record per item, shared by the tabs on this device. */
export class DeviceChecklistStore extends MemoryChecklistStore {
  protected override load() {
    this.data = storage.get<ChecklistData>('mgh.checklists.v2', { seq: 0, runs: {}, answers: {} });
  }
  protected override persist() {
    storage.set('mgh.checklists.v2', this.data);
  }
}

export class DevicePresence extends MemoryPresence {
  protected override load() {
    this.board = storage.get<Record<string, Record<string, Presence>>>('mgh.presence.v1', {});
  }
  protected override persist() {
    storage.set('mgh.presence.v1', this.board);
  }
}

let shared: DeviceStore | null = null;
export const deviceStore = () => (shared ??= new DeviceStore());
let sharedChecklists: DeviceChecklistStore | null = null;
export const deviceChecklistStore = () => (sharedChecklists ??= new DeviceChecklistStore());
let sharedPresence: DevicePresence | null = null;
export const devicePresence = () => (sharedPresence ??= new DevicePresence());
/** Tests start each case with a clean store. */
export const resetDeviceStore = () => { shared = null; sharedChecklists = null; sharedPresence = null; };
