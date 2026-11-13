/**
 * The pieces every site home shares (designs P1 phone, D1 desktop): the Up next pill inside the main card,
 * Needs you with exact counts, Later today on phones and Your day on desktop.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { dayCloseAt, formatPounds, reportedText, SECTION_LABELS } from '@maginhawa/core';
import { timeHM, useDraft } from '../../lib/draft';
import { checksText, isDone, runPath, statusPill, useChecklists, type TaskView } from '../../lib/checklists';
import { useSite } from '../../lib/site';
import { Chevron, Icon, RowLink } from '../ui';
import { ICONS } from '../ui-helpers';
import { EodIssueRows, PhaseRows } from './shared';
import { useEod, useToday } from './shared-helpers';
import { FoodSafetyRow, useFoodSafetyItems } from '../FoodSafetyRow';

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



/** Needs you, with exact counts in the header and one row per thing (P1, D1). */
/** What each role sees here: staff get their lists only; supervisors add re-checks; managers get everything. */
export interface NeedsOptions { repairs?: boolean; handover?: boolean; yesterday?: boolean; eodIssues?: boolean; rechecks?: boolean }

export function NeedsYou({ at, show = { repairs: true, handover: true, yesterday: true, eodIssues: true } }: { at: Date; show?: NeedsOptions }) {
  const { tasks } = useToday();
  const checklists = useChecklists();
  const site = useSite();
  const eod = useEod();
  const food = useFoodSafetyItems();
  const { handover, handoverBy } = site;
  const open = show.repairs ? site.open : [];
  const missedYesterday = show.yesterday ? checklists.missedYesterday : [];
  const issues = show.eodIssues ? eod.issues : [];
  const unread = !!show.handover && handover.length > 0 && !site.handoverRead;
  const urgent = tasks.filter((t) => t.status === 'late' || t.status === 'due' || (show.rechecks && t.recheckOf && t.status === 'upcoming'));
  const missed = tasks.filter((t) => t.status === 'missed');
  const nLate = urgent.filter((t) => t.status === 'late').length;
  const nDue = urgent.filter((t) => t.status === 'due').length;
  const nSoon = urgent.length - nLate - nDue;
  const shownMissed = missed.slice(0, missed.length > 3 ? 2 : 3);
  const counts = [
    nLate && `${nLate} late`,
    nDue && `${nDue} due`,
    nSoon && `${nSoon} ${nSoon === 1 ? 're-check' : 're-checks'}`,
    missed.length && `${missed.length} missed`,
    open.length && `${open.length} ${open.length === 1 ? 'repair' : 'repairs'}`,
  ].filter(Boolean).join(' · ');
  const any = unread || open.length || urgent.length || missed.length || missedYesterday.length || issues.length || food.length;
  if (!any) return null;
  return (
    <section className="grp mh-needs" data-tour="needs">
      <div className="hd"><h2>Needs you</h2>{counts && <span>{counts}</span>}</div>
      <div className="sub">
        {unread && (
          <RowLink to="/handover" lead={<span className="av link"><Icon d={ICONS.chat} /></span>} title={`Handover from ${handoverBy ?? 'last night'}`}
            sub={handover.map((h) => h.body).join(' · ')} right={<span className="pill p-new">New</span>} />
        )}
        {urgent.map((t) => {
          const pill = statusPill(t, at);
          const text = t.status === 'upcoming' && t.dueAt ? `In ${Math.max(1, Math.round((t.dueAt.getTime() - at.getTime()) / 60_000))} min` : pill.text;
          return <RowLink key={t.key} to={runPath(t.key)} lead={<span className="av warn"><Icon d={t.recheckOf ? ICONS.thermo : ICONS.clock} size={17} /></span>}
            title={t.title} sub={t.recheckOf ? 'Re-check after a failed reading' : checksText(t)} right={<span className="pill p-warn">{text}</span>} />;
        })}
        {shownMissed.map((t) => (
          <RowLink key={t.key} to="/day" lead={<span className="av bad"><Icon d={ICONS.bang} size={15} /></span>}
            title={t.title} sub={`${checksText(t)} · add a note`} right={<span className="pill p-bad">Missed</span>} />
        ))}
        {missed.length > shownMissed.length && (
          <RowLink to="/day" lead={<span className="av" aria-hidden="true">{missed.length - shownMissed.length}</span>} title={`${missed.length - shownMissed.length} more missed`} sub="See them on the timeline" />
        )}
        {open.slice(0, 2).map((r) => (
          <RowLink key={r.id} to="/repairs" lead={<span className={`av ${r.urgent ? 'bad' : ''}`}><Icon d={ICONS.wrench} /></span>}
            title={r.title} sub={`Repair · ${reportedText(r.reportedAt, at)}`} right={<span className={`pill ${r.urgent ? 'p-bad' : 'p-mut'}`}>{r.urgent ? 'Urgent' : 'Open'}</span>} />
        ))}
        {open.length > 2 && <RowLink to="/repairs" lead={<span className="av"><Icon d={ICONS.wrench} /></span>} title={`${open.length - 2} more repairs`} />}
        {missedYesterday.length > 0 && (
          <RowLink to="/checklists" lead={<span className="av" aria-hidden="true">{missedYesterday.length}</span>}
            title={missedYesterday.length === 1 ? `${missedYesterday[0]!.title} was missed` : `${missedYesterday.length} checklists missed`}
            sub={missedYesterday.length === 1 ? 'Yesterday' : `Yesterday · ${missedYesterday.map((t) => t.title).join(', ')}`} />
        )}
        <FoodSafetyRow />
        <EodIssueRows issues={issues} />
      </div>
    </section>
  );
}

/** Later today (phone): what's still to come, in time order. */
export function LaterToday({ at, eodRow = true, extra }: { at: Date; eodRow?: boolean; extra?: ReactNode }) {
  const { tasks, scheduled, checksDone } = useToday();
  const { handover, handoverRead } = useSite();
  const eod = useEod();
  const coming = tasks.filter((t) => t.status === 'upcoming').slice(0, 4);
  const allDone = scheduled.length > 0 && checksDone === scheduled.length;
  return (
    <section className="grp mh-later" data-tour="todo">
      <div className="hd"><h2>Later today</h2><Link className="mh-now" to="/day">Now {timeHM(at)}<Chevron /></Link></div>
      <div className="sub">
        {allDone && <PhaseRows />}
        {coming.map((t) => (
          <RowLink key={t.key} to={runPath(t.key)} lead={<span className="mh-time">{t.dueTime}</span>} title={t.title} sub={checksText(t)} />
        ))}
        {eodRow && <RowLink to={eod.to} lead={<span className="mh-time"><Icon d={ICONS.list} /></span>} title="End-of-day report" sub={eod.rowSub}
          right={eod.result.totalNet ? <span className="amt">{formatPounds(eod.result.totalNet)}</span> : undefined} />}
        {handover.length > 0 && handoverRead && <RowLink to="/handover" lead={<span className="mh-time"><Icon d={ICONS.chat} /></span>} title="Handover from last night" sub={handover.map((h) => h.body).join(' · ')} />}
        {extra}
      </div>
    </section>
  );
}

/** Your day (desktop): the checklists along one line from opening to the EOD, with now marked (D1). */
export function YourDay({ at, eodMark = true }: { at: Date; eodMark?: boolean }) {
  const { scheduled } = useToday();
  const { draft, settings } = useDraft();
  const eod = useEod();
  const dated = scheduled.filter((t): t is TaskView & { dueAt: Date } => !!t.dueAt).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  if (!dated.length) return null;
  const start = dated[0]!.dueAt.getTime();
  const end = dayCloseAt(draft.businessDate, settings.dayCloseTime, settings.timezone).getTime();
  const span = Math.max(end - start, 1);
  const x = (ms: number) => Math.min(1, Math.max(0, (ms - start) / span));
  const nowX = x(at.getTime());
  const marks = [
    ...dated.map((t) => ({ key: t.key, x: x(t.dueAt.getTime()), label: t.dueTime && !t.title.includes(t.dueTime) ? `${t.dueTime} ${t.title}` : t.title, to: runPath(t.key),
      state: isDone(t) ? 'done' : t.status === 'missed' ? 'bad' : t.status === 'late' || t.status === 'due' ? 'late' : 'todo' })),
    ...(eodMark ? [{ key: 'eod', x: 1, label: eod.submitted ? 'EOD sent' : 'Send EOD', to: eod.to, state: eod.submitted ? 'done' : 'todo' }] : []),
  ];
  // Labels that would touch drop to a second line.
  const last: [number, number] = [-1, -1]; // where the last label sits on the top line and the lower line
  const placed = marks.map((m) => {
    const nearTop = last[0] >= 0 && m.x - last[0] < 0.14;
    const nearLow = last[1] >= 0 && m.x - last[1] < 0.14;
    const low = nearTop && !nearLow;
    const hide = nearTop && nearLow; // still on the line and clickable; the label is read out, not drawn
    if (!hide) last[low ? 1 : 0] = m.x;
    return { ...m, low, hide };
  });
  return (
    <section className="grp mh-day" aria-label="Your day">
      <div className="hd"><h2>Your day</h2><Link className="mh-now" to="/day">Now {timeHM(at)}<Chevron /></Link></div>
      <div className="mh-track" style={{ ['--now' as string]: nowX }}>
        <span className="mh-line" /><span className="mh-fill" /><span className="mh-nowline" /><span className="mh-nowtag">{timeHM(at)}</span>
        {placed.map((m, i) => (
          <Link key={m.key} to={m.to} className={`mh-mark ${m.state}${m.low ? ' low' : ''}${i === 0 ? ' first' : i === placed.length - 1 ? ' last' : ''}`} style={{ ['--x' as string]: m.x }}>
            <span className="mh-dot" /><span className={`mh-lab${m.hide ? ' vh' : ''}`}>{m.label.trim()}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}


/** Service in words for the date line: "dinner service" from 17:00, "lunch service" from 11:00. */
export function service(d: Date, timeZone = 'Europe/London'): string {
  const h = Number(d.toLocaleString('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }));
  return h >= 17 && h < 24 ? ' · dinner service' : h >= 11 && h < 15 ? ' · lunch service' : '';
}

/** Where a section's figures come from, for the Up next pill. */
export function sectionHint(k: string): string {
  return k === 'lunch' || k === 'dinner' ? 'from the till report' : k === 'wages' ? 'from the rota' : k === 'delivery' ? 'from the apps' : k === 'tips' ? 'card, cash, tronc' : k === 'handover' ? 'notes for tomorrow' : 'a few taps';
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

/** Last night's handover once it's been read: one tap away on every home (desktop has no Later today). */
export function ReadHandover() {
  const { handover, handoverRead, handoverBy } = useSite();
  if (!handover.length || !handoverRead) return null;
  return (
    <section className="grp"><div className="sub">
      <RowLink to="/handover" lead={<span className="mh-time"><Icon d={ICONS.chat} /></span>} title={`Handover from ${handoverBy ?? 'last night'}`} sub={handover.map((h) => h.body).join(' · ')} />
    </div></section>
  );
}
