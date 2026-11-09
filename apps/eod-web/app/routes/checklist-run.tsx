import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { clockTime, evaluate, summariseRun } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { runPath, useChecklists } from '../lib/checklists';
import { timeHM } from '../lib/draft';
import { Foot, Icon, Nav, Pie } from '../components/ui';
import { blockingLabel, rowState } from '../components/checklist-run-helpers';
import { ICONS } from '../components/ui-helpers';
import { Answer } from '../components/Answer';
import { PresenceLine } from '../components/Sync';
import { nextAfter } from '../components/checklist-split-helpers';
import { SplitFrame } from '../components/ChecklistSplit';
import { TempSheet } from '../components/TempSheet';
import { useTouch, useTwoColumns } from '../lib/wide';

export default function ChecklistRun() {
  const { key: raw = '' } = useParams();
  const key = decodeURIComponent(raw);
  const { user } = useAuth();
  const { templateFor, runFor, answer, businessDate, tasks, sync, setWhere, dismissRefused } = useChecklists();
  const two = useTwoColumns();
  const touch = useTouch();
  // The big temperature entry, open for one check at a time.
  const [big, setBig] = useState<string | null>(null);
  const template = templateFor(key);
  const title = template?.title ?? null;
  // Other devices see "Jo is in Closing checks".
  useEffect(() => { setWhere(title); return () => setWhere(null); }, [title, setWhere]);
  if (!template) return <Navigate to="/checklists" replace />;
  const run = runFor(key);
  const task = tasks.find((t) => t.key === key);
  const s = summariseRun(template, run ?? { answers: {}, fixes: {} }, businessDate);
  const done = Boolean(run?.completedAt);
  const canCorrect = done && Boolean(user && can.correctRecords(user.role));

  const sections = [...new Set(template.checkpoints.map((c) => c.section ?? ''))];
  const here = sync.others.filter((p) => p.where === template.title);
  const refused = sync.refused.filter((r) => r.runKey === key);
  // Answers save as you go. Lists are locked together by the Submit under the checklists.
  const after = nextAfter(tasks, key);
  const bigCheck = big ? template.checkpoints.find((c) => c.id === big) : undefined;
  const nextTemp = (id: string) => {
    const at = template.checkpoints.findIndex((c) => c.id === id);
    return template.checkpoints.slice(at + 1).find((c) => c.type === 'temp' && (run?.answers[c.id] === undefined || run?.answers[c.id] === null));
  };
  const content = (
    <>
      <Nav back="/checklists" backLabel="Checklists" title={task?.recheckOf ? 'Re-check' : template.title} right={<span className="saved"><span className="dot" />Saved</span>} />
      <div className="body form run">
        {/* Calm list: a small summary card, so the checks themselves get the screen. */}
        <div className="hero run-hero" role="status" aria-live="polite">
          <div className="hero-row">
            <span className="hl">{task?.title ?? template.title}{template.who ? ` · ${template.who}` : ''}</span>
            <span className="hl">{done ? 'Was due' : 'Due'} {task?.dueTime ?? (task?.dueAt ? timeHM(task.dueAt) : 'any time')}</span>
          </div>
          <div className="big"><b>{s.answered}</b><i>&nbsp;of {s.total} done</i></div>
          <div className="qbars" aria-hidden="true">
            {template.checkpoints.map((c) => <i key={c.id} className={rowState(evaluate(c, run?.answers[c.id], businessDate), Boolean(run?.fixes[c.id]))} />)}
          </div>
          {s.unfixed > 0 && <span className="hl h-bad">{s.unfixed} {s.unfixed === 1 ? 'needs' : 'need'} action</span>}
        </div>
        {here.length > 0 && <PresenceLine others={here} />}
        {refused.length > 0 && (
          <div className="sync-card" role="alert">
            <span className="av warn"><Icon d={ICONS.people} size={16} /></span>
            <span className="tx">{refused.map((r) => (
              <span key={r.checkpointId ?? 'list'}>{r.checkpointId && <b>{template.checkpoints.find((c) => c.id === r.checkpointId)?.title ?? 'An item'}. </b>}{r.message}</span>
            ))}</span>
            <button type="button" className="sync-x" aria-label="Dismiss" onClick={() => dismissRefused(key)}><Icon d={ICONS.x} size={14} /></button>
          </div>
        )}
        {done && <div className="banner"><Icon d={ICONS.lock} size={16} /><span>Submitted at {timeHM(new Date(run!.completedAt!))} by {run!.completedBy}. Locked: {canCorrect ? 'a correction keeps the old answer and needs a reason.' : "answers can't be changed."}</span></div>}

        {sections.map((sec) => (
          <section className="grp" key={sec || 'all'}>
            {sec && <div className="gh"><h2>{sec}</h2></div>}
            <div className="sub">
              {template.checkpoints.filter((c) => (c.section ?? '') === sec).map((c) => {
                const v = run?.answers[c.id];
                const e = evaluate(c, v, businessDate);
                const fixed = run?.fixes[c.id];
                const by = run?.answeredBy?.[c.id];
                const state = rowState(e, Boolean(fixed));
                return (
                  <div key={c.id} className={`qrow circ ${state}${state === 'done' && e.passed !== false ? ' dim' : ''}`}>
                    <span className="qmark"><Pie status={state} size={26} /></span>
                    <div className="qbody">
                    <Answer c={c} value={v} set={(x) => answer(key, c.id, x)} today={businessDate} disabled={done} quiet
                      onBig={touch && !done && c.type === 'temp' ? () => setBig(c.id) : undefined} />
                    {/* Who answered and when, on every answered row, so a shared list stays attributable. */}
                    {by && e.answered && <small className="ans-by">{by.by === user?.name ? 'You' : by.by} · {clockTime(by.at)}</small>}
                    {run?.corrections?.[c.id]?.map((x, i) => (
                      <small key={i} className="ans-by">Corrected from {String(x.previous).replace('-', '−')}{c.type === 'temp' ? '°C' : ''} by {x.by} · {clockTime(x.at)} · “{x.reason}”</small>
                    ))}
                    {canCorrect && v !== undefined && v !== null && <Link className="how" to={`${runPath(key)}/correct/${c.id}`} aria-label={`Correct ${c.title}`}>Correct</Link>}
                    {e.passed === false && (
                      fixed ? (
                        <div className="banner qnote"><Icon d={ICONS.check} size={16} /><span>Dealt with: {fixed.actions.join(', ').toLowerCase()}. Re-check in {fixed.recheckInMinutes} min{fixed.reportFault ? ' · fault reported' : ''}.</span></div>
                      ) : (
                        <div className="qfail">
                          <span className="tx"><span>{e.reason}</span><small>Say what you did about it before it's submitted.</small></span>
                          {!done && <Link className="qfix" to={`${runPath(key)}/fix/${c.id}`}>Fix this</Link>}
                        </div>
                      )
                    )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {!done && (
        <Foot>
          {s.canFinish
            ? <Link className="btn b1" to={after ? runPath(after.key) : '/checklists'}>{after ? `Next: ${after.title}` : 'Back to checklists'}</Link>
            : <button type="button" className="btn b1" disabled>{blockingLabel(s)}</button>}
          <p className="note">{s.canFinish ? 'Saved. Submit it with the others under the checklists.' : 'Answers save as you go.'}</p>
        </Foot>
      )}
      {bigCheck && (
        <TempSheet c={bigCheck} value={run?.answers[bigCheck.id]} today={businessDate}
          onSave={(n) => answer(key, bigCheck.id, n)} onClose={() => setBig(null)}
          next={nextTemp(bigCheck.id) ? { title: nextTemp(bigCheck.id)!.title, open: () => setBig(nextTemp(bigCheck.id)!.id) } : undefined} />
      )}
    </>
  );
  return two ? <SplitFrame selected={key}>{content}</SplitFrame> : <main className="page">{content}</main>;
}
