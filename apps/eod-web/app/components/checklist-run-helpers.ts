import { evaluate, type AnswerValue, type Checkpoint, type RunSummary } from '@maginhawa/core';

/**
 * What the footer says while a list can't be finished: the failure to deal with first, by name when
 * there's one, then how many are left. "Fix walk-in fridge, then 6 left".
 */
export function blockingLabel(s: Pick<RunSummary, 'requiredLeft' | 'failures'>): string {
  const open = s.failures.filter((f) => !f.fixed);
  if (!open.length) return `${s.requiredLeft} left to answer`;
  const t = open[0]!.checkpoint.title;
  const what = open.length === 1 ? `Fix ${t.charAt(0).toLowerCase()}${t.slice(1)}` : `Fix ${open.length} failed checks`;
  return s.requiredLeft ? `${what}, then ${s.requiredLeft} left` : `${what} first`;
}

/** The Things 3 circle for one check: still to do, done, or failed and not yet dealt with. */
export function rowState(e: { answered: boolean; passed: boolean | null }, fixed: boolean): 'todo' | 'done' | 'fail' {
  if (!e.answered) return 'todo';
  return e.passed === false && !fixed ? 'fail' : 'done';
}

/** The first check, in list order, that hasn't been answered yet: the one to point people at next. */
export function nextToDo(checks: Checkpoint[], answers: Record<string, AnswerValue | undefined>, today: string): string | null {
  return checks.find((c) => !evaluate(c, answers[c.id], today).answered)?.id ?? null;
}

/**
 * The four likeliest actions for a failed check, from the full list. Cold storage gets the fridge
 * actions, hot holding gets reheating; "More" in the panel shows the rest.
 */
export function fixChoices(c: Pick<Checkpoint, 'type' | 'min' | 'max'>, all: readonly string[]): string[] {
  const pick = (want: string[]) => want.filter((a) => all.includes(a));
  const hot = c.type === 'temp' && c.min !== undefined && c.max === undefined;
  const cold = c.type === 'temp' && !hot;
  const first = hot ? pick(['Reheated the food', 'Threw the food away', 'Called the manager'])
    : cold ? pick(['Moved food to another fridge', 'Door was left open, closed it', 'Turned the thermostat down', 'Threw the food away'])
    : pick(['Called the manager', 'Threw the food away']);
  return [...first, ...all.filter((a) => !first.includes(a))].slice(0, 4);
}

/**
 * For the finish card: how long the list took (first answer to last), how many failures were dealt
 * with, and when the earliest re-check is due. Times are ISO strings, as stored.
 */
export function finishStats(run: {
  answeredBy?: Record<string, { at: string }>;
  fixes: Record<string, { at: string; recheckInMinutes: number }>;
}): { minutes: number | null; fixed: number; recheckAt: Date | null } {
  const times = Object.values(run.answeredBy ?? {}).map((a) => Date.parse(a.at)).filter((t) => !Number.isNaN(t));
  const minutes = times.length ? Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 60_000)) : null;
  const fixes = Object.values(run.fixes);
  const rechecks = fixes.map((f) => Date.parse(f.at) + f.recheckInMinutes * 60_000).filter((t) => !Number.isNaN(t));
  return { minutes, fixed: fixes.length, recheckAt: rechecks.length ? new Date(Math.min(...rechecks)) : null };
}
