/**
 * The home screen's widgets (designs W1–W3). Each is a small card with a title, one or two lines that
 * matter now, and a way in. Which ones show, and in what order, is each person's (lib/home-layout.ts).
 */
import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { formatPounds, itemIdsOf, lastSevenDays, SECTION_KEYS, SECTION_LABELS, sectionStatus, whoDidWhat } from '@maginhawa/core';
import { can, canDoEod, initialsOf, useAuth } from '../../lib/auth';
import { timeHM, useDraft } from '../../lib/draft';
import { checksText, isDone, isOverdue, runPath, statusPill, useChecklists } from '../../lib/checklists';
import { useSite } from '../../lib/site';
import { useStock } from '../../lib/stock';
import { planState } from '../../lib/stock-helpers';
import { useOps } from '../../lib/ops';
import { suggestions } from '../../lib/ops-helpers';
import { useTradingHistory } from '../../lib/history';
import { shiftAt, SHIFTS, useHomeLayout, WIDGETS, type Shift, type WidgetId } from '../../lib/home-layout';
import { Icon, Pie, RowLink, Segments } from '../ui';
import { ICONS } from '../ui-helpers';
import { useFoodSafetyItems } from '../FoodSafetyRow';
import { EodIssueRows, TaskRow } from './shared';
import { useEod, useToday } from './shared-helpers';
import { UpNext, type UpNextStep } from './today';

export const WIDGET_ICONS: Record<WidgetId, string> = {
  checklists: ICONS.check, eod: ICONS.list, day: ICONS.clock, stack: ICONS.star, quick: ICONS.plus, stock: ICONS.box, repairs: ICONS.wrench, handover: ICONS.handover,
  food: ICONS.thermo, recipes: ICONS.list, onshift: ICONS.people, week: ICONS.chart,
};

/** The card every widget sits in: title (a link when there's a screen behind it), what's on the right, then the content. */
function W({ id, to, meta, children, small, dot }: { id: WidgetId; to?: string; meta?: ReactNode; children: ReactNode; small?: boolean; dot?: { tone: 'bad' | 'warn'; label: string } }) {
  const name = WIDGETS[id].name;
  // The dot is drawn on the icon but read after the name: "Food safety, 2 to do".
  const icon = <span className="wi" aria-hidden="true"><Icon d={WIDGET_ICONS[id]} size={16} />{dot && <span className={`wdot ${dot.tone}`} />}</span>;
  const said = dot ? <span className="vh">, {dot.label}</span> : null;
  return (
    <section className={`w${WIDGETS[id].wide && !small ? ' wide' : ''}${small ? ' small' : ''}`} aria-label={name} data-widget={id} data-tour={id === 'checklists' ? 'needs' : undefined}>
      <div className="wh">
        <h2>{to ? <Link to={to}>{icon}{name}{said}</Link> : <>{icon}{name}{said}</>}</h2>
        {meta}
      </div>
      {children}
    </section>
  );
}

const Meta = ({ children }: { children: ReactNode }) => <span className="wmeta">{children}</span>;

/** A compact tile (W4, Bento): the one number that matters, and a word or two under it. */
function Tile({ id, to, big, of, label, tone, children }: { id: WidgetId; to: string; big: ReactNode; of?: ReactNode; label: ReactNode; tone?: 'bad' | 'warn'; children?: ReactNode }) {
  return (
    <W id={id} to={to} small>
      <Link className="wtile" to={to}><b>{big}{of !== undefined && <small> {of}</small>}</b></Link>
      {children}
      <span className={`wtile-l${tone ? ` t-${tone}` : ''}`}>{label}</span>
    </W>
  );
}

function ChecklistsWidget({ small }: { small?: boolean }) {
  const { user } = useAuth();
  const { at, tasks, scheduled, checksDone } = useToday();
  const { missedYesterday } = useChecklists();
  const { settings } = useDraft();
  const rank: Record<string, number> = { late: 0, due: 1, missed: 2, upcoming: 3, anytime: 4 };
  const todo = tasks.filter((t) => !isDone(t) && t.status !== 'anytime')
    .sort((a, b) => (rank[a.status] ?? 5) - (rank[b.status] ?? 5) || (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
  const late = tasks.filter((t) => t.status === 'late').length;
  const missed = tasks.filter((t) => t.status === 'missed').length;
  const yesterday = user && (user.role === 'manager' || user.role === 'headoffice') ? missedYesterday : [];
  if (small) return <Tile id="checklists" to="/checklists" big={checksDone} of={`/ ${scheduled.length}`} label={late ? `${late} late` : missed ? `${missed} missed` : todo[0] ? `Next: ${todo[0].title}` : 'All done'} tone={late ? 'bad' : missed ? 'warn' : undefined} />;
  const focus = todo[0];
  // "Next due": the next list with a time after the one shown.
  const nextDue = todo.filter((t) => t !== focus && t.dueAt && t.dueAt.getTime() > at.getTime()).sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())[0];
  const hm = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: settings.timezone });
  const frac = scheduled.length ? checksDone / scheduled.length : 0;
  return (
    <W id="checklists" to="/checklists" meta={late ? <span className="pill p-warn">{late} late</span> : missed ? <span className="pill p-warn">{missed} missed</span> : <Meta>{checksDone} of {scheduled.length} done</Meta>}>
      <div className="wck">
        <svg width="60" height="60" viewBox="0 0 48 48" role="img" aria-label={`${checksDone} of ${scheduled.length} checklists done`} className="wring">
          <circle cx="24" cy="24" r="20" fill="none" className="wring-track" strokeWidth="5" />
          <circle cx="24" cy="24" r="20" fill="none" className="wring-fill" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${126 * frac} 126`} strokeOpacity={frac ? 1 : 0} transform="rotate(-90 24 24)" />
          <text x="24" y="28.5" textAnchor="middle" fontSize="12" fontWeight="700" aria-hidden="true">{checksDone}/{scheduled.length}</text>
        </svg>
        <div className="wck-r">
          {focus ? (
            <Link className="ln" to={runPath(focus.key)} aria-label={`${focus.status === 'late' || focus.status === 'missed' ? 'Do now' : 'Start'}: ${focus.title}, ${statusPill(focus, at).text}`}>
              <span className="t"><b>{focus.title}</b><span>{isOverdue(focus) || focus.status === 'due' ? statusPill(focus, at).text : checksText(focus)}{focus.template.who ? ` · ${focus.template.who}` : ''}</span></span>
              <span className="mini" aria-hidden="true">Start</span>
            </Link>
          ) : <p className="wnote">{tasks.length ? 'All done for now.' : 'No checklists today.'}</p>}
          {nextDue && <span className="wsmall">Next due · {nextDue.title.replace(/ · \d\d:\d\d$/, '')} at {hm(nextDue.dueAt!)}</span>}
          {todo.length > 1 && !nextDue && <span className="wsmall">{todo.length - 1} more to do</span>}
          {yesterday.length > 0 && <Link className="wsmall wlink" to="/checklists">Yesterday: {yesterday.length === 1 ? `${yesterday[0]!.title} was missed` : `${yesterday.length} checklists missed`}</Link>}
        </div>
      </div>
    </W>
  );
}

const SHORT: Partial<Record<string, string>> = { promotions: 'Promos', tips: 'Tips' };

function EodWidget({ small }: { small?: boolean }) {
  const eod = useEod();
  const { draft, progress } = useDraft();
  if (small) return <Tile id="eod" to="/close" big={progress.done} of={`of ${progress.active}`} label={eod.submitted ? 'Sent' : eod.next.text}><Segments statuses={eod.statuses} /></Tile>;
  return (
    <W id="eod" to="/close" meta={<Meta>{eod.submitted ? 'Sent' : `${progress.done} of ${progress.active} done`}</Meta>}>
      <div className="wsecs">
        {SECTION_KEYS.map((k) => {
          const st = sectionStatus(draft, k);
          if (st === 'skipped') return null;
          return <Link key={k} to={eod.submitted ? '/close/done' : `/close/${k}`} className={`wsec ${st}`}><Pie status={st} size={22} /><span>{SHORT[k] ?? SECTION_LABELS[k]}</span></Link>;
        })}
      </div>
      {eod.issues.length > 0 && <div className="sub">{<EodIssueRows issues={eod.issues} />}</div>}
    </W>
  );
}

function StockWidget({ small }: { small?: boolean }) {
  const { user } = useAuth();
  const { site, data } = useStock();
  const { businessDate } = useChecklists();
  const ops = useOps();
  if (!user) return null;
  const states = site.plans.map((p) => ({ plan: p, state: planState(p, site.counts, businessDate) }));
  const focus = states.find((s) => s.state.kind === 'open') ?? states.find((s) => s.state.kind === 'due');
  const low = suggestions(data.items, data.counts, ops, user.siteCode).filter((s) => s.packs > 0 && s.onHand !== null);
  const toCheck = ops.data.orders.filter((o) => o.siteCode === user.siteCode && o.placedAt && !o.receivedAt);
  const rows: ReactNode[] = [];
  if (focus) {
    const open = focus.state.kind === 'open' ? focus.state.count : null;
    const total = open ? itemIdsOf(open).length : 0;
    const counted = open ? Object.keys(open.lines).length : 0;
    rows.push(<Link key="count" className="ln" to="/stock"><span className="t"><b>{focus.plan.name}{open ? '' : ' due today'}</b><span>{open ? `${counted} of ${total} counted` : 'Not started yet'}</span></span><span className="mini" aria-hidden="true">{open ? 'Carry on' : 'Start'}</span></Link>);
    if (open) rows.push(<div key="bar" className="wbar" role="progressbar" aria-label={`${focus.plan.name} counted`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={counted}><i style={{ width: `${total ? (counted / total) * 100 : 0}%` }} /></div>);
  }
  if (low.length) {
    const names = low.slice(0, 2).map((s) => s.item.name).join(', ');
    rows.push(<Link key="low" className="ln sep" to="/stock/order"><span className="t"><b>{low.length} running low</b><span>{low.length > 2 ? `${names} and ${low.length - 2} more` : names}</span></span><span className="mini g" aria-hidden="true">Order</span></Link>);
  }
  if (toCheck.length) {
    const o = toCheck[0]!;
    rows.push(<Link key="del" className="ln sep" to={toCheck.length === 1 ? `/stock/delivery/${o.id}` : '/stock'}><span className="t"><b>{toCheck.length === 1 ? `Delivery · ${ops.supplier(o.supplierId)?.name ?? 'supplier'}` : `${toCheck.length} deliveries to check`}</b><span>Tick what came</span></span><span className="mini g" aria-hidden="true">Check in</span></Link>);
  }
  if (small) {
    const open = focus?.state.kind === 'open' ? focus.state.count : null;
    return open
      ? <Tile id="stock" to="/stock" big={Object.keys(open.lines).length} of={`/ ${itemIdsOf(open).length}`} label={`${focus!.plan.name} counted`} />
      : <Tile id="stock" to="/stock" big={low.length} label={focus ? `${focus.plan.name} due today` : 'Running low'} tone={low.length ? 'warn' : undefined} />;
  }
  return (
    <W id="stock" to="/stock" meta={<Link className="wmeta" to="/stock">Open stock</Link>}>
      {rows.length ? rows : <p className="wnote">Nothing to count or check in today.</p>}
    </W>
  );
}

function RepairsWidget({ small }: { small?: boolean }) {
  const { user } = useAuth();
  const { open } = useSite();
  const fixer = user ? can.fixRepairs(user.role) : false;
  const urgent = open.filter((r) => r.urgent);
  if (small && fixer) return <Tile id="repairs" to="/repairs" big={open.length} label={urgent[0] ? `${urgent[0].title} · urgent` : 'open'} tone={urgent.length ? 'bad' : undefined} />;
  return (
    <W id="repairs" to={fixer ? '/repairs' : undefined} meta={fixer && urgent.length ? <span className="pill p-bad">{urgent.length} urgent</span> : undefined}>
      {fixer && open.length
        ? <Link className="wbig" to="/repairs"><b>{open.length}</b><span>open{urgent[0] ? ` · ${urgent[0].title}` : ` · ${open[0]!.title}`}</span></Link>
        : <p className="wnote">{fixer ? 'Nothing open.' : 'Something broken? Take a photo and it goes to your manager.'}</p>}
      <Link className="wfoot" to="/report"><Icon d={ICONS.plus} size={16} />Report a problem</Link>
    </W>
  );
}

function HandoverWidget({ small }: { small?: boolean }) {
  const { user } = useAuth();
  const { handover, handoverBy, handoverRead, teamNotes } = useSite();
  const eod = useEod();
  // The closer writes it in the end of day report; anyone else (or after it's sent) adds a note.
  const write = user ? canDoEod(user) && !eod.submitted : false;
  if (small) return <Tile id="handover" to="/handover" big={handover.length} label={handover.length ? (handoverRead ? `${handover.length === 1 ? 'note' : 'notes'} from ${handoverBy ?? 'last night'}` : 'New from last night') : 'Nothing from last night'} tone={handover.length && !handoverRead ? 'warn' : undefined} />;
  return (
    <W id="handover" meta={handover.length && !handoverRead ? <span className="pill p-new">New</span> : undefined}>
      {handover.length
        ? <Link className="wbody" to="/handover" aria-label={`Handover from ${handoverBy ?? 'last night'}: ${handover.map((h) => h.body).join(' · ')}`}>
            <b>{handover.length} {handover.length === 1 ? 'note' : 'notes'} from {handoverBy ?? 'last night'}</b>
            <span>{handover[0]!.body}</span>
          </Link>
        : <p className="wnote">Nothing from last night.</p>}
      {write
        ? <Link className="wfoot" to="/close/handover"><Icon d={ICONS.pen} size={16} />Write the handover</Link>
        : <Link className="wfoot" to="/handover/new"><Icon d={ICONS.plus} size={16} />Add to the handover{teamNotes.length > 0 && <span>{teamNotes.length} tonight</span>}</Link>}
    </W>
  );
}

function FoodWidget({ small }: { small?: boolean }) {
  const items = useFoodSafetyItems();
  const bad = items.some((i) => i.level === 'bad');
  if (small) return <Tile id="food" to="/food-safety" big={items.length} label={items[0]?.title ?? 'All up to date'} tone={bad ? 'bad' : items.length ? 'warn' : undefined} />;
  const qa: [string, string, string][] = [
    ['Log temp', '/food-safety/probes', ICONS.thermo], ['Delivery', '/food-safety/deliveries/new', ICONS.moped],
    ['Allergens', '/food-safety/allergens', ICONS.bang], ['Problem', '/report', ICONS.wrench],
  ];
  return (
    <W id="food" to="/food-safety" dot={items.length ? { tone: bad ? 'bad' : 'warn', label: `${items.length} to do${bad ? ', something failed' : ''}` } : undefined}>
      <div className="wqa">{qa.map(([l, to, ic]) => <Link key={to} to={to} aria-label={l === 'Problem' ? 'Report a problem' : undefined}><span aria-hidden="true"><Icon d={ic} size={15} /></span>{l}</Link>)}</div>
    </W>
  );
}

function RecipesWidget() {
  const { data } = useOps();
  return (
    <W id="recipes" to="/recipes">
      <Link className="wsearch" to="/recipes"><Icon d={ICONS.search} size={14} />Find a dish</Link>
      <div className="wlinks">{data.recipes.slice(0, 3).map((r) => <Link key={r.id} to={`/recipes/${r.id}`}>{r.name}</Link>)}</div>
    </W>
  );
}

function OnShiftWidget() {
  const { user } = useAuth();
  const { done } = useToday();
  const people = whoDidWhat(done.filter((t) => t.run?.completedAt).map((t) => ({ title: t.title, completedAt: t.run!.completedAt!, completedBy: t.run!.completedBy ?? 'Someone' })));
  return (
    <W id="onshift" meta={<Meta>Who did what</Meta>}>
      {people.length ? (
        <div className="sub">
          {people.map((p) => (
            <div className="li" key={p.name}>
              <span className="av">{initialsOf(p.name)}</span>
              <span className="tx"><span>{p.name === user?.name ? 'You' : p.name}</span><small>{p.items.map((i) => `${i.title} ${timeHM(new Date(i.completedAt))}`).join(' · ')}</small></span>
              <span className="rt">{p.items.length} done</span>
            </div>
          ))}
        </div>
      ) : <p className="wnote">Nobody has finished a checklist yet today.</p>}
    </W>
  );
}

function WeekWidget() {
  const { settings } = useDraft();
  const { rows, example, lastDate } = useTradingHistory();
  const w = lastSevenDays(rows, settings.siteCode, lastDate);
  if (!w) return <W id="week"><p className="wnote">No days sent yet. Net sales, wages and covers show here once the first end of day report is in.</p></W>;
  const top = Math.max(...w.days.map((d) => d.net ?? 0), 1);
  const change = (n: number | null) => (n === null ? null : <span className={n >= 0 ? 'ok' : 'warn'} style={{ fontSize: 13, fontWeight: 600 }}>{n >= 0 ? '+' : '−'}{Math.abs(n)}%</span>);
  return (
    <W id="week" meta={<Meta>{example ? 'Example figures' : 'Net sales'}</Meta>}>
      <div className="bars" role="img" aria-label={`Net sales each day: ${w.days.map((d) => `${d.label} ${d.net === null ? 'closed' : formatPounds(d.net)}`).join(', ')}`}>
        {w.days.map((d, i) => <div key={d.date} className={`bar${i === 6 ? ' now' : ''}`}><i style={{ height: d.net === null ? 2 : Math.max(4, Math.round((d.net / top) * 72)) }} />{d.label}</div>)}
      </div>
      <div className="sub">
        <div className="fr"><span>Net sales</span><span className="rt"><span className="amt">{formatPounds(w.net)}</span>{change(w.netChange)}</span></div>
        {w.wagePct !== null && <div className="fr"><span>Wages</span><span className="rt"><span className="amt">{w.wagePct}%</span>{w.wagePct > 30 && <span className="warn" style={{ fontSize: 13, fontWeight: 600 }}>Over 30%</span>}</span></div>}
        <div className="fr"><span>Covers</span><span className="rt"><span className="amt">{w.covers}</span>{change(w.coversChange)}</span></div>
      </div>
    </W>
  );
}

/** Your day (W5): everything due today on a time line, with where we are now. */
function DayWidget() {
  const { at, tasks } = useToday();
  const { user } = useAuth();
  const { settings } = useDraft();
  const eod = useEod();
  const { progress } = useDraft();
  const timed = tasks.filter((t) => t.dueAt).sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime());
  const done = timed.filter(isDone);
  // Keep the last two done in view; fold the rest into "Earlier".
  const earlier = done.slice(0, Math.max(0, done.length - 2));
  const shown = timed.filter((t) => !earlier.includes(t));
  const nowAt = shown.findIndex((t) => t.dueAt!.getTime() > at.getTime());
  const hm = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: settings.timezone });
  const row = (t: typeof timed[number]) => {
    const st = isDone(t) ? 'done' : isOverdue(t) ? 'late' : 'todo';
    return (
      <li key={t.key} className={`wday-r ${st}`}>
        <span className="wday-t">{hm(t.dueAt!)}</span><span className="wday-d" aria-hidden="true" />
        <Link to={runPath(t.key)} className="wday-x"><b>{t.title.replace(/ · \d\d:\d\d$/, '')}</b><small>{isDone(t) ? `Done${t.run?.completedBy ? ` by ${t.run.completedBy === user?.name ? 'you' : t.run.completedBy}` : ''}` : isOverdue(t) ? statusPill(t, at).text : checksText(t)}</small></Link>
        {st === 'late' && <span className="chip sm" aria-hidden="true">Start</span>}
      </li>
    );
  };
  return (
    <W id="day" meta={earlier.length ? <Meta>Earlier: {earlier.length} done</Meta> : undefined}>
      {timed.length || (user && canDoEod(user)) ? (
        <ol className="wday">
          {shown.map((t, i) => (
            <FragmentWithNow key={t.key} now={i === (nowAt === -1 ? shown.length : nowAt) ? hm(at) : null}>{row(t)}</FragmentWithNow>
          ))}
          {nowAt === -1 && <NowLine time={hm(at)} />}
          {user && canDoEod(user) && (
            <li className={`wday-r ${eod.submitted ? 'done' : 'todo'}`}>
              <span className="wday-t">After</span><span className="wday-d" aria-hidden="true" />
              <Link to={eod.to} className="wday-x"><b>End of day report</b><small>{eod.submitted ? 'Sent' : `${progress.done} of ${progress.active} sections`}</small></Link>
            </li>
          )}
        </ol>
      ) : <p className="wnote">Nothing timed today.</p>}
    </W>
  );
}
const NowLine = ({ time }: { time: string }) => <li className="wday-now" aria-label={`Now, ${time}`}><span className="wday-t"><span>{time}</span></span><span className="wday-d" aria-hidden="true" /><span className="wday-line" aria-hidden="true" /></li>;
function FragmentWithNow({ now, children }: { now: string | null; children: ReactNode }) {
  return <>{now && <NowLine time={now} />}{children}</>;
}

/**
 * Smart stack (W8): one widget at a time, the most urgent on top, the rest peeking out behind; swipe for the
 * next. Each card is a topic (checklists, food safety, the end of day report, repairs, handover) with its
 * number, what's wrong in a pill, and the one thing to do.
 */
function StackWidget() {
  const { user } = useAuth();
  const { at, tasks, scheduled, checksDone } = useToday();
  const { open, handover, handoverRead, handoverBy } = useSite();
  const food = useFoodSafetyItems();
  const eod = useEod();
  const { progress } = useDraft();
  type Page = { id: WidgetId; tone: 'bad' | 'warn' | ''; big: number; of: string; ring?: number; pill?: { text: string; tone: 'bad' | 'warn' }; to: string; go: string };
  const pages: Page[] = [];
  const bare = (t: string) => t.replace(/ · \d\d:\d\d$/, '');
  // Checklists: the one to do now (late first).
  const urgent = [...tasks.filter((t) => t.status === 'late'), ...tasks.filter((t) => t.status === 'missed'), ...tasks.filter((t) => t.status === 'due')][0];
  const nextTask = urgent ?? tasks.filter((t) => !isDone(t) && t.status === 'upcoming').sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0))[0];
  if (scheduled.length) {
    pages.push({
      id: 'checklists', tone: urgent ? (urgent.status === 'due' ? 'warn' : 'bad') : '', big: checksDone, of: `of ${scheduled.length} done`, ring: checksDone / scheduled.length,
      pill: urgent ? { text: `${bare(urgent.title)} · ${statusPill(urgent, at).text.toLowerCase()}`, tone: urgent.status === 'due' ? 'warn' : 'bad' } : undefined,
      to: nextTask ? runPath(nextTask.key) : '/checklists', go: nextTask ? `Start ${bare(nextTask.title).toLowerCase()}` : 'See checklists',
    });
  }
  if (food.length) {
    const bad = food.some((x) => x.level === 'bad');
    pages.push({ id: 'food', tone: bad ? 'bad' : 'warn', big: food.length, of: 'to do', pill: { text: food[0]!.title, tone: bad ? 'bad' : 'warn' }, to: '/food-safety', go: 'Open food safety' });
  }
  // The end of day report carries money: only for those who close.
  if (user && canDoEod(user) && !eod.submitted) {
    const issue = eod.issues[0];
    pages.push({ id: 'eod', tone: issue?.level === 'block' ? 'bad' : issue ? 'warn' : '', big: progress.done, of: `of ${progress.active} sections`, ring: progress.active ? progress.done / progress.active : 0,
      pill: issue ? { text: issue.title, tone: issue.level === 'block' ? 'bad' : 'warn' } : undefined, to: issue ? `/close/${issue.section}` : eod.next.to, go: issue ? 'Fix it' : eod.next.text });
  }
  if (user && can.fixRepairs(user.role) && open.length) {
    const u = open.find((r) => r.urgent);
    pages.push({ id: 'repairs', tone: u ? 'bad' : '', big: open.length, of: 'open', pill: u ? { text: `${u.title} · urgent`, tone: 'bad' } : undefined, to: '/repairs', go: 'See repairs' });
  }
  if (handover.length) {
    pages.push({ id: 'handover', tone: handoverRead ? '' : 'warn', big: handover.length, of: handover.length === 1 ? 'note' : 'notes', pill: handoverRead ? undefined : { text: `New from ${handoverBy ?? 'last night'}`, tone: 'warn' }, to: '/handover', go: 'Read the handover' });
  }
  const rank = { bad: 0, warn: 1, '': 2 } as const;
  pages.sort((a, b) => rank[a.tone] - rank[b.tone]);
  const n = pages.length;
  // The top card is kept by what it is, so a change in urgency doesn't swap it under the user.
  const [topId, setTopId] = useState<WidgetId | null>(null);
  const found = topId ? pages.findIndex((p) => p.id === topId) : -1;
  const top = found >= 0 ? found : 0;
  const deck = useRef<HTMLElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // The top card follows the pointer; past 80px it is flung off and the next one rises from behind.
  const [drag, setDrag] = useState<{ x0: number; dx: number; moved: boolean } | null>(null);
  const [leaving, setLeaving] = useState<{ id: WidgetId; dir: 1 | -1 } | null>(null);
  const show = (next: number, dir: 1 | -1) => {
    if (n < 2 || next === top) return;
    window.clearTimeout(timer.current);
    setLeaving({ id: pages[top]!.id, dir });
    setTopId(pages[next]!.id);
    timer.current = window.setTimeout(() => setLeaving(null), 320);
    // Keep keyboard focus in the stack: the old top card goes inert.
    if (deck.current?.contains(document.activeElement)) deck.current.focus();
  };
  const go = (dir: 1 | -1) => show((top + dir + n) % n, dir === 1 ? -1 : 1);
  if (!n) return <W id="stack"><p className="wnote">Nothing urgent right now.</p></W>;
  const depthOf = (i: number) => (i - top + n) % n;
  return (
    <section className="wstk" aria-label="Smart stack" aria-roledescription="carousel" data-widget="stack" ref={deck} tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } }}>
      {/* Said only when the card changes: which one, of how many. */}
      <span className="vh" aria-live="polite">{`${top + 1} of ${n}: ${WIDGETS[pages[top]!.id].name}`}</span>
      <ul className={`wstk-deck${drag ? ' dragging' : ''}`}>
        {pages.map((p, i) => {
          const d = depthOf(i);
          const isTop = d === 0;
          const out = leaving?.id === p.id;
          // Depth 0 is on top; 1 and 2 peek out behind, a little higher and smaller; the rest wait out of sight.
          const style: React.CSSProperties = out
            ? { transform: `translateX(${leaving!.dir * 115}%) rotate(${leaving!.dir * 8}deg)`, opacity: 0, zIndex: n + 1 }
            : isTop && drag
              ? { transform: `translateX(${drag.dx}px) rotate(${drag.dx / 24}deg)`, zIndex: n, transition: 'none' }
              : { transform: `translateY(${-8 * Math.min(d, 2)}px) scale(${1 - 0.05 * Math.min(d, 2)})`, opacity: d > 2 ? 0 : 1, zIndex: n - d };
          return (
            <li key={p.id} className={`w wide wstk-card${isTop ? ' top' : ''}${out ? ' leaving' : ''}`} style={style} aria-hidden={!isTop} ref={(el) => { if (el) { if (isTop) el.removeAttribute('inert'); else el.setAttribute('inert', ''); } }}
              aria-label={`${i + 1} of ${n}: ${WIDGETS[p.id].name}`}
              onPointerDown={(e) => { if (!isTop || n < 2 || e.button > 0) return; setDrag({ x0: e.clientX, dx: 0, moved: false }); }}
              onPointerMove={(e) => {
                if (!drag || !isTop) return;
                if (!e.buttons) { setDrag(null); return; } // let go somewhere else
                const dx = e.clientX - drag.x0;
                // Only take the pointer once it's really a swipe, so a tap on Start still opens it.
                if (!drag.moved && Math.abs(dx) > 6) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* gone */ } }
                setDrag({ ...drag, dx: drag.moved || Math.abs(dx) > 6 ? dx : 0, moved: drag.moved || Math.abs(dx) > 6 });
              }}
              onPointerUp={() => { if (!drag) return; const { dx, moved } = drag; window.setTimeout(() => setDrag(null), 0); if (moved && Math.abs(dx) > 80) go(dx < 0 ? 1 : -1); }}
              onPointerCancel={() => setDrag(null)}
              onClickCapture={(e) => { if (drag?.moved) { e.preventDefault(); e.stopPropagation(); } }}>
              <div className="wh">
                <h2><Link to={p.to} draggable={false}><span className="wi" aria-hidden="true"><Icon d={WIDGET_ICONS[p.id]} size={16} /></span>{WIDGETS[p.id].name}</Link></h2>
                <span className="wmeta">{i + 1} of {n}{n > 1 ? ' · swipe' : ''}</span>
              </div>
              <div className="wstk-body">
                {p.ring !== undefined && (
                  <svg width="64" height="64" viewBox="0 0 48 48" aria-hidden="true" className="wring">
                    <circle cx="24" cy="24" r="20" fill="none" className="wring-track" strokeWidth="6" />
                    <circle cx="24" cy="24" r="20" fill="none" className="wring-fill" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${126 * p.ring} 126`} strokeOpacity={p.ring ? 1 : 0} transform="rotate(-90 24 24)" />
                  </svg>
                )}
                <span className="wstk-tx">
                  <span className="wtile"><b>{p.big}<small> {p.of}</small></b></span>
                  {p.pill && <span className={`pill ${p.pill.tone === 'bad' ? 'p-bad' : 'p-warn'}`}>{p.pill.text}</span>}
                </span>
              </div>
              <Link className="mini" to={p.to} draggable={false}>{p.go}</Link>
            </li>
          );
        })}
      </ul>
      {n > 1 && (
        <div className="wdots" role="group" aria-label="Cards">
          {pages.map((p, i) => <button key={p.id} type="button" className={i === top ? 'on' : ''} aria-current={i === top ? 'true' : undefined} aria-label={`Show ${WIDGETS[p.id].name}`}
            onClick={() => show(i, i > top ? -1 : 1)} />)}
        </div>
      )}
      {n > 1 && <span className="wsmall wstk-then">Then: {[...pages.slice(top + 1), ...pages.slice(0, top)].map((p) => WIDGETS[p.id].name).join(' · ')}</span>}
    </section>
  );
}

/** Quick actions (W8): the four things people do most, one tap each. */
function QuickWidget() {
  const qa: [string, string, string][] = [
    ['Log a temp', '/food-safety/probes', ICONS.thermo], ['Report a problem', '/report', ICONS.wrench],
    ['Waste', '/stock/waste', ICONS.box], ['Order', '/stock/order', ICONS.bag],
  ];
  return (
    <W id="quick">
      <div className="wround">{qa.map(([l, to, ic]) => <Link key={to} to={to}><span aria-hidden="true"><Icon d={ic} size={20} /></span>{l}</Link>)}</div>
    </W>
  );
}

/** The main card as rings (W6): checklists, the end of day report and today's stock counts, each a ring to close. */
export function RingsCard({ next, tour = 'hero-rings' }: { next: UpNextStep; tour?: string }) {
  const { user } = useAuth();
  const { scheduled, checksDone, at } = useToday();
  const { progress } = useDraft();
  const { site } = useStock();
  const { businessDate } = useChecklists();
  const { settings } = useDraft();
  const states = site.plans.map((p) => planState(p, site.counts, businessDate)).filter((s) => s.kind !== 'later');
  const rings = [
    { label: 'Checklists', done: checksDone, total: scheduled.length, col: '#ffffff' },
    ...(user && canDoEod(user) ? [{ label: 'End of day report', done: progress.done, total: progress.active, col: 'oklch(from var(--site) .9 .08 h)' }] : []),
    ...(states.length ? [{ label: 'Stock counts', done: states.filter((s) => s.kind === 'done').length, total: states.length, col: '#b2f2bb' }] : []),
  ];
  const r = [44, 32, 20];
  return (
    <div className="hero mh-card rings-card" data-tour={tour}>
      <div className="hero-row"><span className="hl">Today at a glance</span><span className="hs-small">{at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: settings.timezone })}</span></div>
      <div className="rings-row">
        <svg viewBox="0 0 100 100" width="132" height="132" role="img" aria-label={rings.map((g) => `${g.label} ${g.done} of ${g.total}`).join(', ')}>
          {rings.map((g, i) => {
            const len = 2 * Math.PI * r[i]!;
            const frac = g.total ? g.done / g.total : 0;
            return (
              <g key={g.label}>
                <circle cx="50" cy="50" r={r[i]} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="9" />
                <circle cx="50" cy="50" r={r[i]} fill="none" style={{ stroke: g.col }} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${len * frac} ${len}`} strokeOpacity={frac ? 1 : 0} transform="rotate(-90 50 50)" />
              </g>
            );
          })}
        </svg>
        <ul className="rings-legend">
          {rings.map((g) => <li key={g.label}><i style={{ background: g.col }} aria-hidden="true" /><span>{g.label}</span><b>{g.done}/{g.total}</b></li>)}
        </ul>
      </div>
      <UpNext step={next} />
    </div>
  );
}

const RENDER: Record<WidgetId, (small: boolean) => ReactNode> = {
  checklists: (s) => <ChecklistsWidget small={s} />, eod: (s) => <EodWidget small={s} />, day: () => <DayWidget />, stack: () => <StackWidget />, quick: () => <QuickWidget />,
  stock: (s) => <StockWidget small={s} />, repairs: (s) => <RepairsWidget small={s} />, handover: (s) => <HandoverWidget small={s} />, food: (s) => <FoodWidget small={s} />,
  recipes: () => <RecipesWidget />, onshift: () => <OnShiftWidget />, week: () => <WeekWidget />,
};

/** The main card style this person chose: standard or rings. */
export function useCardStyle() {
  const { user } = useAuth();
  return useHomeLayout(user?.role ?? 'staff', user?.name ?? '', user ? canDoEod(user) : false).card;
}

/**
 * The widgets in this person's order. On desktop the main card goes in the grid too (two columns, two rows),
 * so the widgets fill in around it as in D1/W1.
 */
export function WidgetGrid({ card }: { card?: ReactNode }) {
  const { user } = useAuth();
  const { at } = useToday();
  const { settings } = useDraft();
  const current = shiftAt(at, settings.timezone);
  const [peek, setPeek] = useState<{ shift: Shift; from: Shift } | null>(null);
  // A look ahead ends by itself once the shift changes.
  const shift = peek && peek.from === current ? peek.shift : current;
  const layout = useHomeLayout(user?.role ?? 'staff', user?.name ?? '', user ? canDoEod(user) : false, shift);
  const { handover, handoverRead } = useSite();
  if (!user) return null;
  // Last night's notes can be about safety: until they're read, they show even when Handover is off.
  const order: WidgetId[] = handover.length && !handoverRead && !layout.order.includes('handover') ? ['handover', ...layout.order] : layout.order;
  const looking = shift !== current;
  return (
    <>
      {layout.byShift && (
        <div className="wshift" role="group" aria-label="Widgets for">
          {SHIFTS.map((s) => (
            <button key={s.id} type="button" aria-pressed={s.id === shift} onClick={() => setPeek(s.id === current ? null : { shift: s.id, from: current })}>{s.label}</button>
          ))}
        </div>
      )}
      <div className={`wgrid${card ? ' with-card' : ''}`}>
        {card && <div className="wcard">{card}</div>}
        {order.map((id) => <WidgetSlot key={id} id={id} small={layout.small.includes(id) && WIDGETS[id].compact} />)}
      </div>
      {layout.byShift && looking && <p className="wnote" style={{ textAlign: 'center' }}>Looking ahead. Switches to {SHIFTS.find((s) => s.id === current)!.label} by itself.</p>}
      <div className="wall">
        <Link to="/more" className="wall-more"><span className="wi" aria-hidden="true"><Icon d={ICONS.grid} size={18} /></span><span className="tx"><b>Everything</b><small>Every screen for {user.role === 'staff' ? 'the kitchen and floor' : 'the site'}</small></span></Link>
        <Link to="/home/customise" className="wall-edit">Customise</Link>
      </div>
    </>
  );
}

function WidgetSlot({ id, small }: { id: WidgetId; small: boolean }) {
  return <>{RENDER[id](small)}</>;
}
