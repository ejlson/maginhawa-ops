/**
 * Example closes for the head-office view in demo mode, so it shows what a real night looks like.
 * All figures are made up. Never shown once the app is connected.
 */
import { computeDay, deliveryNet, newDraft, reviewIssues, type EodDraft, type Pence, type ReportStatus, type StoredReport, type TradingDayRow } from '@maginhawa/core';
import { settingsFor } from './draft';

interface Example {
  site: string;
  status: ReportStatus | 'none';
  /** Size of the night compared with the base example. */
  scale: number;
  /** Pounds over the expected cash (negative = short). */
  cashOff?: number;
  /** Wage cost in pounds. */
  wages: number;
}

const EXAMPLES: Example[] = [
  { site: 'BIN', status: 'approved', scale: 1.15, wages: 820 },
  { site: 'GUA', status: 'submitted', scale: 0.75, wages: 760 },
  { site: 'BEL', status: 'submitted', scale: 1.3, cashOff: -20, wages: 1010 },
  { site: 'HOO', status: 'draft', scale: 1, wages: 800 },
  { site: 'CAF', status: 'submitted', scale: 0.55, wages: 360 },
  { site: 'MKT', status: 'approved', scale: 1.05, wages: 780 },
  { site: 'MCT', status: 'none', scale: 1, wages: 0 },
];

const p = (pounds: number) => Math.round(pounds * 100);

function exampleDraft(e: Example, businessDate: string): EodDraft {
  const k = e.scale;
  const d = newDraft({ clientId: `demo-${e.site}-${businessDate}`, siteCode: e.site, businessDate, platformIds: ['deliveroo', 'ubereats'] });
  // Cash taken is £220.00 at lunch and £348.00 at dinner (after the £150.00 float); cashOff moves the till figure.
  d.sessions.lunch = {
    ...d.sessions.lunch,
    gross: p(1200 * k), serviceCharge: p(120 * k), vat: p(180 * k), discounts: p(50 * k),
    food: p(600 * k), drink: p(250 * k), booked: Math.round(28 * k), walkins: Math.round(12 * k),
    cash: { counted: { '5000': 2, '2000': 7, '1000': 6, '500': 8, '200': 8, '100': 10, '50': 8 }, tillCash: p(220), reason: null, note: '' },
    adjustments: [{ id: 'l1', kind: 'discount', reason: 'Staff meal 20%', amount: p(50 * k), note: '' }],
  };
  d.sessions.dinner = {
    ...d.sessions.dinner,
    gross: p(2400 * k), serviceCharge: p(240 * k), vat: p(360 * k), discounts: p(100 * k),
    food: p(1200 * k), drink: p(500 * k), booked: Math.round(52 * k), walkins: Math.round(13 * k),
    cash: { counted: { '5000': 5, '2000': 10, '1000': 3, '500': 2, '200': 2, '50': 8 }, tillCash: p(348 - (e.cashOff ?? 0)), reason: e.cashOff ? 'Other' : null, note: '' },
    adjustments: [{ id: 'd1', kind: 'comp', reason: 'Wrong order', amount: p(100 * k), note: '' }],
  };
  d.delivery = [
    { platformId: 'deliveroo', traded: true, gross: p(300 * k), refundPending: false, note: '' },
    { platformId: 'ubereats', traded: false, gross: null, refundPending: false, note: '' },
  ];
  d.wages = { wageCost: p(e.wages) };
  d.tips = { card: p(186 * k), cash: p(42 * k), toTronc: true };
  d.completed = { lunch: true, dinner: true, delivery: true, wages: true };
  d.confirmed = e.status !== 'draft';
  return d;
}

/** Example reports for every site except those that already have a real one on this device. */
export function demoReports(businessDate: string, skip: Set<string>): StoredReport[] {
  return EXAMPLES.filter((e) => e.status !== 'none' && !skip.has(e.site)).map((e) => {
    const draft = exampleDraft(e, businessDate);
    const settings = settingsFor(e.site);
    const result = computeDay(draft, settings);
    const sent = e.status !== 'draft';
    return {
      draft,
      status: e.status as ReportStatus,
      submittedAt: sent ? `${businessDate}T23:${10 + EXAMPLES.indexOf(e) * 4}:00Z` : null,
      submittedBy: sent ? 'Example manager' : null,
      official: sent ? result : null,
      issues: sent ? reviewIssues(draft, result, settings) : [],
    };
  });
}

const NOTES_FEEDBACK = ['Table 6 loved the sisig', 'Slow ticket times on the pass around 8pm', 'Walk-in door seal looks worn'];
const NOTES_HANDOVER = ['Calamansi delivery due 10am', 'Card machine 2 needs charging', 'Two staff on at 11 for prep'];

/**
 * A past day's example close built from the example trading history, so the figures match what
 * Reports and Trends show for that site and day. Made-up figures; never shown once connected.
 */
export function demoReportFromHistory(row: TradingDayRow, approved: boolean): StoredReport {
  const settings = settingsFor(row.siteCode);
  const d = newDraft({ clientId: `demo-${row.siteCode}-${row.date}`, siteCode: row.siteCode, businessDate: row.date, platformIds: ['deliveroo', 'ubereats'] });
  const session = (net: Pence, covers: number, cashOff: number) => {
    // Gross is about 1.41 × net, as in the base example (£1,200.00 gross, £850.00 net).
    const gross = Math.round((net * 1200) / 850);
    const serviceCharge = Math.round(gross * 0.1);
    const vat = Math.round(gross * 0.15);
    const discounts = gross - serviceCharge - vat - net;
    const food = Math.round(net * 0.7);
    const booked = Math.round(covers * 0.7);
    return {
      ...d.sessions.lunch,
      gross, serviceCharge, vat, discounts, food, drink: net - food, booked, walkins: covers - booked,
      cash: { counted: { '5000': 2, '2000': 7, '1000': 6, '500': 8, '200': 8, '100': 10, '50': 8 }, tillCash: 22000 - cashOff, reason: cashOff ? 'Other' as const : null, note: cashOff ? 'Counted twice, still out' : '' },
      adjustments: discounts > 0 ? [{ id: `a${net}`, kind: 'discount' as const, reason: 'Staff meal 20%', amount: discounts, note: '' }] : [],
    };
  };
  d.sessions.lunch = session(row.net.lunch, row.covers.lunch, 0);
  d.sessions.dinner = session(row.net.dinner, row.covers.dinner, row.cashDiff);
  // Find the Deliveroo gross whose net matches the history to the penny.
  const platform = settings.platforms.find((x) => x.id === 'deliveroo')!;
  const guess = Math.round(((row.net.delivery * 100) / platform.estimatedNetPct) * (platform.pricesIncludeVat ? 1 + settings.vatRatePct / 100 : 1));
  let gross = guess;
  for (let g = guess - 5; g <= guess + 5; g++) if (deliveryNet({ gross: g, traded: true }, platform, settings.vatRatePct) === row.net.delivery) { gross = g; break; }
  d.delivery = [
    { platformId: 'deliveroo', traded: row.net.delivery > 0, gross: row.net.delivery > 0 ? gross : null, refundPending: false, note: '' },
    { platformId: 'ubereats', traded: false, gross: null, refundPending: false, note: '' },
  ];
  d.wages = { wageCost: row.wages };
  d.tips = { card: Math.round(row.net.dinner * 0.06), cash: Math.round(row.net.lunch * 0.04), toTronc: true };
  const h = [...(row.siteCode + row.date)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  d.feedback = [{ id: 'f1', category: h % 3 === 2 ? 'Maintenance' : 'Guests', body: NOTES_FEEDBACK[h % 3]!, raiseRepair: h % 3 === 2 }];
  d.handover = [{ id: 'h1', category: 'Opener', body: NOTES_HANDOVER[(h >>> 4) % 3]!, raiseRepair: false }];
  d.completed = { lunch: true, dinner: true, delivery: true, wages: true, tips: true, feedback: true, handover: true };
  d.confirmed = true;
  const result = computeDay(d, settings);
  return {
    draft: d,
    status: approved ? 'approved' : 'submitted',
    submittedAt: `${row.date}T22:${String(20 + (h % 35)).padStart(2, '0')}:00Z`,
    submittedBy: 'Example manager',
    official: result,
    issues: reviewIssues(d, result, settings),
  };
}
