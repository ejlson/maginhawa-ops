import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { evaluate, summariseRun } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { runPath, useChecklists } from '../lib/checklists';
import { Foot, Icon, ICONS, Nav } from '../components/ui';
import { Answer } from '../components/Answer';

export default function ChecklistRun() {
  const navigate = useNavigate();
  const { key: raw = '' } = useParams();
  const key = decodeURIComponent(raw);
  const { user } = useAuth();
  const { templateFor, runFor, answer, finish, businessDate, tasks } = useChecklists();
  const template = templateFor(key);
  if (!template) return <Navigate to="/checklists" replace />;
  const run = runFor(key);
  const task = tasks.find((t) => t.key === key);
  const s = summariseRun(template, run ?? { answers: {}, fixes: {} }, businessDate);
  const done = Boolean(run?.completedAt);

  const sections = [...new Set(template.checkpoints.map((c) => c.section ?? ''))];
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
        {done && <div className="banner"><Icon d={ICONS.check} size={16} /><span>Finished at {new Date(run!.completedAt!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} by {run!.completedBy}. Answers can't be changed.</span></div>}

        {sections.map((sec) => (
          <section className="grp" key={sec || 'all'}>
            {sec && <div className="gh"><h2>{sec}</h2></div>}
            <div className="sub">
              {template.checkpoints.filter((c) => (c.section ?? '') === sec).map((c) => {
                const v = run?.answers[c.id];
                const e = evaluate(c, v, businessDate);
                const fixed = run?.fixes[c.id];
                return (
                  <div key={c.id} className="qrow">
                    <Answer c={c} value={v} set={(x) => answer(key, c.id, x)} today={businessDate} disabled={done} />
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
          <button type="button" className="btn b1" disabled={!s.canFinish} onClick={() => { finish(key, user?.name ?? 'Manager'); navigate('/checklists'); }}>
            {s.unfixed ? `Fix ${s.unfixed} failed ${s.unfixed === 1 ? 'check' : 'checks'} first` : s.requiredLeft ? `${s.requiredLeft} left to answer` : 'Finish'}
          </button>
        </Foot>
      )}
    </main>
  );
}
