import { describe, expect, it } from 'vitest';
import { computeDay } from '../src/calc';
import { canSubmit, reviewIssues, sectionProgress, sectionStatus } from '../src/checks';
import { newDraft } from '../src/schema';
import { settings, verifiedDraft } from './fixtures';

const issuesFor = (d = verifiedDraft(), opts = {}) => reviewIssues(d, computeDay(d, settings), settings, opts);
const codes = (d = verifiedDraft(), opts = {}) => issuesFor(d, opts).map((i) => `${i.level}:${i.code}`);

describe('the verified example', () => {
  it('has nothing blocking and can be submitted', () => {
    const d = verifiedDraft();
    const issues = issuesFor(d);
    expect(issues.filter((i) => i.level === 'block')).toEqual([]);
    expect(canSubmit(d, issues)).toBe(true);
  });
  it('cannot be submitted without the confirmation tick', () => {
    const d = verifiedDraft();
    d.confirmed = false;
    expect(canSubmit(d, issuesFor(d))).toBe(false);
  });
});

describe('blocks', () => {
  it('an unexplained cash difference blocks', () => {
    const d = verifiedDraft();
    d.sessions.lunch.cash.tillCash = 24000;
    expect(codes(d)).toContain('block:cash-unexplained');
    expect(canSubmit(d, issuesFor(d))).toBe(false);
  });
  it('a reason turns it into an explained note', () => {
    const d = verifiedDraft();
    d.sessions.lunch.cash.tillCash = 24000;
    d.sessions.lunch.cash.reason = 'Refund paid in cash';
    d.sessions.lunch.cash.note = 'table 4';
    const issue = issuesFor(d).find((i) => i.code === 'cash-explained');
    expect(issue).toMatchObject({ level: 'ok', title: 'Lunch cash £20.00 short', detail: 'Reason: Refund paid in cash · "table 4"' });
  });
  it('a required section left unfinished blocks', () => {
    const d = verifiedDraft();
    d.completed.wages = false;
    expect(codes(d)).toContain('block:section-incomplete');
  });
  it('a section that didn\'t run doesn\'t block', () => {
    const d = verifiedDraft();
    d.completed.delivery = false;
    d.ran.delivery = false;
    expect(codes(d)).not.toContain('block:section-incomplete');
  });
  it('optional sections never block', () => {
    const d = verifiedDraft();
    expect(d.completed.feedback).toBeUndefined();
    expect(canSubmit(d, issuesFor(d))).toBe(true);
  });
});

describe('warnings never block', () => {
  it('food and drink not matching net', () => {
    const d = verifiedDraft();
    d.sessions.lunch.drink = 20000;
    expect(codes(d)).toContain('warn:food-drink-mismatch');
    expect(canSubmit(d, issuesFor(d))).toBe(true);
  });
  it('discount lines short of the till total', () => {
    const d = verifiedDraft();
    d.sessions.lunch.adjustments = d.sessions.lunch.adjustments.slice(0, 1);
    const i = issuesFor(d).find((x) => x.code === 'adjustments-unlisted');
    expect(i?.title).toBe('£30.00 of discounts not itemised');
  });
  it('discounts above 8% of gross', () => {
    const d = verifiedDraft();
    d.sessions.lunch.discounts = 12000;
    expect(codes(d)).toContain('warn:discounts-high');
  });
  it('refund pending on a platform', () => {
    const d = verifiedDraft();
    d.delivery[0]!.refundPending = true;
    expect(codes(d)).toContain('warn:refund-pending');
  });
  it('wages amber and red', () => {
    const d = verifiedDraft();
    d.wages.wageCost = 85000;
    expect(issuesFor(d).find((i) => i.code === 'wages-high')?.detail).toContain('Between');
    d.wages.wageCost = 100000;
    expect(issuesFor(d).find((i) => i.code === 'wages-high')?.detail).toContain('red line');
  });
  it('a big swing on last week (likely a typo)', () => {
    expect(codes(verifiedDraft(), { lastWeekNet: 26000 })).toContain('warn:net-swing');
    expect(codes(verifiedDraft(), { lastWeekNet: 260000 })).not.toContain('warn:net-swing');
  });
});

describe('section status', () => {
  const blank = () => newDraft({ clientId: '6f1c2b8e-1d2a-4c3b-9f00-000000000002', siteCode: 'BUN', businessDate: '2026-10-05', platformIds: ['deliveroo'] });

  it('to do, started, done, skipped', () => {
    const d = blank();
    expect(sectionStatus(d, 'lunch')).toBe('todo');
    d.sessions.lunch.gross = 1000;
    expect(sectionStatus(d, 'lunch')).toBe('started');
    d.completed.lunch = true;
    expect(sectionStatus(d, 'lunch')).toBe('done');
    d.ran.lunch = false;
    expect(sectionStatus(d, 'lunch')).toBe('skipped');
  });
  it('a promotion tag on its own starts the section; a blank one still completes', () => {
    const d = blank();
    expect(d.promotions.tags).toEqual([]);
    expect(sectionStatus(d, 'promotions')).toBe('todo');
    d.promotions.tags = ['Big party'];
    expect(sectionStatus(d, 'promotions')).toBe('started');
    d.promotions.tags = [];
    d.completed.promotions = true;
    expect(sectionStatus(d, 'promotions')).toBe('done');
  });
  it('a draft saved before promotion tags existed still works', () => {
    const d = blank();
    delete d.promotions.tags;
    expect(sectionStatus(d, 'promotions')).toBe('todo');
    expect(sectionProgress(d).active).toBeGreaterThan(0);
  });
  it('progress leaves skipped sections out', () => {
    const d = blank();
    d.ran.delivery = false;
    d.completed.lunch = true;
    expect(sectionProgress(d)).toEqual({ done: 1, active: 7, left: 6 });
  });
});
