import { Link, useSearchParams } from 'react-router';
import { PHASE_LABELS, PHASES, type Phase } from '@maginhawa/core';
import { formatDay } from '../lib/draft';
import { isUrgent, runPath, statusPill, useChecklists, type TaskView } from '../lib/checklists';
import { checklistIcon, Foot, Nav, RowLink, StatusIcon } from '../components/ui';
import { TabBar } from '../components/TabBar';
import { can, useAuth } from '../lib/auth';

function TaskRow({ t }: { t: TaskView }) {
  const pill = statusPill(t);
  const pie = t.status === 'done' ? 'done' : t.status === 'failed' ? 'fail' : t.done > 0 ? 'started' : 'todo';
  const sub = t.status === 'done' || t.status === 'failed'
    ? `${t.run?.completedAt ? new Date(t.run.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''} · ${t.run?.completedBy ?? ''}${t.status === 'failed' ? ' · problem fixed' : ''}`
    : `${t.total} ${t.total === 1 ? 'check' : 'checks'} · ${t.template.who}`;
  return <RowLink to={runPath(t.key)} lead={<StatusIcon d={checklistIcon(t.template.id, t.template.phase)} status={pie} />} title={t.title} sub={sub} right={<span className={`pill ${pill.cls}`}>{pill.text}</span>} />;
}

export default function Checklists() {
  const { tasks: all, businessDate } = useChecklists();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const phase = (PHASES as readonly string[]).includes(params.get('phase') ?? '') ? (params.get('phase') as Phase) : null;
  const tasks = phase ? all.filter((t) => t.template.phase === phase) : all;
  const title = phase ? `${PHASE_LABELS[phase]} checklists` : 'Checklists';
  const now = tasks.filter((t) => isUrgent(t.status));
  const missed = tasks.filter((t) => t.status === 'missed');
  const later = tasks.filter((t) => t.status === 'upcoming');
  const anytime = tasks.filter((t) => t.status === 'anytime');
  const done = tasks.filter((t) => t.status === 'done' || t.status === 'failed');
  const scheduled = tasks.filter((t) => t.status !== 'anytime');
  const next = now[0] ?? later[0];

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
          <section className="grp side">
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
