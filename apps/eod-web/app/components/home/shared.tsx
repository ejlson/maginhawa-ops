/** Pieces the staff, supervisor and manager home screens share. */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { formatPounds, type Issue } from '@maginhawa/core';
import { timeHM, useDraft } from '../../lib/draft';
import { checksText, doneAt, isDone, phaseSummaries, runPath, statusPill, taskPie, type PhaseSummary, type TaskView } from '../../lib/checklists';
import { WhoMenu } from './WhoMenu';
import { SitePicker } from '../SitePicker';
import { BigMoney, Chevron, Icon, Pie, RowLink, Segments, StatusIcon } from '../ui';
import { ICONS, PHASE_ICONS } from '../ui-helpers';
import { useToday, useEod } from './shared-helpers';

export function HomeHeader({ right }: { right?: ReactNode }) {
  const { savedAt } = useDraft();
  return (
    <header className="nav homenav" style={{ paddingLeft: 20 }}>
      <SitePicker place="top" />
      {right ?? <>
        <span className="saved" data-tour="sync"><span className="dot" />{savedAt ? `Saved ${timeHM(savedAt)}` : 'On this device'}</span>
        <WhoMenu />
      </>}
    </header>
  );
}

export function NextChecklistHero({ focus, label = 'Next checklist' }: { focus: TaskView; label?: string }) {
  const { scheduled, checksDone, at } = useToday();
  const pill = statusPill(focus, at);
  return (
    <Link className="hero" data-tour="hero-check" to={runPath(focus.key)} aria-label={`${label}: ${focus.title}, ${pill.text}`}>
      <div className="hero-row">
        <span className="hl">{label}</span>
        <span className={`hs-small ${focus.status === 'missed' ? 'h-bad' : focus.status === 'late' || focus.status === 'due' ? 'h-warn' : ''}`} style={{ fontWeight: 600 }}>{pill.text}</span>
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
    <Link className="hero" data-tour="hero-check" to="/checklists">
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
    <Link className="hero" data-tour="hero-eod" to={eod.next.to} aria-label={`End of day report, ${formatPounds(eod.result.totalNet)} net. ${eod.soFar}. ${eod.next.text}`}>
      <div className="hero-row"><span className="hl">End of day report</span>{due.text && <span className={`hs-small ${due.cls}`} style={{ fontWeight: due.cls ? 600 : undefined }}>{due.text}</span>}</div>
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

/** The list finished most recently. */
const lastDone = (list: TaskView[]) => [...list].sort((a, b) => (b.run?.completedAt ?? '').localeCompare(a.run?.completedAt ?? ''))[0];

/** One checklist as a row: its circle, who it's for, and when it's due or who did it. */
export function TaskRow({ t, me }: { t: TaskView; me?: string }) {
  const { at } = useToday();
  const pill = statusPill(t, at);
  const by = t.run?.completedBy === me ? 'you' : t.run?.completedBy;
  const sub = isDone(t)
    ? `Done ${doneAt(t)} by ${by}${t.status === 'failed' ? ' · problem fixed' : ''}`
    : checksText(t);
  const right = isDone(t) ? undefined
    : t.status === 'upcoming' ? <span>{t.dueTime ?? pill.text}</span>
    : t.status === 'anytime' ? undefined
    : <span className={`pill ${pill.cls}`}>{pill.text}</span>;
  return <RowLink to={runPath(t.key)} lead={<Pie status={taskPie(t)} />} title={t.title} sub={sub} right={right} />;
}

/** "Hot holding ×3 · Bar opening", or "Opening checks · 09:30" for a single list. */
function phaseSub(p: PhaseSummary): string {
  if (p.scheduled.length > 0 && p.done === p.scheduled.length) {
    const last = lastDone(p.scheduled);
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
    const last = lastDone(scheduled);
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

/** What's stopping the EOD from going, one row each. */
export function EodIssueRows({ issues }: { issues: Issue[] }) {
  return issues.map((i) => (
    <RowLink key={i.code + i.section} to={`/close/${i.section}`} lead={<span className={`av ${i.level === 'block' ? 'bad' : 'warn'}`}><Icon d={ICONS.bang} size={15} /></span>} title={i.title} sub={i.detail} />
  ));
}

/** The EOD as one row, with the net so far. */
export function EodRow() {
  const eod = useEod();
  return (
    <RowLink to={eod.to} lead={<span className="av"><Icon d={ICONS.list} /></span>} title="Tonight's report"
      sub={eod.rowSub} right={eod.result.totalNet ? <span className="amt">{formatPounds(eod.result.totalNet)}</span> : undefined} />
  );
}

/** Opens the day hour by hour: what's been done, by whom, and what was missed. */
export function TimelineRow() {
  const { done, tasks } = useToday();
  return (
    <RowLink to="/day" lead={<span className="av"><Icon d={ICONS.clock} /></span>} title="Today's timeline"
      sub={`${done.length} of ${tasks.length} checklists done · hour by hour`} />
  );
}
