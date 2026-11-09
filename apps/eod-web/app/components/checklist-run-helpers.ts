import type { RunSummary } from '@maginhawa/core';

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
