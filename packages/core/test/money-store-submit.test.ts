import { describe, expect, it } from 'vitest';
import { formatPounds, parseCount, parsePounds, percent, splitPounds } from '../src/money';
import { MemoryStore, toSharePointFields } from '../src/store';
import { submitReport } from '../src/submit';
import { eodSummaryEmail } from '../src/email';
import { settings, verifiedDraft } from './fixtures';

describe('money', () => {
  it('parses what managers type', () => {
    expect(parsePounds('£1,200.00')).toBe(120000);
    expect(parsePounds('1200')).toBe(120000);
    expect(parsePounds(' 12.5 ')).toBe(1250);
    expect(parsePounds('0.1')).toBe(10);
    expect(parsePounds('−20')).toBe(-2000);
  });
  it('rejects nonsense and blanks', () => {
    expect(parsePounds('')).toBeNull();
    expect(parsePounds('abc')).toBeNull();
    expect(parsePounds('12.3.4')).toBeNull();
    expect(parsePounds(null)).toBeNull();
  });
  it('avoids floating-point drift', () => {
    expect(parsePounds('0.29')).toBe(29);
    expect(parsePounds('1.005')).toBe(101);
  });
  it('parses counts', () => {
    expect(parseCount('12')).toBe(12);
    expect(parseCount('1,000')).toBe(1000);
    expect(parseCount('1.5')).toBeNull();
    expect(parseCount('-1')).toBeNull();
  });
  it('formats with £ and a real minus sign', () => {
    expect(formatPounds(268750)).toBe('£2,687.50');
    expect(formatPounds(-2000)).toBe('−£20.00');
    expect(splitPounds(268750)).toEqual(['£2,687', '.50']);
  });
  it('percent to one place', () => {
    expect(percent(80000, 268750)).toBe(29.8);
    expect(percent(1, 0)).toBeNull();
  });
});

describe('submit', () => {
  it('stores official figures worked out on the server', async () => {
    const store = new MemoryStore();
    const res = await submitReport(verifiedDraft(), { store, settings, submittedBy: '[Manager]', now: new Date('2026-10-05T23:31:00Z') });
    expect(res.ok).toBe(true);
    const saved = await store.get('BUN', '2026-10-05');
    expect(saved?.status).toBe('submitted');
    expect(saved?.official?.totalNet).toBe(268750);
  });
  it('ignores tampered totals: figures are always recalculated', async () => {
    const store = new MemoryStore();
    const tampered = { ...verifiedDraft(), totalNet: 999999 };
    const res = await submitReport(tampered, { store, settings, submittedBy: 'x' });
    expect(res.ok && res.report.official?.totalNet).toBe(268750);
  });
  it('refuses when something blocks', async () => {
    const d = verifiedDraft();
    d.sessions.dinner.cash.tillCash = 1;
    const res = await submitReport(d, { store: new MemoryStore(), settings, submittedBy: 'x' });
    expect(res).toMatchObject({ ok: false, error: 'Fix the issues marked in red, then submit again.' });
  });
  it('refuses a badly formed report', async () => {
    const res = await submitReport({ siteCode: 'BUN' }, { store: new MemoryStore(), settings, submittedBy: 'x' });
    expect(res.ok).toBe(false);
  });
  it('refuses a report for another site', async () => {
    const res = await submitReport({ ...verifiedDraft(), siteCode: 'RAM' }, { store: new MemoryStore(), settings, submittedBy: 'x' });
    expect(res).toMatchObject({ ok: false, error: 'This report is for a different site.' });
  });
  it('a retry with the same clientId never duplicates', async () => {
    const store = new MemoryStore();
    await submitReport(verifiedDraft(), { store, settings, submittedBy: 'x' });
    const again = await submitReport(verifiedDraft(), { store, settings, submittedBy: 'x' });
    expect(again.ok).toBe(true);
    expect(await store.listByDate('2026-10-05')).toHaveLength(1);
  });
  it('a second, different submission for the same day is refused', async () => {
    const store = new MemoryStore();
    await submitReport(verifiedDraft(), { store, settings, submittedBy: 'x' });
    const other = { ...verifiedDraft(), clientId: '6f1c2b8e-1d2a-4c3b-9f00-000000000009' };
    const res = await submitReport(other, { store, settings, submittedBy: 'x' });
    expect(res).toMatchObject({ ok: false });
  });
  it('a submitted day cannot be edited as a draft', async () => {
    const store = new MemoryStore();
    await submitReport(verifiedDraft(), { store, settings, submittedBy: 'x' });
    await expect(store.saveDraft(verifiedDraft())).rejects.toThrow('already submitted');
  });
});

describe('SharePoint mapping', () => {
  it('maps to the TradingDays and TradingSessions columns in pounds', async () => {
    const res = await submitReport(verifiedDraft(), { store: new MemoryStore(), settings, submittedBy: 'x', now: new Date('2026-10-05T23:31:00Z') });
    if (!res.ok) throw new Error(res.error);
    const f = toSharePointFields(res.report);
    expect(f.day).toMatchObject({ Title: 'BUN|2026-10-05', Status: 'Submitted', TotalNet: 2687.5, WagePct: 29.8, WageRAG: 'Green', Covers: 105 });
    expect(f.sessions).toHaveLength(2);
    expect(f.sessions[0]).toMatchObject({ Session: 'Lunch', Net: 850, DiscountsComps: 50, CashVariance: 0 });
    expect(f.delivery).toEqual([{ Title: 'BUN|2026-10-05|deliveroo', Platform: 'Deliveroo', Gross: 300, EstimatedNet: 137.5 }]);
  });
});

describe('summary email', () => {
  it('leads with the site, day and net, and lists what to look at', async () => {
    const d = verifiedDraft();
    d.delivery[0]!.refundPending = true;
    const res = await submitReport(d, { store: new MemoryStore(), settings, submittedBy: '[Manager]', now: new Date('2026-10-05T23:31:00Z') });
    if (!res.ok) throw new Error(res.error);
    const email = eodSummaryEmail(res.report, settings);
    expect(email.subject).toBe('EOD · Bunso · Monday 5 October · £2,687.50 net · 1 to look at');
    expect(email.text).toContain('Submitted 00:31 by [Manager]');
    expect(email.text).toContain('Lunch: £850.00 net · 40 covers · cash balanced');
    expect(email.text).toContain('• Deliveroo refund pending');
    expect(email.text).toContain("Uber Eats: didn't trade");
  });
});
