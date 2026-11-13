import { describe, expect, it } from 'vitest';
import {
  areaProgress, areasFor, costOfSales, costsNow, countValue, dueOn, grossProfitPct, isSwing, lastQty, nextArea, nextDue, parseQty,
  qtyOf, qtyText, stockScheduleText, sendProblem, stepQty, stockCorrectionProblem, stockCsv, swings, uncounted,
  type StockArea, type StockCount, type StockItem, type StockPlan,
} from '../src/stock';

const items: StockItem[] = [
  { id: 'rum', name: 'Tanduay rum', category: 'Spirits', unit: 'bottles', parts: true, costPence: 1420, active: true },
  { id: 'pro', name: 'Prosecco', category: 'Wine', unit: 'bottles', parts: false, costPence: 710, active: true },
  { id: 'ube', name: 'Ube jam', category: 'Dry goods', unit: 'jars', parts: false, costPence: null, active: true },
  { id: 'old', name: 'Old gin', category: 'Spirits', unit: 'bottles', parts: true, costPence: 1200, active: false },
];
const areas: StockArea[] = [
  { id: 'bar', siteCode: 'BUN', name: 'Bar', itemIds: ['rum', 'old', 'pro'] },
  { id: 'dry', siteCode: 'BUN', name: 'Dry store', itemIds: ['ube'] },
  { id: 'gbar', siteCode: 'GUA', name: 'Bar', itemIds: ['rum'] },
];

function count(over: Partial<StockCount> = {}): StockCount {
  return {
    id: 'c1', siteCode: 'BUN', planId: 'full', name: 'Full stocktake', kind: 'full', businessDate: '2026-11-29',
    startedAt: '2026-11-29T09:00:00Z', startedBy: 'Jo',
    areas: [{ id: 'bar', name: 'Bar', itemIds: ['rum', 'pro'] }, { id: 'dry', name: 'Dry store', itemIds: ['ube'] }],
    lines: {}, sentAt: null, sentBy: null, corrections: [], ...over,
  };
}
const line = (qty: number, by = 'Jo') => ({ qty, by, at: '2026-11-29T09:10:00Z' });

describe('schedules', () => {
  it('daily, set weekdays and every 4 weeks', () => {
    expect(dueOn({ kind: 'daily' }, '2026-11-12')).toBe(true);
    expect(dueOn({ kind: 'weekdays', days: [1, 4] }, '2026-11-12')).toBe(true); // Thursday
    expect(dueOn({ kind: 'weekdays', days: [1, 4] }, '2026-11-13')).toBe(false);
    expect(dueOn({ kind: 'every4weeks', from: '2026-11-01' }, '2026-11-29')).toBe(true);
    expect(dueOn({ kind: 'every4weeks', from: '2026-11-01' }, '2026-11-22')).toBe(false);
    expect(dueOn({ kind: 'every4weeks', from: '2026-11-01' }, '2026-10-04')).toBe(false);
  });

  it('finds the next due day and says the schedule in words', () => {
    expect(nextDue({ kind: 'every4weeks', from: '2026-11-01' }, '2026-11-12')).toBe('2026-11-29');
    expect(nextDue({ kind: 'weekdays', days: [1, 4] }, '2026-11-13')).toBe('2026-11-16');
    expect(stockScheduleText({ kind: 'weekdays', days: [4, 1] })).toBe('Mon and Thu');
    expect(stockScheduleText({ kind: 'daily' })).toBe('Every day');
  });
});

describe('starting a count', () => {
  it('a full count takes every live item in shelf order, at its own site only', () => {
    const plan: StockPlan = { id: 'full', siteCode: 'BUN', name: 'Full stocktake', kind: 'full', schedule: { kind: 'daily' } };
    expect(areasFor(plan, areas, items)).toEqual([
      { id: 'bar', name: 'Bar', itemIds: ['rum', 'pro'] },
      { id: 'dry', name: 'Dry store', itemIds: ['ube'] },
    ]);
  });

  it('a spot count keeps only its items and drops empty areas', () => {
    const plan: StockPlan = { id: 'bar', siteCode: 'BUN', name: 'Bar spot count', kind: 'spot', schedule: { kind: 'daily' }, itemIds: ['pro'] };
    expect(areasFor(plan, areas, items)).toEqual([{ id: 'bar', name: 'Bar', itemIds: ['pro'] }]);
  });
});

describe('quantities', () => {
  it('part units only where allowed, to one decimal place', () => {
    expect(parseQty('5.4', true)).toBe(5.4);
    expect(parseQty('5,4', true)).toBe(5.4);
    expect(parseQty('5.45', true)).toBeNull();
    expect(parseQty('5.4', false)).toBeNull();
    expect(parseQty(' 12 ', false)).toBe(12);
    expect(parseQty('', false)).toBeNull();
    expect(parseQty('-1', false)).toBeNull();
  });

  it('− and + keep tenths exact and never go below zero', () => {
    expect(stepQty(5.4, 1)).toBe(6.4);
    expect(stepQty(0.3, -1)).toBe(0);
    expect(qtyText(1, 'bottles')).toBe('1 bottle');
    expect(qtyText(5.4, 'bottles')).toBe('5.4 bottles');
  });
});

describe('progress and sending', () => {
  it('areas go to do → started → done; the next area is the first not done', () => {
    const c = count({ lines: { rum: line(5.4, 'Jo'), pro: line(4, 'Sam') } });
    expect(areaProgress(c).map((a) => [a.name, a.status, a.by])).toEqual([['Bar', 'done', ['Jo', 'Sam']], ['Dry store', 'todo', []]]);
    expect(nextArea(c)?.name).toBe('Dry store');
    expect(uncounted(c)).toEqual(['ube']);
  });

  it('only uncounted items stop sending', () => {
    expect(sendProblem(count({ lines: { rum: line(1) } }))).toBe('Count the last 2 first');
    expect(sendProblem(count({ lines: { rum: line(1), pro: line(0), ube: line(3) } }))).toBeNull();
    expect(sendProblem(count({ sentAt: 'x', lines: { rum: line(1), pro: line(0), ube: line(3) } }))).toBe('Already sent');
  });
});

describe('swings against last time', () => {
  it('more than half above or below last time', () => {
    expect(isSwing(4, 18)).toBe(true);
    expect(isSwing(10, 18)).toBe(false);
    expect(isSwing(28, 18)).toBe(true);
    expect(isSwing(5, null)).toBe(false);
    expect(isSwing(5, 0)).toBe(false);
  });

  it('compares with the latest sent count at the same site, corrections included', () => {
    const older = count({ id: 'a', startedAt: '2026-11-01T09:00:00Z', sentAt: 'x', lines: { pro: line(30) } });
    const last = count({ id: 'b', startedAt: '2026-11-08T09:00:00Z', sentAt: 'x', lines: { pro: line(10) }, corrections: [{ itemId: 'pro', from: 10, to: 18, reason: 'Missed a case', by: 'Jo', at: '' }] });
    const unsent = count({ id: 'd', startedAt: '2026-11-10T09:00:00Z', lines: { pro: line(2) } });
    const other = count({ id: 'e', siteCode: 'GUA', startedAt: '2026-11-09T09:00:00Z', sentAt: 'x', lines: { pro: line(99) } });
    const now = count({ id: 'c', lines: { pro: { ...line(4), okay: true }, rum: line(5) } });
    const all = [older, last, unsent, other, now];
    expect(lastQty(all, 'BUN', 'pro', now)).toBe(18);
    expect(swings(now, all)).toEqual([{ itemId: 'pro', qty: 4, last: 18, okay: true }]);
  });
});

describe('value', () => {
  it('adds each line in pence and lists items with no cost', () => {
    const c = count({ lines: { rum: line(5.4), pro: line(4), ube: line(3) } });
    // 5.4 × £14.20 = £76.68; 4 × £7.10 = £28.40.
    expect(countValue(c, items)).toEqual({ value: 10508, noCost: ['ube'] });
  });

  it('uses the costs fixed when the count was sent, and corrected figures', () => {
    const c = count({ lines: { rum: line(5.4), pro: line(4), ube: line(3) } });
    c.costs = costsNow(c, items);
    const dearer = items.map((i) => (i.id === 'pro' ? { ...i, costPence: 999 } : i));
    expect(countValue(c, dearer).value).toBe(10508);
    c.corrections.push({ itemId: 'pro', from: 4, to: 6, reason: 'Two in the back', by: 'Jo', at: '' });
    expect(qtyOf(c, 'pro')).toBe(6);
    expect(countValue(c, dearer).value).toBe(7668 + 4260);
  });

  it('cost of sales and GP%', () => {
    const cos = costOfSales({ opening: 841260, purchases: 1200000, closing: 823640 });
    expect(cos).toBe(1217620);
    expect(grossProfitPct(4128600, cos)).toBe(70.5);
    expect(grossProfitPct(0, cos)).toBeNull();
    expect(costOfSales({ opening: 100, purchases: 50, closing: 80, transfersIn: 10, transfersOut: 20 })).toBe(60);
  });
});

describe('corrections and export', () => {
  it('a correction needs a new figure and a reason', () => {
    expect(stockCorrectionProblem({ previous: 4, value: 6, reason: 'Two in the back' })).toBeNull();
    expect(stockCorrectionProblem({ previous: 4, value: 4, reason: 'Two in the back' })).toMatch(/same/);
    expect(stockCorrectionProblem({ previous: 4, value: 6, reason: '' })).toMatch(/why/);
    expect(stockCorrectionProblem({ previous: 4, value: null, reason: 'Two in the back' })).toMatch(/right figure/);
  });

  it('CSV: one row per counted item, pounds ex VAT, commas quoted', () => {
    const c = count({ lines: { rum: line(5.4), pro: line(4) } });
    c.corrections.push({ itemId: 'pro', from: 4, to: 6, reason: 'Two in the back, by the ice', by: 'Jo', at: '' });
    const csv = stockCsv([c], items, () => 'Bunso').split('\n');
    expect(csv[0]).toBe('Site,Date,Count,Area,Item,Unit,Quantity,Unit cost (£),Value (£),Counted by,Corrected');
    expect(csv[1]).toBe('Bunso,2026-11-29,Full stocktake,Bar,Tanduay rum,bottles,5.4,14.20,76.68,Jo,');
    expect(csv[2]).toBe('Bunso,2026-11-29,Full stocktake,Bar,Prosecco,bottles,6,7.10,42.60,Jo,"4 → 6: Two in the back, by the ice"');
    expect(csv).toHaveLength(3);
  });
});
