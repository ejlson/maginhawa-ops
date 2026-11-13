/**
 * The pieces every site home shares (designs P1 phone, D1 desktop): the Up next pill inside the main card,
 * then Checklists (to do, when needed, done), Repairs, End of day and Food safety.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { formatPounds, reportedText, SECTION_LABELS } from '@maginhawa/core';
import { timeHM } from '../../lib/draft';
import { useAuth } from '../../lib/auth';
import { isDone, runPath, useChecklists, type TaskView } from '../../lib/checklists';
import { useSite } from '../../lib/site';
import { Icon, RowLink } from '../ui';
import { ICONS } from '../ui-helpers';
import { EodIssueRows, TaskRow } from './shared';
import { useEod, useToday } from './shared-helpers';
import { FoodSafetyRow } from '../FoodSafetyRow';
import { sectionHint } from '../../lib/service';
export { sectionHint, service } from '../../lib/service';

/** The one next step, shown as the light pill inside the main card (designs P1, D1). */
export interface UpNextStep { to: string; text: string; sub?: string; label: string }

export function UpNext({ step }: { step: UpNextStep }) {
  return (
    <Link className="upnext" to={step.to}>
      <span className="vh">{`${step.label}, `}</span>
      <span className="upnext-t"><small aria-hidden="true">Up next</small><b>{step.text}</b></span>
      <span className="upnext-go" aria-hidden="true"><Icon d={ICONS.arrow} size={16} /></span>
    </Link>
  );
}



/**
 * Checklists, in plain words: what's still to do (late first, then missed, then what's coming, each with
 * its time or status) and what's been done (when, and by whom).
 */
export function ChecklistsSection({ yesterday = false }: { yesterday?: boolean }) {
  const { user } = useAuth();
  const { tasks, scheduled, checksDone } = useToday();
  const { missedYesterday } = useChecklists();
  const rank: Record<string, number> = { late: 0, due: 1, missed: 2, upcoming: 3, anytime: 4 };
  const whenNeeded = tasks.filter((t) => t.status === 'anytime' && !isDone(t));
  const todo = tasks.filter((t) => !isDone(t) && t.status !== 'anytime').sort((a, b) => (rank[a.status] ?? 5) - (rank[b.status] ?? 5) || (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
  const done = tasks.filter(isDone).sort((a, b) => (a.run?.completedAt ?? '').localeCompare(b.run?.completedAt ?? ''));
  const late = tasks.filter((t) => t.status === 'late').length;
  const missed = tasks.filter((t) => t.status === 'missed').length;
  const meta = [`${checksDone} of ${scheduled.length} done`, late && `${late} late`, missed && `${missed} missed`].filter(Boolean).join(' · ');
  const showYesterday = yesterday && missedYesterday.length > 0;
  if (!tasks.length && !showYesterday) return null;
  return (
    <section className="grp mh-lists" data-tour="needs" aria-label="Checklists">
      <div className="hd"><h2>Checklists</h2><span>{meta}</span></div>
      {(todo.length > 0 || showYesterday) && (
        <div className="sub" data-tour="todo">
          <div className="sl"><span>To do</span><span>{todo.length}</span></div>
          {todo.map((t) => <TaskRow key={t.key} t={t} me={user?.name} />)}
          {showYesterday && (
            <RowLink to="/checklists" lead={<span className="av" aria-hidden="true">{missedYesterday.length}</span>}
              title={missedYesterday.length === 1 ? `${missedYesterday[0]!.title} was missed` : `${missedYesterday.length} checklists missed`}
              sub={missedYesterday.length === 1 ? 'Yesterday' : `Yesterday · ${missedYesterday.map((t) => t.title).join(', ')}`} />
          )}
        </div>
      )}
      {whenNeeded.length > 0 && (
        <div className="sub">
          <div className="sl"><span>When needed</span></div>
          {whenNeeded.map((t) => <TaskRow key={t.key} t={t} me={user?.name} />)}
        </div>
      )}
      {done.length > 0 && (
        <div className="sub">
          <div className="sl"><span>Done</span><span>{done.length}</span></div>
          {done.map((t) => <TaskRow key={t.key} t={t} me={user?.name} />)}
        </div>
      )}
    </section>
  );
}

/** Repairs: what's open (managers and supervisors) and a way to report one. */
export function RepairsSection({ at, list = true, report = false }: { at: Date; list?: boolean; report?: boolean }) {
  const { open } = useSite();
  const shown = list ? open : [];
  if (!shown.length && !report) return null;
  return (
    <section className="grp" aria-label="Repairs">
      <div className="hd"><h2>Repairs</h2>{shown.length > 0 && <span>{shown.length} open</span>}</div>
      <div className="sub">
        {shown.slice(0, 3).map((r) => (
          <RowLink key={r.id} to="/repairs" lead={<span className={`av ${r.urgent ? 'bad' : 'warn'}`}><Icon d={ICONS.wrench} /></span>}
            title={r.title} sub={`${r.place} · reported ${reportedText(r.reportedAt, at)}`} right={<span className={`pill ${r.urgent ? 'p-bad' : 'p-warn'}`}>{r.urgent ? 'Urgent' : 'Open'}</span>} />
        ))}
        {shown.length > 3 && <RowLink to="/repairs" lead={<span className="av"><Icon d={ICONS.wrench} /></span>} title={`${shown.length - 3} more repairs`} />}
        {report && <RowLink to="/report" lead={<span className="av"><Icon d={ICONS.plus} /></span>} title="Report a problem" sub="Something broken or not working" />}
      </div>
    </section>
  );
}

/** End of day: the report, anything stopping it going, and the handover. */
export function EndOfDaySection({ eodRow = true, issues = eodRow, write = false }: { eodRow?: boolean; issues?: boolean; write?: boolean }) {
  const eod = useEod();
  const { handover, handoverBy, handoverRead } = useSite();
  const showIssues = issues && eod.issues.length > 0;
  if (!eodRow && !showIssues && !handover.length) return null;
  return (
    <section className="grp" aria-label={eodRow ? 'End of day' : showIssues ? 'Before you send' : 'Handover'}>
      <div className="hd"><h2>{eodRow ? 'End of day' : showIssues ? 'Before you send' : 'Handover'}</h2></div>
      <div className="sub">
        {eodRow && <RowLink to={eod.to} lead={<span className="av"><Icon d={ICONS.list} /></span>} title="End-of-day report" sub={eod.rowSub}
          right={eod.result.totalNet ? <span className="amt">{formatPounds(eod.result.totalNet)}</span> : undefined} />}
        {issues && <EodIssueRows issues={eod.issues} />}
        {handover.length > 0 && (
          <RowLink to="/handover" lead={<span className={`av${handoverRead ? '' : ' link'}`}><Icon d={ICONS.chat} /></span>} title={`Handover from ${handoverBy ?? 'last night'}`}
            sub={handover.map((h) => h.body).join(' · ')} right={handoverRead ? undefined : <span className="pill p-new">New</span>} />
        )}
        {write && !eod.submitted && <RowLink to="/close/handover" lead={<span className="av"><Icon d={ICONS.pen} /></span>} title="Write the handover" />}
      </div>
    </section>
  );
}

/** Food safety, always one row: the way in, with anything that needs doing. */
export function FoodSafetySection() {
  return (
    <section className="grp" aria-label="Food safety">
      <div className="sub"><FoodSafetyRow /></div>
    </section>
  );
}



/** The checklists as the main card (staff, supervisors): how many are done, a bar each, and the next step. */
export function ChecklistCard({ label, next, stats, tour }: { label: string; next: UpNextStep; stats?: ReactNode; tour: string }) {
  const { at, scheduled, checksDone } = useToday();
  return (
    <div className="hero mh-card" data-tour={tour}>
      <div className="hero-row"><span className="hl">{label}</span><span className="hs-small">{timeHM(at)}</span></div>
      <div className="big"><b>{checksDone}</b><i>&nbsp;of {scheduled.length} checklists done</i></div>
      <div className="segs" aria-hidden="true">
        {scheduled.map((t) => <span key={t.key} className={isDone(t) ? 'd' : t.status === 'missed' || t.status === 'late' ? 'bad' : ''} />)}
      </div>
      {stats}
      <UpNext step={next} />
    </div>
  );
}

/** The next checklist as an Up next step, or "see checklists" once they're all done. */
export function checklistStep(t: TaskView | undefined, missed = 0): UpNextStep {
  if (!t && missed) return { to: '/day', text: `Nothing left · ${missed} missed`, label: 'See what was missed' };
  if (!t) return { to: '/checklists', text: 'All done · see checklists', label: 'See checklists' };
  const now = t.status === 'late' || t.status === 'missed';
  return { to: runPath(t.key), text: `${t.title}${t.dueTime && !t.title.includes(t.dueTime) ? ` · ${t.dueTime}` : ''}`, label: `${now ? 'Do now' : 'Start'}: ${t.title}` };
}

/** The EOD's next section as an Up next step: "Lunch · from the till report". */
export function eodStep(eod: { next: { to: string; text: string } }): UpNextStep {
  const k = eod.next.to.startsWith('/close/') ? eod.next.to.slice(7) : '';
  return k in SECTION_LABELS
    ? { to: eod.next.to, text: `${SECTION_LABELS[k as keyof typeof SECTION_LABELS]} · ${sectionHint(k)}`, label: eod.next.text }
    : { to: eod.next.to, text: eod.next.text, label: eod.next.text };
}
