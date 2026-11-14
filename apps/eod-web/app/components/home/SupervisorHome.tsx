/** Supervisors, during service: how the shift is going, what's late, who has done what, then the EOD (P1 / D1 pattern). */
import { formatPounds, whoDidWhat } from '@maginhawa/core';
import { initialsOf, useAuth } from '../../lib/auth';
import { formatDay, timeHM, useDraft } from '../../lib/draft';
import { isDone, isOverdue, useChecklists } from '../../lib/checklists';
import { useTwoColumns } from '../../lib/wide';
import { TabBar } from '../TabBar';
import { HomeHeader } from './shared';
import { firstName, greeting, useEod, useToday } from './shared-helpers';
import { FirstWeek } from './FirstWeek';
import { eodStep, checklistStep, ChecklistCard, ChecklistsSection, EndOfDaySection, FoodSafetySection, RepairsSection, service, type UpNextStep } from './today';

function OnShift() {
  const { user } = useAuth();
  const { done } = useToday();
  const people = whoDidWhat(done.filter((t) => t.run?.completedAt).map((t) => ({ title: t.title, completedAt: t.run!.completedAt!, completedBy: t.run!.completedBy ?? 'Someone' })));
  return (
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
  );
}

export function SupervisorHome() {
  const { user } = useAuth();
  const { businessDate } = useChecklists();
  const { savedAt, settings } = useDraft();
  const { at, tasks, urgent, scheduled, checksDone } = useToday();
  const eod = useEod();
  const wide = useTwoColumns();

  const late = tasks.filter(isOverdue);
  const rechecks = tasks.filter((t) => t.recheckOf && !isDone(t));
  const step: UpNextStep = urgent[0] ? checklistStep(urgent[0]) : eodStep(eod);
  const stats = (
    <div className="hm" role="group" aria-label={`Checklists to do today: ${checksDone} of ${scheduled.length} checklists done, ${late.length} late or missed`}>
      <span className={late.length ? 'h-bad' : ''}>{late.length}<small>Late or missed</small></span>
      <span className={rechecks.length ? 'h-warn' : ''}>{rechecks.length}<small>Re-checks due</small></span>
      <span>{eod.submitted ? 'Sent' : formatPounds(eod.result.totalNet).replace(/\.00$/, '')}<small>EOD so far</small></span>
    </div>
  );
  const card = <ChecklistCard label="Checklists to do today" tour="hero-today" next={step} stats={stats} />;
  const title = (
    <div className="titleblock mh-title">
      <span className="eyebrow">{formatDay(businessDate)}{wide ? '' : service(at, settings.timezone)}</span>
      <h1>{greeting(at)}, {firstName(user?.name ?? '')}</h1>
    </div>
  );

  if (wide) {
    return (
      <main className="page tabs mh-page wide">
        <div className="body mh-desk">
          <div className="mh-head">{title}<span className="saved" data-tour="sync"><span className="dot" />{savedAt ? `All saved · ${timeHM(savedAt)}` : 'Saved on this device'}</span></div>
          <div className="mh-top">{card}<ChecklistsSection /></div>
          <div className="mh-pair"><RepairsSection at={at} /><div className="mh-stack"><EndOfDaySection write /><FoodSafetySection /></div></div>
          <OnShift />
          <FirstWeek />
        </div>
      </main>
    );
  }
  return (
    <main className="page tabs mh-page">
      <HomeHeader />
      <div className="body mh-phone">
        {title}
        {card}
        <ChecklistsSection />
        <RepairsSection at={at} />
        <EndOfDaySection write />
        <FoodSafetySection />
        <OnShift />
        <FirstWeek />
      </div>
      <TabBar />
    </main>
  );
}
