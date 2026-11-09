import { Link, useSearchParams } from 'react-router';
import { PHASE_LABELS, PHASES, type Phase } from '@maginhawa/core';
import { formatDay } from '../lib/draft';
import { isDone, isScheduled, runPath, useChecklists } from '../lib/checklists';
import { Foot, Nav } from '../components/ui';
import { groupTasks } from '../components/checklist-split-helpers';
import { SplitFrame, SubmitLists, TaskRow } from '../components/ChecklistSplit';
import { useTwoColumns } from '../lib/wide';
import { TabBar } from '../components/TabBar';
import { can, useAuth } from '../lib/auth';

export default function Checklists() {
  const { tasks: all, businessDate } = useChecklists();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const phase = (PHASES as readonly string[]).includes(params.get('phase') ?? '') ? (params.get('phase') as Phase) : null;
  const tasks = phase ? all.filter((t) => t.template.phase === phase) : all;
  const title = phase ? `${PHASE_LABELS[phase]} checklists` : 'Checklists';
  const { now, missed, later, anytime, ready, done, next } = groupTasks(tasks);
  const scheduled = tasks.filter(isScheduled);
  const two = useTwoColumns();
  const lateOrMissed = now.filter((t) => t.status === 'late').length + missed.length;
  const fixedToday = done.filter((t) => t.status === 'failed').length;

  const hero = (
    // Compact, like the card on a list: what's done, one bar per list, and only what needs attention.
    <div className="hero lists-hero" role="status">
      <div className="hero-row">
        <span className="hl">Done today</span>
        <span className="hl">{next ? `Next due ${next.dueTime ?? 'now'}` : 'Nothing else due'}</span>
      </div>
      <div className="big"><b>{done.length}</b><i>&nbsp;of {scheduled.length}</i></div>
      <div className="qbars" aria-hidden="true">
        {scheduled.map((t) => <i key={t.key} className={isDone(t) ? 'done' : t.status === 'missed' || t.status === 'late' ? 'fail' : ''} />)}
      </div>
      {(lateOrMissed > 0 || fixedToday > 0) && (
        <span className="hl">
          {lateOrMissed > 0 && <span className="h-bad" style={{ fontWeight: 600 }}>{lateOrMissed} late or missed</span>}
          {lateOrMissed > 0 && fixedToday > 0 && ' · '}
          {fixedToday > 0 && `${fixedToday} ${fixedToday === 1 ? 'problem' : 'problems'} fixed`}
        </span>
      )}
    </div>
  );

  // Wide screens: the lists on the left, today's summary and the next list on the right until one is opened.
  if (two) {
    return (
      <SplitFrame selected={null}>
        <Nav right={<span className="saved">Pick a list, or press <span className="kbd">J</span></span>} />
        <div className="body split-body">
          {hero}
          {next
            ? <Link className="btn b1" to={runPath(next.key)}>{next.status === 'late' ? 'Do now: ' : 'Start '}{next.title}</Link>
            : <p className="note" style={{ margin: 0 }}>Nothing left today. Good work.</p>}
          <p className="lead" style={{ margin: 0 }}>Do them any time of day. They're separate from the end-of-day report.</p>
        </div>
      </SplitFrame>
    );
  }

  return (
    <main className="page tabs lists-page">
      <Nav back={phase ? '/checklists' : undefined} backLabel="All" title={title}
        right={user && can.editChecklists(user.role) ? <Link className="back" to="/checklists/edit" style={{ padding: 0 }}>Edit lists</Link> : undefined} />
      <div className="body">
        <div className="top">
          <div className="titleblock">
            <span className="eyebrow">{formatDay(businessDate)}</span>
            <h1>{title}</h1>
            <p className="lead">Do them any time of day. They're separate from the end-of-day report.</p>
          </div>
          {hero}
        </div>

        <section className="grp">
          <div className="hd"><h2>To do</h2><span>{now.length + missed.length + later.length} left</span></div>
          {now.length > 0 && <div className="sub"><div className="sl"><span>Now</span></div>{now.map((t) => <TaskRow key={t.key} t={t} />)}</div>}
          {missed.length > 0 && <div className="sub"><div className="sl"><span>Missed</span><span>Still worth doing</span></div>{missed.map((t) => <TaskRow key={t.key} t={t} />)}</div>}
          {later.length > 0 && <div className="sub"><div className="sl"><span>Later today</span></div>{later.map((t) => <TaskRow key={t.key} t={t} />)}</div>}
          {anytime.length > 0 && <div className="sub"><div className="sl"><span>When needed</span></div>{anytime.map((t) => <TaskRow key={t.key} t={t} />)}</div>}
          {!now.length && !missed.length && !later.length && <p className="note" style={{ margin: 0 }}>Nothing left today. Good work.</p>}
        </section>

        {ready.length > 0 && (
          <section className="grp">
            <div className="hd"><h2>Ready to submit</h2><span>{ready.length}</span></div>
            <div className="sub">{ready.map((t) => <TaskRow key={t.key} t={t} />)}</div>
          </section>
        )}

        {done.length > 0 && (
          <section className="grp">
            <div className="hd"><h2>Done</h2><span>{done.length}</span></div>
            <div className="sub">{done.map((t) => <TaskRow key={t.key} t={t} />)}</div>
          </section>
        )}

        <SubmitLists />
      </div>
      {next && !ready.length && (
        <Foot>
          <Link className="btn b1" to={runPath(next.key)}>{next.status === 'late' ? 'Do now: ' : 'Start '}{next.title}</Link>
        </Foot>
      )}
      <TabBar />
    </main>
  );
}
