import { Link, useSearchParams } from 'react-router';
import { PHASE_LABELS, PHASES, type Phase } from '@maginhawa/core';
import { formatDay } from '../lib/draft';
import { runPath, useChecklists } from '../lib/checklists';
import { Foot, Nav } from '../components/ui';
import { groupTasks, SplitFrame, TaskRow } from '../components/ChecklistSplit';
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
  const { now, missed, later, anytime, done, next } = groupTasks(tasks);
  const scheduled = tasks.filter((t) => t.status !== 'anytime');
  const two = useTwoColumns();

  const hero = (
    <div className="hero" role="status">
      <span className="hl">Done today</span>
      <div className="big"><b>{done.length}</b><i>&nbsp;of {scheduled.length}</i></div>
      <div className="segs" aria-hidden="true">
        {scheduled.map((t) => <span key={t.key} className={t.status === 'done' || t.status === 'failed' ? 'd' : ''} style={t.status === 'missed' ? { background: 'var(--heroBad)' } : undefined} />)}
      </div>
      <div className="hm">
        <span className={now.some((t) => t.status === 'late') || missed.length ? 'h-bad' : ''}>{now.filter((t) => t.status === 'late').length + missed.length}<small>Late or missed</small></span>
        <span>{done.filter((t) => t.status === 'failed').length}<small>Problems fixed</small></span>
        <span>{next?.dueTime ?? (next ? 'Now' : '—')}<small>Next due</small></span>
      </div>
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
    <main className="page tabs">
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

        {done.length > 0 && (
          <section className="grp">
            <div className="hd"><h2>Done</h2><span>{done.length}</span></div>
            <div className="sub">{done.map((t) => <TaskRow key={t.key} t={t} />)}</div>
          </section>
        )}
      </div>
      {next && (
        <Foot>
          <Link className="btn b1" to={runPath(next.key)}>{next.status === 'late' ? 'Do now: ' : 'Start '}{next.title}</Link>
        </Foot>
      )}
      <TabBar />
    </main>
  );
}
