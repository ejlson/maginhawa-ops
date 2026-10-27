import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { clockTime, evaluate, summariseRun } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { runPath, useChecklists } from '../lib/checklists';
import { Foot, Icon, ICONS, Nav } from '../components/ui';
import { Answer } from '../components/Answer';
import { PresenceLine } from '../components/Sync';

export default function ChecklistRun() {
  const navigate = useNavigate();
  const { key: raw = '' } = useParams();
  const key = decodeURIComponent(raw);
  const { user } = useAuth();
  const { templateFor, runFor, answer, finish, businessDate, tasks, sync, setWhere } = useChecklists();
  const [finishing, setFinishing] = useState(false);
  const [beaten, setBeaten] = useState<string | null>(null);
  const template = templateFor(key);
  const title = template?.title ?? null;
  // Other devices see "Jo is in Closing checks".
  useEffect(() => { setWhere(title); return () => setWhere(null); }, [title, setWhere]);
  if (!template) return <Navigate to="/checklists" replace />;
  const run = runFor(key);
  const task = tasks.find((t) => t.key === key);
  const s = summariseRun(template, run ?? { answers: {}, fixes: {} }, businessDate);
  const done = Boolean(run?.completedAt);

  const sections = [...new Set(template.checkpoints.map((c) => c.section ?? ''))];
  const here = sync.others.filter((p) => p.where === template.title);
  const onFinish = async () => {
    setFinishing(true);
    const out = await finish(key, user?.name);
    setFinishing(false);
    // Someone else finished it first: nothing changed, so stay and say who.
    if (out.already) setBeaten(out.message);
    else navigate('/checklists');
  };
  return (
    <main className="page">
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
        {beaten && <div className="sync-card" role="alert"><span className="tx"><b>Already finished</b><small>{beaten}. Your Finish didn't change anything.</small></span></div>}
        {here.length > 0 && <PresenceLine others={here} />}
        {done && <div className="banner"><Icon d={ICONS.check} size={16} /><span>Finished at {new Date(run!.completedAt!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} by {run!.completedBy}. Answers can't be changed.</span></div>}

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
                    <Answer c={c} value={v} set={(x) => answer(key, c.id, x)} today={businessDate} disabled={done} />
                    {by && by.by !== user?.name && <small className="ans-by">{by.by} · {clockTime(by.at)}</small>}
                    {e.passed === false && (
                      fixed ? (
                        <div className="banner" style={{ marginBottom: 8 }}><Icon d={ICONS.check} size={16} /><span>Dealt with: {fixed.actions.join(', ').toLowerCase()}. Re-check in {fixed.recheckInMinutes} min{fixed.reportFault ? ' · fault reported' : ''}.</span></div>
                      ) : (
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, borderRadius: 16, background: 'var(--badbg)', marginBottom: 8 }}>
                          <span className="tx"><span style={{ fontWeight: 600 }}>{e.reason}</span><small style={{ color: 'var(--text)', opacity: .75 }}>Say what you did about it before you finish.</small></span>
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
          <button type="button" className="btn b1" disabled={!s.canFinish || finishing} onClick={onFinish}>
            {s.unfixed ? `Fix ${s.unfixed} failed ${s.unfixed === 1 ? 'check' : 'checks'} first` : s.requiredLeft ? `${s.requiredLeft} left to answer` : 'Finish'}
          </button>
        </Foot>
      )}
    </main>
  );
}
