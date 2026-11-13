/**
 * Health and safety (HS1): the check due now on the main card, this month's checks, and accidents.
 * Managers see what an accident still needs: a check after a week, and the HSE report (RIDDOR).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { accidentState, callPointFor, doneThisPeriod, dueBy, SAFETY_CHECKS, type Accident, type SafetyCheckKind } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { useOps } from '../lib/ops';
import { useChecklists } from '../lib/checklists';
import { dayText } from '../lib/stock-helpers';
import { Icon, Nav, Pie, RowLink } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

const KINDS = Object.keys(SAFETY_CHECKS) as SafetyCheckKind[];

export default function Safety() {
  const { user } = useAuth();
  const ops = useOps();
  const { businessDate: today } = useChecklists();
  if (!user) return null;
  const site = user.siteCode;
  const status = KINDS.map((k) => ({ kind: k, ...SAFETY_CHECKS[k], done: doneThisPeriod(k, ops.data.safetyChecks, site, today), by: dueBy(k, today) }));
  const due = status.find((s) => !s.done) ?? null;
  const monthly = status.filter((s) => s.every === 'month');
  const accidents = ops.data.accidents.filter((a) => a.siteCode === site).sort((a, b) => b.at.localeCompare(a.at));
  const needs = accidents.filter((a) => ['check', 'report'].includes(accidentState(a, today).kind));
  const manager = can.manageAccidents(user.role);

  return (
    <main className="page">
      <Nav back="/more" backLabel="More" title="Health and safety" />
      <div className="body">
        <div className="titleblock"><h1>Health and safety</h1></div>
        <div className="hero stk-hero" role="status">
          {due ? (
            <>
              <span className="hl">Due by {dayText(due.by, today)} · {due.every === 'week' ? 'weekly' : 'monthly'}</span>
              <span className="stk-title">{due.title}</span>
              <span className="stk-sub">{due.kind === 'fire-alarm' ? `This week: call point ${callPointFor(ops.data.callPoints[site] ?? [], today)}` : due.sub}</span>
              <Link className="upnext" to={`/safety/check/${due.kind}`}><span className="tx"><b>{due.kind === 'fire-alarm' ? 'Start test' : 'Start check'}</b></span><span className="arrow"><Icon d={ICONS.arrow} size={16} /></span></Link>
            </>
          ) : (
            <>
              <span className="hl">Health and safety</span>
              <span className="stk-title">All checks done</span>
              <span className="stk-sub">Next: the weekly fire alarm test from Monday</span>
            </>
          )}
        </div>

        <section className="grp" aria-label="This month">
          <div className="hd"><h2>This month</h2><span>{monthly.filter((m) => m.done).length} of {monthly.length} done</span></div>
          <div className="sub">
            {monthly.map((m) => <RowLink key={m.kind} to={m.done ? undefined : `/safety/check/${m.kind}`} lead={<Pie status={m.done ? 'done' : 'todo'} />}
              title={m.title} sub={m.done ? `Done ${dayText(m.done.businessDate, today)} by ${m.done.by}` : m.sub}
              right={m.done ? undefined : <span className="stk-meta">By {dayText(m.by, today)}</span>} />)}
          </div>
        </section>

        {manager && needs.length > 0 && (
          <section className="grp" aria-label="Needs you">
            <div className="hd"><h2>Needs you</h2></div>
            <div className="sub">{needs.map((a) => <AccidentRow key={a.id} a={a} today={today} />)}</div>
          </section>
        )}

        <section className="grp" aria-label="Accidents">
          <div className="hd"><h2>Accidents</h2>{accidents.length > 0 && <span>{accidents.length} this year</span>}</div>
          <div className="sub">
            <RowLink to="/safety/accident" lead={<span className="av"><Icon d={ICONS.plus} /></span>} title="Report an accident" sub="Anyone, straight after" />
            {manager && accidents.slice(0, 3).map((a) => <RowLink key={a.id} lead={<span className="av"><Icon d={ICONS.list} /></span>} title={`${a.what} · ${a.injury.toLowerCase()}`} sub={`${a.name} · ${dayText(a.businessDate, today)}`} />)}
          </div>
        </section>
      </div>
    </main>
  );
}

function AccidentRow({ a, today }: { a: Accident; today: string }) {
  const ops = useOps();
  const st = accidentState(a, today);
  const [days, setDays] = useState('');
  const [ref, setRef] = useState('');
  return (
    <div className="li acc-row">
      <span className="tx">
        <span>{a.name}: {a.what.toLowerCase()}, {a.injury.toLowerCase()}</span>
        <small className={st.kind === 'report' ? 't-bad' : ''}>
          {st.kind === 'report' ? `Off more than 7 days: report to the HSE by ${dayText(st.by, today)}${st.late ? ' (late)' : ''}` : `How are they? Ask on ${dayText(st.kind === 'check' ? st.on : today, today)}`}
        </small>
      </span>
      <span className="rt acc-act">
        {st.kind === 'check' ? (
          <>
            <input className="in short" inputMode="numeric" aria-label={`Days off so far for ${a.name}`} placeholder="Days" value={days} onChange={(e) => setDays(e.target.value)} />
            <button type="button" className="chip" disabled={!/^\d+$/.test(days)} onClick={() => ops.updateAccident(a.id, { daysOff: Number(days) })}>Save</button>
          </>
        ) : (
          <>
            <input className="in" style={{ width: 120, textAlign: 'left' }} aria-label="HSE reference" placeholder="HSE reference" value={ref} onChange={(e) => setRef(e.target.value)} />
            <button type="button" className="chip" disabled={ref.trim().length < 3} onClick={() => ops.updateAccident(a.id, { hse: { at: new Date().toISOString(), ref: ref.trim() } })}>Reported</button>
          </>
        )}
      </span>
    </div>
  );
}
