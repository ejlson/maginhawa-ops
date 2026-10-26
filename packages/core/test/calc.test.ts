import { describe, expect, it } from 'vitest';
import {
  adjustmentGap, cash, computeDay, countedTotal, deliveryNet, foodDrink, perHead,
  sessionCovers, sessionNet, tradingDate, wageRag,
} from '../src/calc';
import { emptySession } from '../src/schema';
import { settings, verifiedDraft } from './fixtures';

describe('verified example (HANDOFF.md §5)', () => {
  const day = computeDay(verifiedDraft(), settings);

  it('lunch net is £850.00 with 40 covers', () => {
    expect(day.sessions.lunch.net).toBe(85000);
    expect(day.sessions.lunch.covers).toBe(40);
  });
  it('dinner net is £1,700.00 with 65 covers', () => {
    expect(day.sessions.dinner.net).toBe(170000);
    expect(day.sessions.dinner.covers).toBe(65);
  });
  it('Deliveroo £300 gross is £137.50 net', () => {
    expect(day.delivery.find((d) => d.platformId === 'deliveroo')?.net).toBe(13750);
  });
  it('day total net is £2,687.50', () => {
    expect(day.totalNet).toBe(268750);
  });
  it('wages £800 are 29.8%, green', () => {
    expect(day.wagePct).toBe(29.8);
    expect(day.wageRag).toBe('green');
  });
  it('105 covers and £24.29 net a head dine-in', () => {
    expect(day.covers).toBe(105);
    expect(day.perHeadDineIn).toBe(2429);
  });
  it('total gross includes delivery that traded only', () => {
    expect(day.totalGross).toBe(120000 + 240000 + 30000);
  });
  it('both cash drawers balance', () => {
    expect(day.sessions.lunch.cash.status).toBe('balanced');
    expect(day.sessions.dinner.cash.status).toBe('balanced');
  });
});

describe('net sales', () => {
  it('subtracts discounts (the old form forgot this)', () => {
    expect(sessionNet({ gross: 120000, serviceCharge: 12000, vat: 18000, discounts: 5000 })).toBe(85000);
  });
  it('treats blanks as zero', () => {
    expect(sessionNet({ gross: 10000, serviceCharge: null, vat: null, discounts: null })).toBe(10000);
  });
});

describe('covers and net a head', () => {
  it('covers are booked plus walk-ins', () => {
    expect(sessionCovers({ booked: 28, walkins: 12 })).toBe(40);
    expect(sessionCovers({ booked: null, walkins: 3 })).toBe(3);
  });
  it('net a head is null with no covers', () => {
    expect(perHead(85000, 0)).toBeNull();
    expect(perHead(85000, 40)).toBe(2125);
  });
});

describe('food and drink', () => {
  it('works out % from net, not gross', () => {
    const s = { ...emptySession(), food: 60000, drink: 25000 };
    const r = foodDrink(s, 85000);
    expect(r.foodPct).toBe(70.6);
    expect(r.drinkPct).toBe(29.4);
    expect(r.matches).toBe(true);
  });
  it('flags a mismatch until the manager confirms it', () => {
    const s = { ...emptySession(), food: 60000, drink: 20000 };
    expect(foodDrink(s, 85000)).toMatchObject({ gap: -5000, matches: false, needsCheck: true });
    expect(foodDrink({ ...s, foodDrinkConfirmed: true }, 85000).needsCheck).toBe(false);
  });
  it('says nothing before anything is typed', () => {
    expect(foodDrink(emptySession(), 85000)).toMatchObject({ foodPct: null, matches: true, needsCheck: false });
  });
});

describe('cash', () => {
  const base = { counted: { '5000': 2, '2000': 7, '1000': 6, '500': 8, '200': 8, '100': 10, '50': 8 }, tillCash: 22000, reason: null, note: '' };

  it('counts only the denominations added', () => {
    expect(countedTotal(base.counted)).toBe(37000);
    expect(countedTotal({ '20': 10 })).toBe(200);
  });
  it('takes the £150 float off', () => {
    expect(cash(base, settings).taken).toBe(22000);
  });
  it('within ±£1 is balanced', () => {
    expect(cash({ ...base, tillCash: 22100 }, settings).status).toBe('balanced');
    expect(cash({ ...base, tillCash: 21900 }, settings).status).toBe('balanced');
  });
  it('£1.01 out needs a reason', () => {
    const r = cash({ ...base, tillCash: 22101 }, settings);
    expect(r).toMatchObject({ status: 'short', difference: -101, needsReason: true });
  });
  it('a reason clears the block', () => {
    expect(cash({ ...base, tillCash: 24000, reason: 'Refund paid in cash' }, settings)).toMatchObject({ status: 'short', needsReason: false });
  });
  it('over is the other way', () => {
    expect(cash({ ...base, tillCash: 20000 }, settings)).toMatchObject({ status: 'over', difference: 2000 });
  });
  it('is not started until the till figure is in', () => {
    expect(cash({ ...base, tillCash: null }, settings).status).toBe('not-started');
  });
  it('uses the site float setting', () => {
    expect(cash(base, { ...settings, float: 20000 }).taken).toBe(17000);
  });
});

describe('discount lines', () => {
  it('shows how much is still to list, ignoring voids', () => {
    const s = { ...emptySession(), discounts: 5000, adjustments: [
      { id: '1', kind: 'discount' as const, reason: 'Staff meal', amount: 940, note: '' },
      { id: '2', kind: 'comp' as const, reason: 'Complaint', amount: 1800, note: '' },
      { id: '3', kind: 'void' as const, reason: 'Wrong item', amount: 1200, note: '' },
    ] };
    expect(adjustmentGap(s)).toEqual({ listed: 2740, gap: 2260 });
  });
});

describe('delivery', () => {
  const roo = settings.platforms[0]!;
  it('removes VAT, then applies the platform share', () => {
    expect(deliveryNet({ gross: 30000, traded: true }, roo, 20)).toBe(13750);
  });
  it('uses each platform\'s own share', () => {
    expect(deliveryNet({ gross: 30000, traded: true }, { ...roo, estimatedNetPct: 70 }, 20)).toBe(17500);
  });
  it('skips VAT removal when prices exclude it', () => {
    expect(deliveryNet({ gross: 30000, traded: true }, { ...roo, pricesIncludeVat: false }, 20)).toBe(16500);
  });
  it('is zero when the platform didn\'t trade', () => {
    expect(deliveryNet({ gross: 30000, traded: false }, roo, 20)).toBe(0);
  });
  it('rounds to the penny', () => {
    expect(deliveryNet({ gross: 1001, traded: true }, roo, 20)).toBe(459);
  });
});

describe('wage colours', () => {
  it('green under 30, amber 30 to 35, red over 35', () => {
    expect(wageRag(29.9, settings)).toBe('green');
    expect(wageRag(30, settings)).toBe('amber');
    expect(wageRag(35, settings)).toBe('amber');
    expect(wageRag(35.1, settings)).toBe('red');
    expect(wageRag(null, settings)).toBeNull();
  });
  it('follows the site settings', () => {
    expect(wageRag(31, { wageAmberPct: 32, wageRedPct: 38 })).toBe('green');
  });
});

describe('trading day', () => {
  it('before 04:00 counts as the previous day', () => {
    // 00:31 BST on Tue 6 Oct = 23:31 UTC Mon 5 Oct
    expect(tradingDate(new Date('2026-10-05T23:31:00Z'), settings)).toBe('2026-10-05');
    // 03:59 BST Tue
    expect(tradingDate(new Date('2026-10-06T02:59:00Z'), settings)).toBe('2026-10-05');
  });
  it('from 04:00 counts as the same day', () => {
    expect(tradingDate(new Date('2026-10-06T03:00:00Z'), settings)).toBe('2026-10-06');
  });
  it('works in winter time (GMT)', () => {
    expect(tradingDate(new Date('2026-12-02T03:30:00Z'), settings)).toBe('2026-12-01');
    expect(tradingDate(new Date('2026-12-02T04:00:00Z'), settings)).toBe('2026-12-02');
  });
  it('crosses month and year ends', () => {
    expect(tradingDate(new Date('2027-01-01T01:00:00Z'), settings)).toBe('2026-12-31');
  });
});

describe('sessions that did not run', () => {
  it('count as zero', () => {
    const d = verifiedDraft();
    d.ran.lunch = false;
    const day = computeDay(d, settings);
    expect(day.sessions.lunch.net).toBe(0);
    expect(day.totalNet).toBe(170000 + 13750);
  });
  it('delivery switched off counts as zero', () => {
    const d = verifiedDraft();
    d.ran.delivery = false;
    expect(computeDay(d, settings).deliveryNet).toBe(0);
  });
});

describe('target', () => {
  it('net vs target', () => {
    expect(computeDay(verifiedDraft(), settings, { netSales: 250000 }).netVsTarget).toBe(18750);
    expect(computeDay(verifiedDraft(), settings).netVsTarget).toBeNull();
  });
});
