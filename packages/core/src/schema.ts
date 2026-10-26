import { z } from 'zod';
import { CASH_REASONS } from './settings';

/** Whole pence; null while the manager hasn't typed anything yet. */
const pence = z.number().int().nullable();
const count = z.number().int().min(0).nullable();

export const SESSION_KEYS = ['lunch', 'dinner'] as const;
export type SessionKey = (typeof SESSION_KEYS)[number];

export const SECTION_KEYS = ['lunch', 'dinner', 'delivery', 'promotions', 'wages', 'tips', 'feedback', 'handover'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const AdjustmentLine = z.object({
  id: z.string(),
  kind: z.enum(['discount', 'comp', 'void']),
  reason: z.string().min(1),
  amount: pence,
  note: z.string().default(''),
});
export type AdjustmentLine = z.infer<typeof AdjustmentLine>;

export const CashCount = z.object({
  /** Only the denominations the manager added: pence value → how many. */
  counted: z.record(z.string(), z.number().int().min(0)).default({}),
  tillCash: pence,
  reason: z.enum(CASH_REASONS).nullable().default(null),
  note: z.string().default(''),
});
export type CashCount = z.infer<typeof CashCount>;

export const Session = z.object({
  gross: pence,
  serviceCharge: pence,
  vat: pence,
  discounts: pence,
  food: pence,
  drink: pence,
  booked: count,
  walkins: count,
  /** The manager confirmed food + drink not matching net is right. */
  foodDrinkConfirmed: z.boolean().default(false),
  cash: CashCount,
  adjustments: z.array(AdjustmentLine).default([]),
});
export type Session = z.infer<typeof Session>;

export const DeliveryEntry = z.object({
  platformId: z.string(),
  traded: z.boolean().default(true),
  gross: pence,
  refundPending: z.boolean().default(false),
  note: z.string().default(''),
});
export type DeliveryEntry = z.infer<typeof DeliveryEntry>;

export const NoteItem = z.object({
  id: z.string(),
  category: z.string(),
  body: z.string(),
  /** Feedback only: turn a maintenance note into a repair job. */
  raiseRepair: z.boolean().default(false),
});
export type NoteItem = z.infer<typeof NoteItem>;

export const EodDraft = z.object({
  /** Unique per report, so a retried upload never creates a duplicate. */
  clientId: z.string().uuid(),
  siteCode: z.string().min(2),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ran: z.object({ lunch: z.boolean(), dinner: z.boolean(), delivery: z.boolean() }),
  sessions: z.object({ lunch: Session, dinner: Session }),
  delivery: z.array(DeliveryEntry).default([]),
  promotions: z.object({ notes: z.string().default('') }).default({ notes: '' }),
  wages: z.object({ wageCost: pence }).default({ wageCost: null }),
  tips: z.object({ card: pence, cash: pence, toTronc: z.boolean().default(true) }).default({ card: null, cash: null, toTronc: true }),
  feedback: z.array(NoteItem).default([]),
  handover: z.array(NoteItem).default([]),
  /** Sections the manager has saved as finished. */
  completed: z.record(z.string(), z.boolean()).default({}),
  confirmed: z.boolean().default(false),
  updatedAt: z.string(),
});
export type EodDraft = z.infer<typeof EodDraft>;

export function emptySession(): Session {
  return {
    gross: null, serviceCharge: null, vat: null, discounts: null, food: null, drink: null,
    booked: null, walkins: null, foodDrinkConfirmed: false,
    cash: { counted: {}, tillCash: null, reason: null, note: '' },
    adjustments: [],
  };
}

export function newDraft(opts: { clientId: string; siteCode: string; businessDate: string; platformIds: string[]; now?: Date }): EodDraft {
  return {
    clientId: opts.clientId,
    siteCode: opts.siteCode,
    businessDate: opts.businessDate,
    ran: { lunch: true, dinner: true, delivery: true },
    sessions: { lunch: emptySession(), dinner: emptySession() },
    delivery: opts.platformIds.map((platformId) => ({ platformId, traded: true, gross: null, refundPending: false, note: '' })),
    promotions: { notes: '' },
    wages: { wageCost: null },
    tips: { card: null, cash: null, toTronc: true },
    feedback: [],
    handover: [],
    completed: {},
    confirmed: false,
    updatedAt: (opts.now ?? new Date()).toISOString(),
  };
}
