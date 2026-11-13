import { describe, expect, it } from 'vitest';
import {
  accidentState, addMonths, allergenGaps, callPointFor, creditDue, cutOffText, dailyUse, dishCost, dishGp, dishesUsing, doneThisPeriod, dueBy,
  dueStatus, keepsBreaking, orderTotal, priceChangeText, priceForTarget, runsOutText, serviceNextDue, suggestPacks, wasteCsv, wasteShare,
  wasteValue, weekStart, EXPORTS, EXPORT_ORDER, csv,
  type Accident, type Recipe, type SafetyCheck, type ServiceSchedule, type StockItem,
} from '../src';

describe('ordering', () => {
  it('suggests whole packs to get back to the usual level, never negative', () => {
    expect(suggestPacks(4, 15, 5)).toBe(3);
    expect(suggestPacks(10, 15, 5)).toBe(1);
    expect(suggestPacks(15, 15, 5)).toBe(0);
    expect(suggestPacks(20, 15, 5)).toBe(0);
    expect(suggestPacks(1.5, 6, 2)).toBe(3);
  });

  it('totals an order and works out the credit for packs that didn\'t come', () => {
    const lines = [{ itemId: 'pork', packs: 3, packPrice: 4900 }, { itemId: 'chicken', packs: 4, packPrice: 1900 }];
    expect(orderTotal(lines)).toBe(22300);
    expect(creditDue({ lines, missing: { chicken: 1 } })).toBe(1900);
    expect(creditDue({ lines, missing: { chicken: 9 } })).toBe(7600);
  });

  it('price changes, waste value and share in words', () => {
    expect(priceChangeText(4900, 5300)).toBe('+8%');
    expect(priceChangeText(710, 675)).toBe('−5%');
    expect(wasteValue(1.5, 980)).toBe(1470);
    expect(wasteShare(118400, 4821040)).toBe(2.5);
    expect(wasteShare(100, 0)).toBeNull();
  });

  it('time left before the cut-off, in UK time', () => {
    expect(cutOffText(new Date('2026-11-13T11:20:00Z'), '14:00')).toBe('2 h 40 min left');
    expect(cutOffText(new Date('2026-11-13T13:35:00Z'), '14:00')).toBe('25 min left');
    expect(cutOffText(new Date('2026-11-13T15:00:00Z'), '14:00')).toBe('Closed for today');
  });

  it('waste CSV at cost', () => {
    const out = wasteCsv([{ id: 'w', siteCode: 'BUN', itemId: 'pork', qty: 1.5, reason: 'Made too much', unitCost: 980, by: 'Jo', at: '2026-11-13T10:00:00Z' }], () => 'Pork belly', () => 'Bunso');
    expect(out.split('\n')[1]).toBe('Bunso,2026-11-13,Pork belly,1.5,Made too much,9.80,14.70,Jo');
  });
});

describe('recipes and dish costing', () => {
  const items: StockItem[] = [
    { id: 'pork', name: 'Pork belly', category: 'Meat', unit: 'kg', parts: true, costPence: 1060, active: true },
    { id: 'soy', name: 'Soy sauce', category: 'Dry', unit: 'bottles', parts: false, costPence: 520, active: true, allergens: ['Soya', 'Cereals with gluten'] },
  ];
  const adobo: Recipe = {
    id: 'adobo', name: 'Pork adobo', section: 'Mains', pricePence: 1650, perDay: 8, allergens: ['Soya', 'Cereals with gluten'],
    lines: [{ itemId: 'pork', amount: 0.3, shown: '300 g' }, { itemId: 'soy', amount: 0.016, shown: '30 ml' }],
    extras: [{ label: 'Egg, rice, atchara, garnish', costPence: 114 }], steps: [],
  };

  it('costs a plate from today\'s prices, and the GP without VAT', () => {
    expect(dishCost(adobo, items)).toBe(318 + 8 + 114);
    expect(dishGp(1650, 440)).toBe(68);
    expect(dishGp(1550, 360)).toBe(72.1);
  });

  it('the lowest price, in 25p steps, that reaches the target', () => {
    expect(priceForTarget(440, 70)).toBe(1775);
    expect(dishGp(1775, 440)).toBe(70.3);
  });

  it('which dishes use an item, how much a day, and how long it lasts', () => {
    const lechon: Recipe = { ...adobo, id: 'lechon', name: 'Lechon kawali', perDay: 4, lines: [{ itemId: 'pork', amount: 0.25, shown: '250 g' }] };
    expect(dishesUsing('pork', [adobo, lechon]).map((r) => r.id)).toEqual(['adobo', 'lechon']);
    expect(dailyUse('pork', [adobo, lechon])).toBeCloseTo(3.4);
    expect(runsOutText(4, 3.4)).toBe('Runs out tomorrow');
    expect(runsOutText(2, 3.4)).toBe('Runs out today');
    expect(runsOutText(20, 3.4)).toBe('Lasts about 5 days');
    expect(runsOutText(20, 0)).toBeNull();
  });

  it('flags allergens an ingredient carries that the record doesn\'t list', () => {
    expect(allergenGaps(adobo, items)).toEqual([]);
    expect(allergenGaps({ ...adobo, allergens: ['Soya'] }, items)).toEqual([{ allergen: 'Cereals with gluten', itemId: 'soy' }]);
  });
});

describe('health and safety', () => {
  const check = (kind: SafetyCheck['kind'], businessDate: string): SafetyCheck => ({ id: kind + businessDate, siteCode: 'BUN', kind, businessDate, at: businessDate + 'T10:00:00Z', by: 'Jo', answers: [{ q: 'ok', yes: true }] });

  it('weekly checks run Monday to Sunday; monthly to the end of the month', () => {
    expect(weekStart('2026-11-13')).toBe('2026-11-09');
    expect(dueBy('fire-alarm', '2026-11-13')).toBe('2026-11-15');
    expect(dueBy('first-aid', '2026-11-13')).toBe('2026-11-30');
    expect(doneThisPeriod('fire-alarm', [check('fire-alarm', '2026-11-08')], 'BUN', '2026-11-13')).toBeNull();
    expect(doneThisPeriod('fire-alarm', [check('fire-alarm', '2026-11-10')], 'BUN', '2026-11-13')?.businessDate).toBe('2026-11-10');
    expect(doneThisPeriod('extinguishers', [check('extinguishers', '2026-11-02')], 'BUN', '2026-11-13')).not.toBeNull();
  });

  it('call points take turns week by week', () => {
    const points = ['1, front door', '2, bar', '3, kitchen'];
    const a = callPointFor(points, '2026-11-13'), b = callPointFor(points, '2026-11-20'), c = callPointFor(points, '2026-11-27');
    expect(new Set([a, b, c]).size).toBe(3);
    expect(callPointFor(points, '2026-11-10')).toBe(a);
  });

  it('RIDDOR: a worker off more than 7 days must be reported within 15 days', () => {
    const a: Accident = { id: 'a', siteCode: 'MKT', businessDate: '2026-11-04', at: '', who: 'Staff', name: 'KP', what: 'Burn', detail: '', injury: 'Arm', firstAid: 'Yes, other', reportedBy: 'Jo', daysOff: null, hse: null };
    expect(accidentState(a, '2026-11-06')).toEqual({ kind: 'check', on: '2026-11-11' });
    expect(accidentState({ ...a, daysOff: 9 }, '2026-11-13')).toEqual({ kind: 'report', by: '2026-11-19', late: false });
    expect(accidentState({ ...a, daysOff: 9 }, '2026-11-20')).toEqual({ kind: 'report', by: '2026-11-19', late: true });
    expect(accidentState({ ...a, daysOff: 7 }, '2026-11-13')).toEqual({ kind: 'closed' });
    expect(accidentState({ ...a, who: 'Guest', daysOff: 9 }, '2026-11-13')).toEqual({ kind: 'closed' });
    expect(accidentState({ ...a, daysOff: 9, hse: { at: '', ref: 'X1' } }, '2026-11-13')).toEqual({ kind: 'reported' });
  });
});

describe('planned maintenance', () => {
  const gas: ServiceSchedule = { id: 'gas', siteCode: 'BUN', name: 'Gas safety check', kind: 'Gas', everyMonths: 12, contractor: 'Northside Gas', lastDone: '2025-11-19', booked: null };

  it('next due from the last good visit; a failed visit doesn\'t count', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(serviceNextDue(gas, [])).toBe('2026-11-19');
    expect(serviceNextDue(gas, [{ id: 'v', scheduleId: 'gas', businessDate: '2026-11-13', result: 'Failed', certificate: null, by: 'Jo', at: '' }])).toBe('2026-11-19');
    expect(serviceNextDue(gas, [{ id: 'v', scheduleId: 'gas', businessDate: '2026-11-13', result: 'Passed', certificate: 'x.pdf', by: 'Jo', at: '' }])).toBe('2027-11-13');
  });

  it('overdue, due within 30 days, or fine; 3 call-outs in 6 months keeps breaking', () => {
    expect(dueStatus('2026-11-02', '2026-11-13')).toBe('overdue');
    expect(dueStatus('2026-12-04', '2026-11-13')).toBe('soon');
    expect(dueStatus('2027-01-15', '2026-11-13')).toBe('ok');
    expect(keepsBreaking(['2026-06-03', '2026-07-21', '2026-11-04'], '2026-11-13')).toBe(true);
    expect(keepsBreaking(['2026-03-03', '2026-07-21', '2026-11-04'], '2026-11-13')).toBe(false);
  });
});

describe('records and exports', () => {
  it('every choice says what it covers, the law and the keep period', () => {
    expect(EXPORT_ORDER).toHaveLength(5);
    for (const k of EXPORT_ORDER) for (const r of EXPORTS[k].records) expect(r.what && r.law && r.keep).toBeTruthy();
    expect(EXPORTS.accountant.records[0]!.keep).toBe('6 years');
    expect(csv(['A', 'B'], [['x, y', 1]])).toBe('A,B\n"x, y",1');
  });
});
