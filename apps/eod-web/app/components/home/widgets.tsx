/**
 * The home screen's widgets (designs W1–W3). Each is a small card with a title, one or two lines that
 * matter now, and a way in. Which ones show, and in what order, is each person's (lib/home-layout.ts).
 */
import { useState, type ReactNode } from 'react';
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
function W({ id, to, meta, children, small }: { id: WidgetId; to?: string; meta?: ReactNode; children: ReactNode; small?: boolean }) {
  const name = WIDGETS[id].name;
  const icon = <span className="wi" aria-hidden="true"><Icon d={WIDGET_ICONS[id]} size={16} /></span>;
  return (
    <section className={`w${WIDGETS[id].wide && !small ? ' wide' : ''}${small ? ' small' : ''}`} aria-label={name} data-widget={id} data-tour={id === 'checklists' ? 'needs' : undefined}>
      <div className="wh">
        <h2>{to ? <Link to={to}>{icon}{name}</Link> : <>{icon}{name}</>}</h2>
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
  const { tasks, scheduled, checksDone } = useToday();
  const { missedYesterday } = useChecklists();
  const rank: Record<string, number> = { late: 0, due: 1, missed: 2, upcoming: 3, anytime: 4 };
  const todo = tasks.filter((t) => !isDone(t) && t.status !== 'anytime')
    .sort((a, b) => (rank[a.status] ?? 5) - (rank[b.status] ?? 5) || (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
  const late = tasks.filter((t) => t.status === 'late').length;
  const missed = tasks.filter((t) => t.status === 'missed').length;
  const yesterday = user && (user.role === 'manager' || user.role === 'headoffice') ? missedYesterday : [];
  if (small) return <Tile id="checklists" to="/checklists" big={checksDone} of={`/ ${scheduled.length}`} label={late ? `${late} late` : missed ? `${missed} missed` : todo[0] ? `Next: ${todo[0].title}` : 'All done'} tone={late ? 'bad' : missed ? 'warn' : undefined} />;
  return (
    <W id="checklists" to="/checklists" meta={late ? <span className="pill p-bad">{late} late</span> : missed ? <span className="pill p-warn">{missed} missed</span> : <Meta>{checksDone} of {scheduled.length} done</Meta>}>
      {todo.length > 0 || yesterday.length > 0 ? (
        <div className="sub">
          {todo.slice(0, 3).map((t) => <TaskRow key={t.key} t={t} me={user?.name} />)}
          {yesterday.length > 0 && (
            <RowLink to="/checklists" lead={<span className="av" aria-hidden="true">{yesterday.length}</span>}
              title={yesterday.length === 1 ? `${yesterday[0]!.title} was missed` : `${yesterday.length} checklists missed`} sub="Yesterday" />
          )}
        </div>
      ) : <p className="wnote">{tasks.length ? 'All done for now.' : 'No checklists today.'}</p>}
      <Link className="wfoot" to="/checklists">{todo.length > 3 ? `${todo.length - 3} more to do` : 'All checklists'}<span>{checksDone} of {scheduled.length} done</span></Link>
    </W>
  );
}

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
          return <Link key={k} to={eod.submitted ? '/close/done' : `/close/${k}`} className="wsec"><Pie status={st} size={18} /><span>{SECTION_LABELS[k]}</span></Link>;
        })}
      </div>
      {eod.issues.length > 0 && <div className="sub"><EodIssueRows issues={eod.issues} /></div>}
      <Link className="wfoot" to={eod.next.to}>{eod.submitted ? 'See the report' : eod.next.text}<span>{formatPounds(eod.result.totalNet)} net</span></Link>
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
    rows.push(<RowLink key="count" to="/stock" lead={<Pie status={open ? 'started' : 'todo'} />} title={focus.plan.name}
      sub={open ? `${Object.keys(open.lines).length} of ${itemIdsOf(open).length} counted` : 'Due today'} right={<span className="chip sm">{open ? 'Carry on' : 'Start'}</span>} />);
  }
  if (low.length) {
    const names = low.slice(0, 2).map((s) => s.item.name).join(', ');
    rows.push(<RowLink key="low" to="/stock/order" lead={<span className="av warn"><Icon d={ICONS.box} /></span>} title={`${low.length} running low`}
      sub={low.length > 2 ? `${names} and ${low.length - 2} more` : names} right={<span className="chip sm">Order</span>} />);
  }
  if (toCheck.length) {
    const o = toCheck[0]!;
    rows.push(<RowLink key="del" to={toCheck.length === 1 ? `/stock/delivery/${o.id}` : '/stock'} lead={<span className="av"><Icon d={ICONS.moped} /></span>}
      title={toCheck.length === 1 ? `Delivery to check · ${ops.supplier(o.supplierId)?.name ?? 'supplier'}` : `${toCheck.length} deliveries to check`} right={<span className="chip sm">Check in</span>} />);
  }
  if (small) {
    const open = focus?.state.kind === 'open' ? focus.state.count : null;
    return open
      ? <Tile id="stock" to="/stock" big={Object.keys(open.lines).length} of={`/ ${itemIdsOf(open).length}`} label={`${focus!.plan.name} counted`} />
      : <Tile id="stock" to="/stock" big={low.length} label={focus ? `${focus.plan.name} due today` : 'Running low'} tone={low.length ? 'warn' : undefined} />;
  }
  return (
    <W id="stock" to="/stock">
      {rows.length ? <div className="sub">{rows}</div> : <p className="wnote">Nothing to count or check in today.</p>}
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
  const { handover, handoverBy, handoverRead } = useSite();
  const eod = useEod();
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
      {write && <Link className="wfoot" to="/close/handover"><Icon d={ICONS.pen} size={16} />Write the handover</Link>}
    </W>
  );
}

function FoodWidget({ small }: { small?: boolean }) {
  const items = useFoodSafetyItems();
  const bad = items.some((i) => i.level === 'bad');
  if (small) return <Tile id="food" to="/food-safety" big={items.length} label={items[0]?.title ?? 'All up to date'} tone={bad ? 'bad' : items.length ? 'warn' : undefined} />;
  const qa: [string, string, string][] = [
    ['Log a temp', '/food-safety/probes', ICONS.thermo], ['Delivery', '/food-safety/deliveries/new', ICONS.moped],
    ['Allergens', '/food-safety/allergens', ICONS.bang], ['Report a problem', '/report', ICONS.wrench],
  ];
  return (
    <W id="food" to="/food-safety" meta={items.length ? <span className={`pill ${bad ? 'p-bad' : 'p-warn'}`}>{items.length} to do</span> : undefined}>
      {items[0] && <p className="wnote wfirst">{items[0].title}</p>}
      <div className="wqa">{qa.map(([l, to, ic]) => <Link key={to} to={to}><span aria-hidden="true"><Icon d={ic} size={16} /></span>{l}</Link>)}</div>
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

/** Smart stack (W8): one thing at a time, most urgent first; swipe for the next. */
function StackWidget() {
  const { user } = useAuth();
  const { at, tasks } = useToday();
  const { open, handover, handoverRead, handoverBy } = useSite();
  const food = useFoodSafetyItems();
  const eod = useEod();
  const cards: { kind: string; title: string; sub: string; to: string; go: string; tone: 'bad' | 'warn' | '' }[] = [];
  // Late before missed: a late list can still be done in its window.
  for (const t of [...tasks.filter((x) => x.status === 'late'), ...tasks.filter((x) => x.status === 'missed')]) cards.push({ kind: 'Checklist', title: t.title, sub: statusPill(t, at).text, to: runPath(t.key), go: 'Start', tone: t.status === 'late' ? 'bad' : 'warn' });
  for (const i of food.filter((x) => x.level === 'bad')) cards.push({ kind: 'Food safety', title: i.title, sub: 'Needs doing now', to: '/food-safety', go: 'Open', tone: 'bad' });
  for (const r of open.filter((x) => x.urgent)) cards.push({ kind: 'Repair', title: r.title, sub: `Urgent · ${r.place}`, to: '/repairs', go: 'Open', tone: 'bad' });
  // EOD issues carry money: only for those who close.
  for (const i of user && canDoEod(user) ? eod.issues : []) cards.push({ kind: 'End of day report', title: i.title, sub: i.detail, to: `/close/${i.section}`, go: 'Fix', tone: i.level === 'block' ? 'bad' : 'warn' });
  if (handover.length && !handoverRead) cards.push({ kind: 'Handover', title: `${handover.length} ${handover.length === 1 ? 'note' : 'notes'} from ${handoverBy ?? 'last night'}`, sub: handover[0]!.body, to: '/handover', go: 'Read', tone: 'warn' });
  for (const t of tasks.filter((x) => x.status === 'due')) cards.push({ kind: 'Checklist', title: t.title, sub: statusPill(t, at).text, to: runPath(t.key), go: 'Start', tone: '' });
  for (const i of food.filter((x) => x.level !== 'bad')) cards.push({ kind: 'Food safety', title: i.title, sub: 'To do today', to: '/food-safety', go: 'Open', tone: '' });
  const [pageRaw, setPage] = useState(0);
  const page = Math.min(pageRaw, Math.max(0, cards.length - 1));
  return (
    <W id="stack" meta={cards.length ? <Meta>{Math.min(page + 1, cards.length)} of {cards.length}</Meta> : undefined}>
      {cards.length ? (
        <>
          <ul className="wstack" aria-label="Most urgent first" onScroll={(e) => { const el = e.currentTarget; setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth + 12))); }}>
            {cards.map((c) => (
              <li key={`${c.kind}|${c.title}|${c.to}`} className={`wstack-c${c.tone ? ` ${c.tone}` : ''}`}>
                <Link to={c.to}>
                  <small>{c.kind}</small>
                  <b>{c.title}</b>
                  <span>{c.sub}</span>
                  <span className="chip sm" aria-hidden="true">{c.go}</span>
                </Link>
              </li>
            ))}
          </ul>
          {cards.length > 1 && <div className="wdots" aria-hidden="true">{cards.slice(0, 8).map((_, i) => <i key={i} className={i === Math.min(page, 7) ? 'on' : ''} />)}</div>}
        </>
      ) : <p className="wnote">Nothing urgent right now.</p>}
    </W>
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
