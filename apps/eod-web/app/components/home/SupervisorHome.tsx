/** Supervisors, during service: how the shift is going, what's late, who has done what, then the EOD. */
import { Link } from 'react-router';
import { formatPounds, whoDidWhat } from '@maginhawa/core';
import { initialsOf, useAuth } from '../../lib/auth';
import { formatDay, timeHM } from '../../lib/draft';
import { runPath, statusPill, useChecklists } from '../../lib/checklists';
import { useSite } from '../../lib/site';
import { Icon, ICONS, RowLink } from '../ui';
import { TabBar } from '../TabBar';
import { EodRow, TimelineRow, firstName, greeting, HomeHeader, isDone, useEod, useToday } from './shared';
import { FoodSafetyRow } from '../FoodSafetyRow';
import { Columns } from '../Columns';

export function SupervisorHome() {
  const { user } = useAuth();
  const { businessDate } = useChecklists();
  const { open, handover } = useSite();
  const { at, tasks, scheduled, done, checksDone, urgent } = useToday();
  const eod = useEod();

  const late = tasks.filter((t) => t.status === 'late' || t.status === 'missed');
  const rechecks = tasks.filter((t) => t.recheckOf && !isDone(t));
  // Late and due lists first, re-checks with their timers, then missed ones.
  const needs = [...urgent, ...rechecks.filter((t) => !urgent.includes(t)), ...tasks.filter((t) => t.status === 'missed')];
  const people = whoDidWhat(done.filter((t) => t.run?.completedAt).map((t) => ({ title: t.title, completedAt: t.run!.completedAt!, completedBy: t.run!.completedBy ?? 'Someone' })));
  const focus = urgent[0];

  return (
    <main className="page tabs">
      <HomeHeader />
      <Columns
        top={<>
          <div className="titleblock">
            <span className="eyebrow">{formatDay(businessDate)}</span>
            <h1>{greeting(at)}, {firstName(user?.name ?? '')}</h1>
          </div>
        </>}
        hero={<>
          <Link className="hero" to="/checklists" aria-label={`Today so far: ${checksDone} of ${scheduled.length} checklists done, ${late.length} late or missed`}>
            <div className="hero-row"><span className="hl">Today so far</span><span className="hs-small">{timeHM(at)}</span></div>
            <div className="big"><b>{checksDone}</b><i>&nbsp;of {scheduled.length} checklists done</i></div>
            <div className="segs" aria-hidden="true">
              {scheduled.map((t) => <span key={t.key} className={isDone(t) ? 'd' : ''} style={t.status === 'missed' || t.status === 'late' ? { background: 'var(--heroBad)' } : undefined} />)}
            </div>
            <div className="hm">
              <span className={late.length ? 'h-bad' : ''}>{late.length}<small>Late or missed</small></span>
              <span className={rechecks.length ? 'h-warn' : ''}>{rechecks.length}<small>Re-checks due</small></span>
              <span>{eod.submitted ? 'Sent' : formatPounds(eod.result.totalNet).replace(/\.00$/, '')}<small>EOD so far</small></span>
            </div>
          </Link>
        </>}
        main={<>

        {(needs.length > 0 || open.length > 0 || eod.issues.length > 0) && (
          <section className="grp">
            <div className="hd"><h2>Needs you</h2><span>{needs.length + (open.length ? 1 : 0) + eod.issues.length}</span></div>
            <div className="sub">
              {needs.map((t) => {
                const pill = statusPill(t, at);
                const sub = t.recheckOf ? 'Set after a failed check' : `${t.total} checks · ${t.template.who}`;
                return (
                  <RowLink key={t.key} to={runPath(t.key)}
                    lead={<span className={`av ${t.status === 'late' || t.status === 'missed' ? 'bad' : 'warn'}`}><Icon d={t.recheckOf ? ICONS.thermo : ICONS.bang} size={t.recheckOf ? 19 : 15} /></span>}
                    title={t.title} sub={sub} right={<span className={`pill ${pill.cls}`}>{t.status === 'upcoming' && t.dueAt ? `In ${Math.max(1, Math.round((t.dueAt.getTime() - at.getTime()) / 60_000))} min` : pill.text}</span>} />
                );
              })}
              {open.length > 0 && (
                <RowLink to="/repairs" lead={<span className="av warn"><Icon d={ICONS.wrench} /></span>}
                  title={open.length === 1 ? open[0]!.title : `${open.length} repairs open`} sub={open.length === 1 ? `${open[0]!.place} · reported by ${open[0]!.reportedBy}` : open.map((r) => r.title).join(' · ')}
                  right={open.some((r) => r.urgent) ? <span className="pill p-bad">Urgent</span> : <span className="pill p-warn">Open</span>} />
              )}
              {eod.issues.map((i) => (
                <RowLink key={i.code + i.section} to={`/close/${i.section}`} lead={<span className={`av ${i.level === 'block' ? 'bad' : 'warn'}`}><Icon d={ICONS.bang} size={15} /></span>} title={i.title} sub={i.detail} />
              ))}
            </div>
          </section>
        )}
        </>}
        side={<>
        <section className="grp">
          <div className="hd"><h2>On shift</h2><span>Who did what</span></div>
          <div className="sub">
            {people.map((p) => (
              <div className="li" key={p.name}>
                <span className="av">{initialsOf(p.name)}</span>
                <span className="tx"><span>{p.name === user?.name ? 'You' : p.name}</span><small>{p.items.map((i) => `${i.title} ${timeHM(new Date(i.completedAt))}`).join(' · ')}</small></span>
                <span className="rt">{p.items.length} done</span>
              </div>
            ))}
            {!people.length && <p className="note" style={{ margin: 0 }}>Nobody has finished a checklist yet today.</p>}
          </div>
        </section>

        <section className="grp">
          <div className="hd"><h2>Tonight</h2></div>
          <div className="sub">
            <EodRow />
            <TimelineRow />
            <FoodSafetyRow />
            {handover.length > 0 && <RowLink to="/handover" lead={<span className="av"><Icon d={ICONS.chat} /></span>} title="Handover from last night" sub={handover.map((h) => h.body).join(' · ')} />}
          </div>
        </section>
        </>}
        actions={<>
        {focus
          ? <Link className="btn b1" to={runPath(focus.key)}>Do now: {focus.title}</Link>
          : <Link className="btn b1" to={eod.to}>{eod.label}</Link>}
        {!eod.submitted && <Link className="btn b2" to="/close/handover">Write the handover</Link>}
        </>}
      />
      <TabBar />
    </main>
  );
}
