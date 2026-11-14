import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PHASE_LABELS, PHASES, summariseRun, type Phase } from '@maginhawa/core';
import { isDone, isScheduled, runPath, useChecklists } from '../lib/checklists';
import { Nav, NextBar } from '../components/ui';
import { groupTasks } from '../components/checklist-split-helpers';
import { SplitFrame, SubmitLists, TaskRow } from '../components/ChecklistSplit';
import { useTwoColumns } from '../lib/wide';
import { TabBar } from '../components/TabBar';
import { can, useAuth } from '../lib/auth';
import { SiteLine } from '../components/SiteLine';
import { Icon } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

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
  // Needs fixing (design P5): every failed check not dealt with yet, first, wherever it is.
  const toFix = useMemo(() => tasks.flatMap((t) => (t.run ? summariseRun(t.template, t.run, businessDate).failures.filter((f) => !f.fixed).map((f) => ({ t, f })) : [])), [tasks, businessDate]);
  const pct = scheduled.length ? Math.round((done.length / scheduled.length) * 100) : 0;
  // The bar at the bottom: how many are left, then the next one, as on End of day.
  const left = tasks.filter((t) => !isDone(t) && t.status !== 'anytime').length;
  const nextSmall = `${left} to do${lateOrMissed ? ` · ${lateOrMissed} late or missed` : ''}`;
  const nextBig = next ? `${next.status === 'late' ? 'Do now' : 'Next'}: ${next.title}` : '';
  const nextLabel = next ? `${next.status === 'late' ? 'Do now' : 'Start'}: ${next.title}` : '';

  const hero = (
    // Design P5: what's done today and what's due next on the left, a ring with the share done on the right.
    <div className="hero lists-hero lists-ring" role="status">
      <div className="lists-ring-tx">
        <span className="hl">Done today</span>
        <div className="big"><b>{done.length}</b><i>&nbsp;of {scheduled.length}</i></div>
        <span className="hl">{next ? `Next due · ${next.title}${next.dueTime && !next.title.includes(next.dueTime) ? ` at ${next.dueTime}` : ''}` : 'Nothing else due'}</span>
        {(lateOrMissed > 0 || fixedToday > 0) && (
          <span className="hl">
            {lateOrMissed > 0 && <span className="h-bad" style={{ fontWeight: 600 }}>{lateOrMissed} late or missed</span>}
            {lateOrMissed > 0 && fixedToday > 0 && ' · '}
            {fixedToday > 0 && `${fixedToday} ${fixedToday === 1 ? 'problem' : 'problems'} fixed`}
          </span>
        )}
      </div>
      <div className="lists-ring-c" role="img" aria-label={`${done.length} of ${scheduled.length} done`}>
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="6" />
          <circle cx="36" cy="36" r="28" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} strokeOpacity={pct ? 1 : 0} transform="rotate(-90 36 36)" />
        </svg>
        <b aria-hidden="true">{pct}%</b>
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
            ? <NextBar name="Next checklist" small={nextSmall} big={nextBig} to={runPath(next.key)} label={nextLabel} />
            : <p className="note" style={{ margin: 0 }}>Nothing left today. Good work.</p>}
        </div>
      </SplitFrame>
    );
  }

  return (
    <main className="page tabs lists-page">
      {phase && <Nav back="/checklists" backLabel="All" title={title} />}
      <div className="body">
        <SiteLine right={user && can.editChecklists(user.role) ? <Link className="site-line-act" to="/checklists/edit">Edit lists</Link> : undefined} />
        <div className="top">
          <div className="titleblock mh-title"><h1>{title}</h1></div>
          {hero}
        </div>

        {toFix.length > 0 && (
          <section className="grp" aria-label="Needs fixing">
            <div className="cl-hd"><span>Needs fixing</span><span>{toFix.length} failed</span></div>
            {toFix.map(({ t, f }) => (
              <Link key={`${t.key}|${f.checkpoint.id}`} className="fixcard" to={runPath(t.key)}>
                <span className="fixcard-ic" aria-hidden="true"><Icon d={ICONS.thermo} /></span>
                <span className="tx"><span>{f.checkpoint.title} · {f.reason}</span><small>{t.title} · tap to say what you did</small></span>
                <span className="chip sm">Fix it</span>
              </Link>
            ))}
          </section>
        )}

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
      {next && !ready.length && <div className="nextbar-wrap"><NextBar name="Next checklist" small={nextSmall} big={nextBig} to={runPath(next.key)} label={nextLabel} /></div>}
      <TabBar />
    </main>
  );
}
