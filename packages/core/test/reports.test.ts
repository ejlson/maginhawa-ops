import { describe, expect, it } from 'vitest';
import { dateRange, longDate, reportsCsv, searchReports, type ReportQuery, type ReportRow } from '../src';

/** Example rows only. The Bunso day is the verified example: lunch net £850.00, day net £2,687.50, wages 29.8%. */
const ROWS: ReportRow[] = [
  { siteCode: 'BUN', date: '2026-10-05', source: 'app', net: { lunch: 85000, dinner: 160000, delivery: 23750 }, covers: { lunch: 40, dinner: 65 }, wages: 80088, cashDiff: 0, manager: 'Ana', notes: 'Comp for a wrong order on table 12. Deliveroo refund for a missing side.', discounts: ['Regulars 10%'], voids: ['W2 Dropped plate'] },
  { siteCode: 'BIN', date: '2026-10-03', source: 'app', net: { lunch: 100000, dinner: 280000, delivery: 32000 }, covers: { lunch: 50, dinner: 110 }, wages: 130192, cashDiff: -2000, manager: 'Tom', notes: 'Agency chef covered dinner.' },
  { siteCode: 'BUN', date: '2025-07-12', source: 'workbook', net: { lunch: 90000, dinner: 200000, delivery: 20200 }, covers: { lunch: 45, dinner: 95 }, wages: null, cashDiff: 550, notes: 'Refund paid out in cash, "table 4".' },
];
const Q: ReportQuery = { text: '', site: 'all', dates: 'All', flags: [] };
const TODAY = '2026-10-26';

describe('report search', () => {
  it('lists everything newest first, with totals', () => {
    const r = searchReports(ROWS, Q, TODAY);
    expect(r.hits.map((h) => h.row.date)).toEqual(['2026-10-05', '2026-10-03', '2025-07-12']);
    expect(r.hits[0]!.net).toBe(268750);
    expect(r.hits[0]!.wagePct).toBe(29.8);
    expect(r.net).toBe(268750 + 412000 + 310200);
    expect(r.cashDiff).toBe(-1450);
    // Wages % only counts days that have wages.
    expect(r.wagePct).toBe(Math.round(((80088 + 130192) / (268750 + 412000)) * 1000) / 10);
    expect(r.flagged).toBe(2);
  });

  it('needs every word, across site, date and notes, and shows where it matched', () => {
    const r = searchReports(ROWS, { ...Q, text: 'bunso refund' }, TODAY);
    expect(r.hits).toHaveLength(2);
    expect(r.hits[0]!.match).toMatchObject({ field: 'Note', hit: 'refund' });
    expect(searchReports(ROWS, { ...Q, text: 'october' }, TODAY).hits).toHaveLength(2);
    expect(searchReports(ROWS, { ...Q, text: 'saturday tom' }, TODAY).hits[0]!.match).toMatchObject({ field: 'Manager' });
    expect(searchReports(ROWS, { ...Q, text: 'w2' }, TODAY).hits[0]!.match?.field).toBe('Voids');
    expect(searchReports(ROWS, { ...Q, text: 'bintang refund' }, TODAY).hits).toHaveLength(0);
  });

  it('filters by site, dates and flags', () => {
    expect(searchReports(ROWS, { ...Q, site: 'BIN' }, TODAY).hits).toHaveLength(1);
    expect(searchReports(ROWS, { ...Q, dates: '30D' }, TODAY).hits).toHaveLength(2);
    expect(searchReports(ROWS, { ...Q, dates: 'LY' }, TODAY).hits.map((h) => h.row.date)).toEqual(['2025-07-12']);
    expect(searchReports(ROWS, { ...Q, flags: ['wages'] }, TODAY).hits.map((h) => h.row.siteCode)).toEqual(['BIN']);
    expect(searchReports(ROWS, { ...Q, flags: ['cash'] }, TODAY).hits).toHaveLength(2);
    expect(searchReports(ROWS, { ...Q, flags: ['workbook'] }, TODAY).hits).toHaveLength(1);
  });

  it('works out date ranges and long dates', () => {
    expect(dateRange('7D', TODAY)).toEqual(['2026-10-20', TODAY]);
    expect(dateRange('YTD', TODAY)).toEqual(['2026-01-01', TODAY]);
    expect(longDate('2026-10-05')).toBe('Monday 5 October 2026');
  });

  it('exports rows Excel can read: real dates, pounds, quoted text', () => {
    const csv = reportsCsv(searchReports(ROWS, Q, TODAY).hits);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines).toHaveLength(4);
    expect(lines[1]).toMatch(/^2026-10-05,Monday,Bunso,BUN,850\.00,1600\.00,237\.50,2687\.50,40,65,800\.88,29\.8,0\.00,Ana,/);
    expect(lines[3]).toContain('"Refund paid out in cash, ""table 4""."');
    expect(lines[3]).toMatch(/,,,5\.50,,/);
    expect(lines[3]!.endsWith('Old workbook')).toBe(true);
  });
});
