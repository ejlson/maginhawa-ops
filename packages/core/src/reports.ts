/**
 * Finance's report search: every site's trading days, from the app and from the old Excel workbook,
 * searched by words and filtered by site, dates and flags. Also writes the Excel (CSV) export.
 */
import { addDays, weekday, WEEKDAY_NAMES } from './data-quality';
import { formatPounds, type Pence } from './money';
import { DEFAULT_SETTINGS, siteName } from './settings';
import { dayNet, type TradingDayRow } from './trends';

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

/** One site's trading day as finance sees it: the official figures plus who sent it and what they wrote. */
export interface ReportRow extends TradingDayRow {
  /** Where the row came from: an EOD sent in the app, or imported from the old workbook. */
  source: 'app' | 'workbook';
  manager?: string;
  notes?: string;
  /** Discount and comp reasons, and void codes, as listed on the report. */
  discounts?: string[];
  voids?: string[];
}

export type ReportFlag = 'wages' | 'cash' | 'workbook';
export type ReportDates = '7D' | '30D' | 'YTD' | 'LY' | 'All';
export const REPORT_DATES: { id: ReportDates; label: string }[] = [
  { id: '7D', label: 'Last 7 days' },
  { id: '30D', label: 'Last 30 days' },
  { id: 'YTD', label: 'This year' },
  { id: 'LY', label: 'Last year' },
  { id: 'All', label: 'Any date' },
];

export interface ReportQuery {
  text: string;
  /** A site code, or 'all'. */
  site: string;
  dates: ReportDates;
  flags: ReportFlag[];
}

export interface ReportMatch {
  field: 'Note' | 'Manager' | 'Discounts' | 'Voids';
  before: string;
  hit: string;
  after: string;
}

export interface ReportHit {
  row: ReportRow;
  siteName: string;
  net: Pence;
  covers: number;
  wagePct: number | null;
  /** Wages at or over the amber threshold. */
  wagesHigh: boolean;
  cashOff: boolean;
  /** Set when the words matched the notes, manager, discounts or voids rather than the site or date. */
  match: ReportMatch | null;
}

export interface ReportResult {
  hits: ReportHit[];
  net: Pence;
  covers: number;
  /** Wages as a share of net, across the days that have wages. */
  wagePct: number | null;
  cashDiff: Pence;
  flagged: number;
}


/** "Monday 5 October 2026", which is what people type when they search by date. */
export function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${WEEKDAY_NAMES[weekday(date)]} ${d} ${MONTH_NAMES[m! - 1]} ${y}`;
}

/** The first and last day a date filter covers, up to `today` (the last finished trading day). */
export function dateRange(dates: ReportDates, today: string): [string, string] {
  const year = today.slice(0, 4);
  switch (dates) {
    case '7D': return [addDays(today, -6), today];
    case '30D': return [addDays(today, -29), today];
    case 'YTD': return [`${year}-01-01`, today];
    case 'LY': return [`${+year - 1}-01-01`, `${+year - 1}-12-31`];
    default: return ['0000-01-01', today];
  }
}

const wagePctOf = (r: TradingDayRow): number | null => {
  const net = dayNet(r);
  return r.wages === null || net <= 0 ? null : Math.round((r.wages / net) * 1000) / 10;
};

function snippet(field: ReportMatch['field'], text: string, at: number, len: number): ReportMatch {
  const start = Math.max(0, at - 32);
  const end = Math.min(text.length, at + len + 48);
  return {
    field,
    before: (start > 0 ? '…' : '') + text.slice(start, at),
    hit: text.slice(at, at + len),
    after: text.slice(at + len, end) + (end < text.length ? '…' : ''),
  };
}

/**
 * Filters and searches the rows, newest first. Every word typed must appear somewhere in the row
 * (site, date, manager, notes, discounts or voids), so "bunso refund" finds Bunso days with a refund.
 */
export function searchReports(rows: ReportRow[], q: ReportQuery, today: string, wageAmberPct = DEFAULT_SETTINGS.wageAmberPct): ReportResult {
  const [from, to] = dateRange(q.dates, today);
  const words = q.text.toLowerCase().split(/\s+/).filter(Boolean);
  const hits: ReportHit[] = [];
  for (const row of rows) {
    if (q.site !== 'all' && row.siteCode !== q.site) continue;
    if (row.date < from || row.date > to) continue;
    const wagePct = wagePctOf(row);
    const wagesHigh = wagePct !== null && wagePct >= wageAmberPct;
    const cashOff = row.cashDiff !== 0;
    if (q.flags.includes('wages') && !wagesHigh) continue;
    if (q.flags.includes('cash') && !cashOff) continue;
    if (q.flags.includes('workbook') && row.source !== 'workbook') continue;

    const name = siteName(row.siteCode);
    let match: ReportMatch | null = null;
    if (words.length) {
      const fields: [ReportMatch['field'], string][] = [
        ['Note', row.notes ?? ''],
        ['Manager', row.manager ?? ''],
        ['Discounts', (row.discounts ?? []).join(' · ')],
        ['Voids', (row.voids ?? []).join(' · ')],
      ];
      const head = `${name} ${row.siteCode} ${longDate(row.date)} ${row.date}`.toLowerCase();
      const all = `${head} ${fields.map(([, t]) => t).join(' ')}`.toLowerCase();
      if (!words.every((w) => all.includes(w))) continue;
      // Show where the first word that isn't in the site or date turned up.
      const w = words.find((x) => !head.includes(x));
      if (w) {
        for (const [field, text] of fields) {
          const at = text.toLowerCase().indexOf(w);
          if (at >= 0) { match = snippet(field, text, at, w.length); break; }
        }
      }
    }
    hits.push({ row, siteName: name, net: dayNet(row), covers: row.covers.lunch + row.covers.dinner, wagePct, wagesHigh, cashOff, match });
  }
  hits.sort((a, b) => b.row.date.localeCompare(a.row.date) || a.siteName.localeCompare(b.siteName));

  const net = hits.reduce((s, h) => s + h.net, 0);
  const withWages = hits.filter((h) => h.row.wages !== null);
  const wageNet = withWages.reduce((s, h) => s + h.net, 0);
  const wages = withWages.reduce((s, h) => s + (h.row.wages ?? 0), 0);
  return {
    hits,
    net,
    covers: hits.reduce((s, h) => s + h.covers, 0),
    wagePct: wageNet > 0 ? Math.round((wages / wageNet) * 1000) / 10 : null,
    cashDiff: hits.reduce((s, h) => s + h.row.cashDiff, 0),
    flagged: hits.filter((h) => h.wagesHigh || h.cashOff).length,
  };
}

/** "£20.00 short", "£5.50 over" or "Balanced": words, not signs. */
export function cashWords(p: Pence): string {
  return p === 0 ? 'Balanced' : `${formatPounds(Math.abs(p))} ${p < 0 ? 'short' : 'over'}`;
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const pounds = (p: Pence) => (p / 100).toFixed(2);

/**
 * The export finance opens in Excel: one row per site per day, in pounds, with real dates
 * (yyyy-mm-dd, which Excel reads as a date) rather than Excel serial numbers. Starts with a BOM so
 * Excel reads £ and accents correctly.
 */
export function reportsCsv(hits: ReportHit[]): string {
  const head = ['Date', 'Day', 'Site', 'Site code', 'Lunch net', 'Dinner net', 'Delivery net', 'Total net', 'Lunch covers', 'Dinner covers', 'Wages', 'Wages %', 'Cash difference', 'Manager', 'Notes', 'Discounts', 'Voids', 'Source'];
  const lines = hits.map(({ row: r, siteName: name, net, wagePct }) => [
    r.date, WEEKDAY_NAMES[weekday(r.date)]!, name, r.siteCode,
    pounds(r.net.lunch), pounds(r.net.dinner), pounds(r.net.delivery), pounds(net),
    r.covers.lunch, r.covers.dinner,
    r.wages === null ? '' : pounds(r.wages), wagePct === null ? '' : wagePct.toFixed(1),
    pounds(r.cashDiff), r.manager ?? '', r.notes ?? '', (r.discounts ?? []).join('; '), (r.voids ?? []).join('; '),
    r.source === 'workbook' ? 'Old workbook' : 'App',
  ].map(csvCell).join(','));
  return '﻿' + [head.join(','), ...lines].join('\r\n') + '\r\n';
}
