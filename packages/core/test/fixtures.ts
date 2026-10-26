/** The verified example from HANDOFF.md §5, as a complete draft. Example figures only. */
import { newDraft, type EodDraft } from '../src/schema';
import { DEFAULT_SETTINGS } from '../src/settings';

export const settings = DEFAULT_SETTINGS;

export function verifiedDraft(): EodDraft {
  const d = newDraft({
    clientId: '6f1c2b8e-1d2a-4c3b-9f00-000000000001',
    siteCode: 'BUN',
    businessDate: '2026-10-05',
    platformIds: ['deliveroo', 'ubereats'],
    now: new Date('2026-10-05T23:00:00Z'),
  });
  d.sessions.lunch = {
    ...d.sessions.lunch,
    gross: 120000, serviceCharge: 12000, vat: 18000, discounts: 5000,
    food: 60000, drink: 25000, booked: 28, walkins: 12,
    // £370.00 counted − £150.00 float = £220.00 taken; till says £220.00 → balanced.
    cash: { counted: { '5000': 2, '2000': 7, '1000': 6, '500': 8, '200': 8, '100': 10, '50': 8 }, tillCash: 22000, reason: null, note: '' },
    adjustments: [
      { id: 'a1', kind: 'discount', reason: 'Staff meal 20%', amount: 2000, note: '' },
      { id: 'a2', kind: 'comp', reason: 'Customer complaint', amount: 3000, note: 'table 12' },
    ],
  };
  d.sessions.dinner = {
    ...d.sessions.dinner,
    gross: 240000, serviceCharge: 24000, vat: 36000, discounts: 10000,
    food: 120000, drink: 50000, booked: 52, walkins: 13,
    cash: { counted: { '5000': 5, '2000': 10, '1000': 3, '500': 2, '200': 2, '50': 8 }, tillCash: 34800, reason: null, note: '' },
    adjustments: [{ id: 'a3', kind: 'comp', reason: 'Wrong order', amount: 10000, note: '' }],
  };
  d.delivery = [
    { platformId: 'deliveroo', traded: true, gross: 30000, refundPending: false, note: '' },
    { platformId: 'ubereats', traded: false, gross: null, refundPending: false, note: '' },
  ];
  d.wages = { wageCost: 80000 };
  d.tips = { card: 18640, cash: 4200, toTronc: true };
  d.completed = { lunch: true, dinner: true, delivery: true, wages: true };
  d.confirmed = true;
  return d;
}
