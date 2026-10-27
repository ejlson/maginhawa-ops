/** Pieces the staff, supervisor and manager home screens share. */
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { dayCloseAt, eodDueText, formatPounds, SECTION_KEYS, SECTION_LABELS, sectionStatus } from '@maginhawa/core';
import { useAuth } from '../../lib/auth';
import { timeHM, useDraft } from '../../lib/draft';
import { now } from '../../lib/clock';
import { isUrgent, phaseSummaries, runPath, statusPill, useChecklists, type PhaseSummary, type TaskView } from '../../lib/checklists';
import { BigMoney, Chevron, Icon, ICONS, PHASE_ICONS, Pie, RowLink, Segments, StatusIcon } from '../ui';

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

export const isDone = (t: Pick<TaskView, 'status'>) => t.status === 'done' || t.status === 'failed';

/** Today's checklists, worked out once for every home screen. */
export function useToday() {
  const { tasks } = useChecklists();
  useMinuteTick();
  const at = now();
  const scheduled = tasks.filter((t) => t.status !== 'anytime');
  const done = tasks.filter(isDone);
  const urgent = tasks.filter((t) => isUrgent(t.status));
  const next = urgent[0] ?? tasks.find((t) => t.status === 'upcoming');
  return { at, tasks, scheduled, done, checksDone: scheduled.filter(isDone).length, urgent, next };
}

/** The end-of-day report's state, for the EOD card, rows and buttons. */
export function useEod() {
  const { draft, result, issues, progress, status, settings } = useDraft();
  const sections = SECTION_KEYS.map((key) => ({ key, status: sectionStatus(draft, key) })).filter((s) => s.status !== 'skipped');
  const submitted = status !== 'draft' && status !== 'sent-back';
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

export function HomeHeader({ right }: { right?: ReactNode }) {
  const { user } = useAuth();
  const { settings, savedAt } = useDraft();
  return (
    <header className="nav" style={{ paddingLeft: 20 }}>
      <span className="title">{settings.siteName}</span>
      {right ?? <>
        <span className="saved"><span className="dot" />{savedAt ? `Saved ${timeHM(savedAt)}` : 'On this device'}</span>
        <Link className="av ink" style={{ width: 32, height: 32, fontSize: 12, textDecoration: 'none' }} to="/account" aria-label={`Signed in as ${user?.name}. Account`}>{user?.initials}</Link>
      </>}
    </header>
  );
}

export function NextChecklistHero({ focus, label = 'Next checklist' }: { focus: TaskView; label?: string }) {
  const { scheduled, checksDone, at } = useToday();
  const pill = statusPill(focus, at);
  return (
    <Link className="hero" to={runPath(focus.key)} aria-label={`${label}: ${focus.title}, ${pill.text}`}>
      <div className="hero-row">
        <span className="hl">{label}</span>
        <span className={`hs-small ${focus.status === 'late' || focus.status === 'missed' ? 'h-bad' : focus.status === 'due' ? 'h-warn' : ''}`} style={{ fontWeight: 600 }}>{pill.text}</span>
      </div>
      <div className="titleblock" style={{ gap: 6 }}>
        <span className="hero-title">{focus.title}</span>
        <span className="hs-small">{focus.total} checks · {focus.template.who}</span>
      </div>
      <div className="titleblock" style={{ gap: 10 }}>
        <div className="segs" aria-hidden="true">{scheduled.map((t) => <span key={t.key} className={isDone(t) ? 'd' : ''} />)}</div>
        <span className="hs-small">{checksDone} of {scheduled.length} checklists done today</span>
      </div>
    </Link>
  );
}

export function AllDoneHero() {
  const { scheduled, checksDone } = useToday();
  return (
    <Link className="hero" to="/checklists">
      <div className="hero-row"><span className="hl">Checklists</span><span className="hs-small h-ok" style={{ fontWeight: 600 }}>All done</span></div>
      <span className="hero-title">Nothing left today</span>
      <div className="hero-row hero-foot">
        <span className="hs-small">{checksDone} of {scheduled.length} checklists done</span>
        <span className="hero-next">See checklists<Chevron /></span>
      </div>
    </Link>
  );
}

export function EodHero() {
  const eod = useEod();
  const due = eod.due();
  return (
    <Link className="hero" to={eod.next.to} aria-label={`Today's EOD, ${formatPounds(eod.result.totalNet)} net. ${eod.soFar}. ${eod.next.text}`}>
      <div className="hero-row"><span className="hl">Today's EOD</span>{due.text && <span className={`hs-small ${due.cls}`} style={{ fontWeight: due.cls ? 600 : undefined }}>{due.text}</span>}</div>
      <div className="titleblock">
        <BigMoney value={eod.result.totalNet} />
        <span className="hs-small">{eod.submitted ? 'Net for the day' : 'Net so far'}</span>
      </div>
      <Segments statuses={eod.statuses} />
      <div className="hero-row hero-foot">
        <span className="hs-small">{eod.soFar}</span>
        <span className="hero-next">{eod.next.text}<Chevron /></span>
      </div>
    </Link>
  );
}

const doneAt = (t: TaskView) => (t.run?.completedAt ? timeHM(new Date(t.run.completedAt)) : '');

/** One checklist as a row: its circle, who it's for, and when it's due or who did it. */
export function TaskRow({ t, me }: { t: TaskView; me?: string }) {
  const { at } = useToday();
  const pill = statusPill(t, at);
  const pie = t.status === 'done' ? 'done' : t.status === 'failed' ? 'fail' : t.done > 0 ? 'started' : 'todo';
  const by = t.run?.completedBy === me ? 'you' : t.run?.completedBy;
  const sub = isDone(t)
    ? `Done ${doneAt(t)} by ${by}${t.status === 'failed' ? ' · problem fixed' : ''}`
    : `${t.total} ${t.total === 1 ? 'check' : 'checks'} · ${t.template.who}`;
  const right = isDone(t) ? undefined
    : t.status === 'upcoming' ? <span>{t.dueTime ?? pill.text}</span>
    : <span className={`pill ${pill.cls}`}>{pill.text}</span>;
  return <RowLink to={runPath(t.key)} lead={<Pie status={pie} />} title={t.title} sub={sub} right={right} />;
}

/** "Hot holding ×3 · Bar opening", or "Opening checks · 09:30" for a single list. */
function phaseSub(p: PhaseSummary): string {
  if (p.scheduled.length > 0 && p.done === p.scheduled.length) {
    const last = [...p.scheduled].sort((a, b) => (b.run?.completedAt ?? '').localeCompare(a.run?.completedAt ?? ''))[0];
    return last?.run?.completedBy ? `Done · last at ${doneAt(last)} by ${last.run.completedBy}` : 'All done';
  }
  const counts = new Map<string, number>();
  for (const t of p.scheduled.length ? p.scheduled : p.tasks) counts.set(t.template.title, (counts.get(t.template.title) ?? 0) + 1);
  const names = [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(' · ');
  const single = p.tasks.length === 1 && p.tasks[0]!.dueTime ? ` · ${p.tasks[0]!.dueTime}` : '';
  return p.done > 0 ? `${p.done} of ${p.scheduled.length} done · ${names}` : names + single;
}

/**
 * Today's checklists by part of the day. Status shows only when something needs doing;
 * once every list is done they fold into one row.
 */
export function PhaseRows() {
  const { tasks, scheduled, checksDone, at } = useToday();
  if (scheduled.length > 0 && checksDone === scheduled.length) {
    const last = [...scheduled].sort((a, b) => (b.run?.completedAt ?? '').localeCompare(a.run?.completedAt ?? ''))[0];
    return (
      <RowLink to="/checklists" lead={<Pie status="done" />} title={`All ${scheduled.length} checklists done`}
        sub={last?.run?.completedBy ? `Last at ${doneAt(last)} by ${last.run.completedBy}` : undefined} />
    );
  }
  return (
    <>
      {phaseSummaries(tasks).map((p) => {
        const pill = p.status !== 'done' && p.lead && p.lead.status !== 'upcoming' ? statusPill(p.lead, at) : null;
        return (
          <RowLink key={p.phase} to={p.to} lead={<StatusIcon d={PHASE_ICONS[p.phase]} status={p.status} />}
            title={p.label} sub={phaseSub(p)} right={pill ? <span className={`pill ${pill.cls}`}>{pill.text}</span> : p.status !== 'done' ? p.lead?.dueTime : undefined} />
        );
      })}
    </>
  );
}

/** The EOD as one row, with the net so far. */
export function EodRow() {
  const eod = useEod();
  return (
    <RowLink to={eod.to} lead={<span className="av"><Icon d={ICONS.list} /></span>} title="End-of-day report"
      sub={eod.rowSub} right={eod.result.totalNet ? <span className="amt">{formatPounds(eod.result.totalNet)}</span> : undefined} />
  );
}
