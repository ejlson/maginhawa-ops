import { Navigate, useParams } from 'react-router';
import { clockTime, evaluate, findSite, summariseRun } from '@maginhawa/core';
import { formatDay } from '../lib/draft';
import { useSiteDay } from '../lib/site-timeline';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { Answer } from '../components/Answer';
import { Icon, ICONS, Nav } from '../components/ui';
import { taskStatusPill } from '../lib/day-status';

/** Head office · one site's checklist on one day, read-only: every answer, who gave it, fixes and corrections. */
export default function HeadOfficeChecklist() {
  const { site: code = '', date = '', key: raw = '' } = useParams();
  const key = decodeURIComponent(raw);
  const site = findSite(code);
  const day = useSiteDay(site?.code ?? '', date);
  const task = day.tasks.find((t) => t.key === key);
  if (!site || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return <Navigate to="/head-office" replace />;
  const dayLink = `/head-office/${code.toLowerCase()}?tab=day&date=${date}`;
  if (!task?.template) return <Navigate to={dayLink} replace />;

  const { template, run } = task;
  const s = summariseRun(template, run ?? { answers: {}, fixes: {} }, date);
  const pill = taskStatusPill(task.status);
  const sections = [...new Set(template.checkpoints.map((c) => c.section ?? ''))];

  return (
    <HeadOfficeShell>
    <main className="page wide">
      <Nav back={dayLink} backLabel={`${site.name} · ${formatDay(date, { weekday: 'short', day: 'numeric', month: 'short' })}`} title={task.title} />
      <div className="body form" style={{ paddingTop: 16, maxWidth: 720 }}>
        <div className="hero">
          <span className="hl">{site.name} · {formatDay(date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <div className="big"><b>{s.answered}</b><i>&nbsp;of {s.total} answered</i></div>
          <div className="hm">
            <span>{task.dueTime ?? 'Any time'}<small>Due</small></span>
            <span className={s.failures.length ? 'h-bad' : ''}>{s.failures.length}<small>Failed</small></span>
            <span>{run?.completedAt ? clockTime(run.completedAt) : '—'}<small>{run?.completedBy ? `Done by ${run.completedBy}` : 'Not done'}</small></span>
          </div>
        </div>
        <div className="banner"><Icon d={task.status === 'missed' ? ICONS.bang : ICONS.lock} size={16} />
          <span><span className={`pill ${pill.cls}`} style={{ height: 22, fontSize: 12.5, marginRight: 8 }}>{pill.text}</span>
            {run?.completedAt ? 'Read-only. Corrections are made by the site and keep the old answer.' : task.status === 'missed' ? 'Nobody did this checklist in time.' : 'Not finished yet. Answers show here as they come in.'}</span>
        </div>

        {sections.map((sec) => (
          <section className="grp" key={sec || 'all'}>
            {sec && <div className="gh"><h2>{sec}</h2></div>}
            <div className="sub">
              {template.checkpoints.filter((c) => (c.section ?? '') === sec).map((c) => {
                const v = run?.answers[c.id];
                const e = evaluate(c, v, date);
                const fixed = run?.fixes[c.id];
                const by = run?.answeredBy?.[c.id];
                return (
                  <div key={c.id} className="qrow">
                    <Answer c={c} value={v} set={() => {}} today={date} disabled />
                    {by && <small className="ans-by">{by.by} · {clockTime(by.at)}</small>}
                    {run?.corrections?.[c.id]?.map((x, i) => (
                      <small key={i} className="ans-by">Corrected from {String(x.previous).replace('-', '−')}{c.type === 'temp' ? '°C' : ''} by {x.by} · {clockTime(x.at)} · “{x.reason}”</small>
                    ))}
                    {e.passed === false && (
                      fixed
                        ? <div className="banner" style={{ marginBottom: 8 }}><Icon d={ICONS.check} size={16} /><span>{e.reason}. Dealt with: {fixed.actions.join(', ').toLowerCase()}{fixed.note ? ` (“${fixed.note}”)` : ''}. Re-check in {fixed.recheckInMinutes} min{fixed.foodDisposed ? ' · food thrown away' : ''}{fixed.reportFault ? ' · fault reported' : ''}.</span></div>
                        : <div className="banner" style={{ marginBottom: 8, background: 'var(--badbg)' }}><Icon d={ICONS.bang} size={16} /><span>{e.reason}. No fix recorded.</span></div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
    </HeadOfficeShell>
  );
}
