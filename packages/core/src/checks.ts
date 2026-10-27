/**
 * Review checks. Only real errors block submit (an unexplained cash difference,
 * a required section left empty). Everything unusual is a warning.
 */
import { formatPounds, percent, type Pence } from './money';
import type { SiteSettings } from './settings';
import { SECTION_KEYS, type EodDraft, type SectionKey, type SessionKey } from './schema';
import type { DayResult } from './calc';

export type IssueLevel = 'block' | 'warn' | 'ok';

export interface Issue {
  level: IssueLevel;
  code: string;
  section: SectionKey;
  title: string;
  detail: string;
}

export type SectionStatus = 'todo' | 'started' | 'done' | 'skipped';

export const SECTION_LABELS: Record<SectionKey, string> = {
  lunch: 'Lunch',
  dinner: 'Dinner',
  delivery: 'Delivery',
  promotions: 'Promotions & other',
  wages: 'Wages',
  tips: 'Tips & service charge',
  feedback: 'Feedback',
  handover: 'Handover',
};

/** Sections that must be finished before submit (when they ran). The rest are optional. */
export const REQUIRED_SECTIONS: SectionKey[] = ['lunch', 'dinner', 'delivery', 'wages'];

function hasInput(d: EodDraft, key: SectionKey): boolean {
  switch (key) {
    case 'lunch':
    case 'dinner': {
      const s = d.sessions[key];
      return [s.gross, s.serviceCharge, s.vat, s.discounts, s.food, s.drink, s.booked, s.walkins, s.cash.tillCash].some((x) => x !== null)
        || Object.keys(s.cash.counted).length > 0 || s.adjustments.length > 0;
    }
    case 'delivery': return d.delivery.some((e) => e.gross !== null || !e.traded);
    case 'promotions': return d.promotions.notes.trim() !== '' || (d.promotions.tags?.length ?? 0) > 0;
    case 'wages': return d.wages.wageCost !== null;
    case 'tips': return d.tips.card !== null || d.tips.cash !== null;
    case 'feedback': return d.feedback.length > 0;
    case 'handover': return d.handover.length > 0;
  }
}

export function sectionStatus(d: EodDraft, key: SectionKey): SectionStatus {
  if ((key === 'lunch' || key === 'dinner' || key === 'delivery') && !d.ran[key]) return 'skipped';
  if (d.completed[key]) return 'done';
  return hasInput(d, key) ? 'started' : 'todo';
}

export function sectionProgress(d: EodDraft): { done: number; active: number; left: number } {
  const statuses = SECTION_KEYS.map((k) => sectionStatus(d, k)).filter((s) => s !== 'skipped');
  const done = statuses.filter((s) => s === 'done').length;
  return { done, active: statuses.length, left: statuses.length - done };
}

function sessionIssues(d: EodDraft, r: DayResult, key: SessionKey, settings: SiteSettings): Issue[] {
  if (!d.ran[key]) return [];
  const out: Issue[] = [];
  const s = d.sessions[key];
  const res = r.sessions[key];
  const label = SECTION_LABELS[key];

  if (res.cash.needsReason && res.cash.difference !== null) {
    out.push({
      level: 'block', code: 'cash-unexplained', section: key,
      title: `${label} cash ${formatPounds(Math.abs(res.cash.difference))} ${res.cash.status}`,
      detail: 'Add a reason to submit.',
    });
  } else if (res.cash.difference !== null && res.cash.status !== 'balanced') {
    out.push({
      level: 'ok', code: 'cash-explained', section: key,
      title: `${label} cash ${formatPounds(Math.abs(res.cash.difference))} ${res.cash.status}`,
      detail: `Reason: ${s.cash.reason}${s.cash.note ? ` · "${s.cash.note}"` : ''}`,
    });
  }

  if (res.foodDrink.needsCheck) {
    out.push({
      level: 'warn', code: 'food-drink-mismatch', section: key,
      title: `${label} food and drink don't match net`,
      detail: `They add up to ${formatPounds(Math.abs(res.foodDrink.gap))} ${res.foodDrink.gap > 0 ? 'over' : 'under'} net sales.`,
    });
  }

  if (res.adjustments.gap > 0) {
    out.push({
      level: 'warn', code: 'adjustments-unlisted', section: key,
      title: `${formatPounds(res.adjustments.gap)} of discounts not itemised`,
      detail: `${label} · the till shows ${formatPounds(s.discounts ?? 0)}, lines add up to ${formatPounds(res.adjustments.listed)}.`,
    });
  } else if (res.adjustments.gap < 0) {
    out.push({
      level: 'warn', code: 'adjustments-over', section: key,
      title: `Discount lines are ${formatPounds(-res.adjustments.gap)} more than the till`,
      detail: `${label} · check the amounts.`,
    });
  }

  const discPct = percent(s.discounts ?? 0, s.gross ?? 0);
  if (discPct !== null && discPct > settings.discountWarnPct) {
    out.push({
      level: 'warn', code: 'discounts-high', section: key,
      title: `${label} discounts are ${discPct}% of gross`,
      detail: `Above the ${settings.discountWarnPct}% check. Fine if there was a reason.`,
    });
  }
  return out;
}

export interface ReviewOptions {
  /** Net for the same weekday last week, to catch typos like an extra zero. */
  lastWeekNet?: Pence | null;
}

export function reviewIssues(d: EodDraft, r: DayResult, settings: SiteSettings, opts: ReviewOptions = {}): Issue[] {
  const out: Issue[] = [];

  for (const key of REQUIRED_SECTIONS) {
    const st = sectionStatus(d, key);
    if (st !== 'done' && st !== 'skipped') {
      out.push({ level: 'block', code: 'section-incomplete', section: key, title: `${SECTION_LABELS[key]} isn't finished`, detail: 'Finish it, or switch it off if it didn\'t run.' });
    }
  }

  out.push(...sessionIssues(d, r, 'lunch', settings), ...sessionIssues(d, r, 'dinner', settings));

  for (const del of r.delivery) {
    if (del.traded && del.refundPending) {
      out.push({ level: 'warn', code: 'refund-pending', section: 'delivery', title: `${del.name} refund pending`, detail: 'You can still submit. Finance will follow it up.' });
    }
  }

  if (r.wageRag === 'red' || r.wageRag === 'amber') {
    out.push({
      level: 'warn', code: 'wages-high', section: 'wages',
      title: `Wages ${r.wagePct}% of net`,
      detail: r.wageRag === 'red' ? `Over the ${settings.wageRedPct}% red line.` : `Between ${settings.wageAmberPct}% and ${settings.wageRedPct}%.`,
    });
  }

  if (opts.lastWeekNet && r.totalNet > 0) {
    const swing = percent(Math.abs(r.totalNet - opts.lastWeekNet), opts.lastWeekNet);
    if (swing !== null && swing > settings.netSwingWarnPct) {
      out.push({ level: 'warn', code: 'net-swing', section: 'lunch', title: `Net is ${swing}% ${r.totalNet > opts.lastWeekNet ? 'up' : 'down'} on last week`, detail: 'Check for a typo, like an extra zero.' });
    }
  }
  return out;
}

export function canSubmit(d: EodDraft, issues: Issue[]): boolean {
  return d.confirmed && !issues.some((i) => i.level === 'block');
}
