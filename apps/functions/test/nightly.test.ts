import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, MemoryForecastStore, type DayValue, type SiteSettings } from '@maginhawa/core';
import { createForecastJob, createSnapshotJob } from '../src/nightly';

const bun: SiteSettings = { ...DEFAULT_SETTINGS, siteCode: 'BUN', siteName: 'Bunso' };
const bel: SiteSettings = { ...DEFAULT_SETTINGS, siteCode: 'BEL', siteName: 'Belly' };
// 06:15 on Tuesday 6 October 2026 in London (BST): Monday 5 October has just closed.
const now = () => new Date('2026-10-06T05:15:00Z');

/** Example history only: 10 weeks of a steady weekly pattern up to Monday 5 October. */
function history(): DayValue[] {
  const shape = [140000, 90000, 95000, 100000, 120000, 180000, 200000];
  const out: DayValue[] = [];
  const d = new Date('2026-07-28T00:00:00Z');
  while (d.toISOString().slice(0, 10) <= '2026-10-05') {
    out.push({ date: d.toISOString().slice(0, 10), value: shape[d.getUTCDay()]! });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

describe('nightly-snapshot', () => {
  it('saves the next 14 days of bookings for the day that just closed', async () => {
    const store = new MemoryForecastStore();
    const job = createSnapshotJob({
      sites: async () => [bun, bel],
      store,
      now,
      bookingsFor: async (code, from, to) => {
        expect([from, to]).toEqual(['2026-10-06', '2026-10-19']);
        return code === 'BUN' ? { source: 'Example system', days: [{ date: '2026-10-09', session: 'dinner', covers: 54, bookings: 16 }] } : null;
      },
    });
    const res = await job();
    expect(res).toMatchObject({ saved: 1, notConnected: ['BEL'], failed: [], takenOn: { BUN: '2026-10-05' } });
    expect(await store.listSnapshots('BUN')).toEqual([
      { siteCode: 'BUN', takenOn: '2026-10-05', forDate: '2026-10-09', leadDays: 4, session: 'dinner', covers: 54, bookings: 16, source: 'Example system' },
    ]);
  });

  it('one site\'s reservations system failing doesn\'t stop the others', async () => {
    const store = new MemoryForecastStore();
    const job = createSnapshotJob({
      sites: async () => [bun, bel],
      store,
      now,
      bookingsFor: async (code) => {
        if (code === 'BUN') throw new Error('Timed out');
        return { source: 'x', days: [{ date: '2026-10-06', session: 'lunch', covers: 10, bookings: 4 }] };
      },
    });
    const res = await job();
    expect(res.failed).toEqual([{ siteCode: 'BUN', error: 'Timed out' }]);
    expect(await store.listSnapshots('BEL')).toHaveLength(1);
  });
});

describe('nightly-forecast', () => {
  it('logs v1 and both comparison methods for each ready series, 14 days ahead', async () => {
    const store = new MemoryForecastStore();
    const job = createForecastJob({
      sites: async () => [bun],
      store,
      now,
      holidays: async () => new Set(),
      historyFor: async (_code, service, metric) => (service === 'dinner' && metric === 'net' ? history() : []),
    });
    const res = await job();
    expect(res.logged).toBe(42);
    expect(res.skipped.map((s) => `${s.service}/${s.metric}`)).toEqual(['lunch/net', 'lunch/covers', 'dinner/covers', 'delivery/net']);
    const v1 = (await store.listForecasts('BUN')).filter((f) => f.method === 'v1');
    expect(v1).toHaveLength(14);
    // Tuesday 6 October: median of the last 6 Tuesdays.
    expect(v1[0]).toMatchObject({ madeOn: '2026-10-05', forDate: '2026-10-06', horizon: 1, p50: 95000, confidence: 'low', version: 'forecast-v1.0', reasons: 'Median of the last 6 Tuesdays' });
  });

  it('re-running a night replaces its forecasts rather than doubling them', async () => {
    const store = new MemoryForecastStore();
    const job = createForecastJob({
      sites: async () => [bun], store, now, holidays: async () => new Set(),
      historyFor: async (_c, service, metric) => (service === 'dinner' && metric === 'net' ? history() : []),
    });
    await job();
    await job();
    expect(await store.listForecasts('BUN')).toHaveLength(42);
  });
});
