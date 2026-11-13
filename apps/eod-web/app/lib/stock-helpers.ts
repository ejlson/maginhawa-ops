import { addDays, dueOn, nextDue, type StockCount, type StockPlan } from '@maginhawa/core';

/** "Thu 12 Nov", or "Today" / "Yesterday". */
export function dayText(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "about 5 minutes": roughly 20 seconds an item. */
export function minutesText(items: number): string {
  const m = Math.max(1, Math.round((items * 20) / 60));
  return `about ${m} minute${m === 1 ? '' : 's'}`;
}

export const names = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '');

export type PlanState =
  | { kind: 'open'; count: StockCount }
  | { kind: 'done'; count: StockCount }
  | { kind: 'due' }
  | { kind: 'later'; next: string | null };

/** Where a regular count stands today. */
export function planState(plan: StockPlan, counts: StockCount[], today: string): PlanState {
  const open = counts.find((c) => c.planId === plan.id && !c.sentAt);
  if (open) return { kind: 'open', count: open };
  const done = counts.find((c) => c.planId === plan.id && c.sentAt && c.businessDate === today);
  if (done) return { kind: 'done', count: done };
  if (dueOn(plan.schedule, today)) return { kind: 'due' };
  return { kind: 'later', next: nextDue(plan.schedule, addDays(today, 1)) };
}

/** The most recent day on or before `today` that a count was due. */
export function lastDueDay(plan: StockPlan, today: string): string | null {
  for (let i = 0; i <= 366; i++) {
    const d = addDays(today, -i);
    if (dueOn(plan.schedule, d)) return d;
  }
  return null;
}
