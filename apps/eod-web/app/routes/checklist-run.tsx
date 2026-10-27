import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { clockTime, evaluate, summariseRun } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { runPath, useChecklists } from '../lib/checklists';
import { Foot, Icon, ICONS, Nav } from '../components/ui';
import { Answer } from '../components/Answer';
import { PresenceLine } from '../components/Sync';
import { nextAfter, SplitFrame } from '../components/ChecklistSplit';
import { TempSheet } from '../components/TempSheet';
import { useTouch, useTwoColumns } from '../lib/wide';

export default function ChecklistRun() {
  const { key: raw = '' } = useParams();
  const key = decodeURIComponent(raw);
  const { user } = useAuth();
  const { templateFor, runFor, answer, businessDate, tasks, sync, setWhere } = useChecklists();
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
      <div className="body form">
        <div className="hero" role="status" aria-live="polite">
          <span className="hl">{task?.title ?? template.title}</span>
          <div className="big"><b>{s.answered}</b><i>&nbsp;of {s.total} done</i></div>
          <div className="hm">
            <span>{task?.dueTime ?? (task?.dueAt ? task.dueAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Any time')}<small>{done ? 'Was due' : 'Due'}</small></span>
            <span className={s.failures.length ? 'h-bad' : ''}>{s.failures.length}<small>Failed</small></span>
            <span>{template.who}<small>Who does it</small></span>
          </div>
        </div>
        {here.length > 0 && <PresenceLine others={here} />}
        {done && <div className="banner"><Icon d={ICONS.lock} size={16} /><span>Submitted at {new Date(run!.completedAt!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} by {run!.completedBy}. Locked: {canCorrect ? 'a correction keeps the old answer and needs a reason.' : "answers can't be changed."}</span></div>}

        {sections.map((sec) => (
          <section className="grp" key={sec || 'all'}>
            {sec && <div className="gh"><h2>{sec}</h2></div>}
            <div className="sub">
              {template.checkpoints.filter((c) => (c.section ?? '') === sec).map((c) => {
                const v = run?.answers[c.id];
                const e = evaluate(c, v, businessDate);
                const fixed = run?.fixes[c.id];
                const by = run?.answeredBy?.[c.id];
                return (
                  <div key={c.id} className="qrow">
                    <Answer c={c} value={v} set={(x) => answer(key, c.id, x)} today={businessDate} disabled={done}
                      onBig={touch && !done && c.type === 'temp' ? () => setBig(c.id) : undefined} />
                    {by && by.by !== user?.name && <small className="ans-by">{by.by} · {clockTime(by.at)}</small>}
                    {run?.corrections?.[c.id]?.map((x, i) => (
                      <small key={i} className="ans-by">Corrected from {String(x.previous).replace('-', '−')}{c.type === 'temp' ? '°C' : ''} by {x.by} · {clockTime(x.at)} · “{x.reason}”</small>
                    ))}
                    {canCorrect && v !== undefined && v !== null && <Link className="how" to={`${runPath(key)}/correct/${c.id}`} aria-label={`Correct ${c.title}`}>Correct</Link>}
                    {e.passed === false && (
                      fixed ? (
                        <div className="banner" style={{ marginBottom: 8 }}><Icon d={ICONS.check} size={16} /><span>Dealt with: {fixed.actions.join(', ').toLowerCase()}. Re-check in {fixed.recheckInMinutes} min{fixed.reportFault ? ' · fault reported' : ''}.</span></div>
                      ) : (
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, borderRadius: 16, background: 'var(--badbg)', marginBottom: 8 }}>
                          <span className="tx"><span style={{ fontWeight: 600 }}>{e.reason}</span><small style={{ color: 'var(--text)', opacity: .75 }}>Say what you did about it before it's submitted.</small></span>
                          {!done && <Link className="chip" style={{ background: 'var(--bad)', color: '#fff', display: 'flex', alignItems: 'center', textDecoration: 'none' }} to={`${runPath(key)}/fix/${c.id}`}>Fix this</Link>}
                        </div>
                      )
                    )}
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
            : <button type="button" className="btn b1" disabled>{s.unfixed ? `Fix ${s.unfixed} failed ${s.unfixed === 1 ? 'check' : 'checks'} first` : `${s.requiredLeft} left to answer`}</button>}
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
