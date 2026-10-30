import { useEffect, useState } from 'react';
import { dayCloseAt, eodDueText, isEditable, SECTION_KEYS, SECTION_LABELS, sectionStatus } from '@maginhawa/core';
import { useDraft } from '../../lib/draft';
import { now } from '../../lib/clock';
import { isDone, isScheduled, isUrgent, useChecklists } from '../../lib/checklists';

export function greeting(d: Date) {
  const h = d.getHours();
  return h < 12 && h >= 4 ? 'Good morning' : h < 18 && h >= 12 ? 'Good afternoon' : 'Good evening';
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Re-render every minute so times and countdowns stay current. */
export function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
}

/** Daytime ends at 15:00: after that the end-of-day report becomes the focus. */
export const isDaytime = (d: Date) => d.getHours() >= 4 && d.getHours() < 15;

/** Today's checklists, worked out once for every home screen. */
export function useToday() {
  const { tasks } = useChecklists();
  useMinuteTick();
  const at = now();
  const scheduled = tasks.filter(isScheduled);
  const done = tasks.filter(isDone);
  const urgent = tasks.filter((t) => isUrgent(t.status));
  const next = urgent[0] ?? tasks.find((t) => t.status === 'upcoming');
  return { at, tasks, scheduled, done, checksDone: scheduled.filter(isDone).length, urgent, next };
}

/** The end-of-day report's state, for the EOD card, rows and buttons. */
export function useEod() {
  const { draft, result, issues, progress, status, settings } = useDraft();
  const sections = SECTION_KEYS.map((key) => ({ key, status: sectionStatus(draft, key) })).filter((s) => s.status !== 'skipped');
  const submitted = !isEditable(status);
  const nextSection = sections.find((s) => s.status === 'started') ?? sections.find((s) => s.status === 'todo');
  const firstDone = sections.find((s) => s.status === 'done');
  return {
    result,
    submitted,
    statuses: sections.map((s) => s.status),
    to: submitted ? '/close/done' : '/close',
    label: submitted ? 'See today\'s EOD' : progress.done === 0 ? 'Start today\'s EOD' : 'Continue today\'s EOD',
    issues: submitted ? [] : issues.filter((i) => i.level !== 'ok' && i.code !== 'section-incomplete').slice(0, 3),
    next: submitted
      ? { to: '/close/done', text: 'See report' }
      : !nextSection
        ? { to: '/close/review', text: 'Review and send' }
        : { to: `/close/${nextSection.key}`, text: `${nextSection.status === 'started' ? 'Continue' : 'Start'} ${SECTION_LABELS[nextSection.key].toLowerCase()}` },
    soFar: submitted || progress.left === 0
      ? `All ${progress.active} sections done`
      : progress.done === 0 ? `${progress.active} sections to go`
      : progress.done === 1 && firstDone ? `${SECTION_LABELS[firstDone.key]} done · ${progress.left} to go`
      : `${progress.done} done · ${progress.left} to go`,
    rowSub: submitted ? 'Sent to head office' : progress.done === 0 ? `${progress.active} sections · start any time` : `${progress.done} of ${progress.active} sections done`,
    due: () => submitted
      ? { cls: 'h-ok', text: 'Sent to head office' }
      : progress.left === 0 ? { cls: 'h-ok', text: 'Ready to send' }
      : (() => { const d = eodDueText(dayCloseAt(draft.businessDate, settings.dayCloseTime, settings.timezone), now()); return { cls: d.tone === 'bad' ? 'h-bad' : d.tone === 'warn' ? 'h-warn' : '', text: d.text }; })(),
  };
}
