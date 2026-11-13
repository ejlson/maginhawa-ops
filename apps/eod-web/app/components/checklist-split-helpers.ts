import { isDone, isUrgent, type TaskView } from '../lib/checklists';

/** Today's lists in the order people work through them. */
export function groupTasks(tasks: TaskView[]) {
  const open = tasks.filter((t) => !t.ready);
  const now = open.filter((t) => isUrgent(t.status));
  const missed = open.filter((t) => t.status === 'missed');
  const later = open.filter((t) => t.status === 'upcoming');
  const anytime = open.filter((t) => t.status === 'anytime');
  const ready = tasks.filter((t) => t.ready);
  const done = tasks.filter(isDone);
  return { now, missed, later, anytime, ready, done, next: now[0] ?? later[0], order: [...now, ...missed, ...later, ...anytime, ...ready, ...done] };
}

/** The next list still to do after this one, for "finish and open the next". */
export function nextAfter(tasks: TaskView[], key: string): TaskView | undefined {
  const g = groupTasks(tasks);
  const open = [...g.now, ...g.missed, ...g.later].filter((t) => t.key !== key);
  return open[0];
}
