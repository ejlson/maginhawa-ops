/**
 * Demo mode keeps the "server" on this device, using the same rules as the real one
 * (@maginhawa/core). Every call re-reads shared storage first, so two tabs of the same
 * browser behave like two devices at one site: open the app twice to try it.
 */
import { MemoryChecklistStore, MemoryPresence, MemoryStore, reportKey, type ChecklistData, type Presence, type StoredReport } from '@maginhawa/core';
import { storage } from './storage';
import { now } from './clock';

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
    const out = await super.setStatus(...args);
    this.persist();
    return out;
  }

  override async markEmailed(...args: Parameters<MemoryStore['markEmailed']>) {
    this.reload();
    await super.markEmailed(...args);
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
export const deviceChecklistStore = () => (sharedChecklists ??= new DeviceChecklistStore(now));
let sharedPresence: DevicePresence | null = null;
export const devicePresence = () => (sharedPresence ??= new DevicePresence());
/** Tests start each case with a clean store. */
export const resetDeviceStore = () => { shared = null; sharedChecklists = null; sharedPresence = null; };

/**
 * Demo mode only: wipes one site's EOD for one day, sent or not, so it can be done again.
 * Other days, other sites and the checklists are left alone. Reload afterwards so the open screens re-read it.
 */
export function resetDemoEod(siteCode: string, businessDate: string) {
  const rows = storage.get<Record<string, StoredReport>>(KEY, {});
  delete rows[reportKey(siteCode, businessDate)];
  storage.set(KEY, rows);
  // This device's copy and its unsent queue, or the old figures would come straight back.
  storage.remove(`mgh.sync.eod.v1.${siteCode}|${businessDate}`);
}

/**
 * Demo mode only: wipes one site's checklists for one day so they can be done again.
 * Other days, other sites and the EOD are left alone. Reload afterwards so the open screens re-read it.
 */
export function resetDemoChecklists(siteCode: string, businessDate: string) {
  const data = storage.get<ChecklistData>('mgh.checklists.v2', { seq: 0, runs: {}, answers: {} });
  const mine = (r: { siteCode: string; businessDate: string }) => r.siteCode === siteCode && r.businessDate === businessDate;
  const gone = new Set(Object.entries(data.runs).filter(([, r]) => mine(r)).map(([k]) => k));
  storage.set('mgh.checklists.v2', {
    ...data,
    runs: Object.fromEntries(Object.entries(data.runs).filter(([k]) => !gone.has(k))),
    answers: Object.fromEntries(Object.entries(data.answers).filter(([, a]) => !(a.siteCode === siteCode && gone.has(a.runKey)))),
  });
  // This device's copy and its unsent queue, or the old answers would come straight back.
  storage.remove(`mgh.sync.checklists.v1.${siteCode}|${businessDate}`);
  sharedChecklists = null;
}
