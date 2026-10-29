import { useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { addDays, clockTime, findSite, SITES, tradingDate, type Repair } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { formatDay, settingsFor } from '../lib/draft';
import { siteDay, type SiteDay } from '../lib/site-timeline';
import { eodPill, eodSubText, taskStatusPill } from '../lib/day-status';
import { useTemplates } from '../lib/templates';
import { showExampleData } from '../lib/config';
import { storage } from '../lib/storage';
import { now } from '../lib/clock';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { WhoMenu } from '../components/home/WhoMenu';
import { Icon } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

type Kind = 'all' | 'checklists' | 'eod';
type Show = 'all' | 'problems' | 'missed' | 'notsent';
const DATES = [
  { id: 'today', label: 'Today', days: 1 },
  { id: 'yesterday', label: 'Yesterday', days: 1 },
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: 'day', label: 'Pick a day', days: 1 },
] as const;
type DateId = (typeof DATES)[number]['id'];
const KINDS: { id: Kind; label: string }[] = [{ id: 'all', label: 'Checklists & EODs' }, { id: 'checklists', label: 'Checklists' }, { id: 'eod', label: 'EODs' }];
const SHOWS: { id: Show; label: string }[] = [{ id: 'all', label: 'Everything' }, { id: 'problems', label: 'Needs a look' }, { id: 'missed', label: 'Missed' }, { id: 'notsent', label: 'EOD not sent' }];
const PAGE = 80;

interface Item {
  id: string;
  date: string;
  siteCode: string;
  siteName: string;
  kind: 'checklist' | 'eod';
  title: string;
  sub: string;
  pill: { text: string; cls: string };
  done: boolean;
  problem: boolean;
  missed: boolean;
  notSent: boolean;
  to: string;
  sort: string;
}

function itemsFor(day: SiteDay, today: string): Item[] {
  const site = findSite(day.siteCode)!;
  const base = `/head-office/${site.code.toLowerCase()}/${day.businessDate}`;
  const out: Item[] = day.tasks
    // Checklists not due yet aren't records yet.
    .filter((t) => t.status !== 'upcoming' && !(t.status === 'anytime' && !t.run?.completedAt))
    .map((t) => ({
      id: `${site.code}|${t.key}`, date: day.businessDate, siteCode: site.code, siteName: site.name, kind: 'checklist' as const, title: t.title,
      sub: t.run?.completedAt ? `${clockTime(t.run.completedAt)} · ${t.run.completedBy}` : t.dueTime ? `Due ${t.dueTime}` : 'When needed',
      pill: taskStatusPill(t.status), done: Boolean(t.run?.completedAt), problem: ['failed', 'missed', 'late'].includes(t.status), missed: t.status === 'missed', notSent: false,
      to: `${base}/checklists/${encodeURIComponent(t.key)}`, sort: t.run?.completedAt ?? t.dueAt?.toISOString() ?? '',
    }));
  const r = day.report;
  // Today's close isn't late until the day is over.
  if (r || day.businessDate < today) {
    const warn = r ? r.issues.some((i) => i.level === 'warn') || r.official?.wageRag === 'red' : false;
    out.push({
      id: `${site.code}|${day.businessDate}|eod`, date: day.businessDate, siteCode: site.code, siteName: site.name, kind: 'eod', title: 'End of day',
      sub: r ? eodSubText(r, day.settings) : 'Nothing sent', pill: r ? eodPill(r) : { text: 'Not sent', cls: 'p-bad' }, done: Boolean(r?.submittedAt),
      problem: !r || r.status === 'draft' || warn, missed: false, notSent: !r || r.status === 'draft',
      to: r ? `${base}/eod` : `/head-office/${site.code.toLowerCase()}?tab=day&date=${day.businessDate}`, sort: r?.submittedAt ?? `${day.businessDate}T23:59`,
    });
  }
  return out;
}

/** Head office · every checklist and EOD across the sites, filtered by site, dates, type and what needs a look. */
export default function HeadOfficeDays() {
  const { user } = useAuth();
  const { records } = useTemplates();
  const [params, setParams] = useSearchParams();
  const site = params.get('site') ?? 'all';
  const dates = (DATES.find((d) => d.id === params.get('dates'))?.id ?? '7d') as DateId;
  const kind = (KINDS.find((k) => k.id === params.get('kind'))?.id ?? 'all') as Kind;
  const show = (SHOWS.find((s) => s.id === params.get('show'))?.id ?? 'all') as Show;
  const [shown, setShown] = useState(PAGE);
  const at = now();
  const today = tradingDate(at, settingsFor(SITES[0]!.code));
  const picked = params.get('day') && /^\d{4}-\d{2}-\d{2}$/.test(params.get('day')!) ? params.get('day')! : today;
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); p.set(k, v); setParams(p, { replace: true }); setShown(PAGE); };

  const last = dates === 'yesterday' ? addDays(today, -1) : dates === 'day' ? picked : today;
  const span = DATES.find((d) => d.id === dates)!.days;
  const example = showExampleData();
  const minute = Math.floor(at.getTime() / 60_000);

  const all = useMemo(() => {
    const repairs = storage.get<Repair[]>('mgh.repairs.v1', []);
    const sites = site === 'all' ? SITES : SITES.filter((s) => s.code === site);
    const items: Item[] = [];
    for (let i = 0; i < span; i++) {
      const date = addDays(last, -i);
      for (const s of sites) items.push(...itemsFor(siteDay(records, s.code, date, now(), example, repairs), today));
    }
    return items;
  }, [records, site, last, span, example, today, minute]); // eslint-disable-line react-hooks/exhaustive-deps

  if (user && !can.seeAllSites(user.role)) return <Navigate to="/" replace />;

  const byKind = all.filter((x) => kind === 'all' || (kind === 'eod' ? x.kind === 'eod' : x.kind === 'checklist'));
  const tests: Record<Show, (x: Item) => boolean> = { all: () => true, problems: (x) => x.problem, missed: (x) => x.missed, notsent: (x) => x.notSent };
  const hits = byKind.filter(tests[show]).sort((a, b) => b.date.localeCompare(a.date) || a.siteName.localeCompare(b.siteName) || (a.kind === b.kind ? a.sort.localeCompare(b.sort) : a.kind === 'eod' ? -1 : 1));

  const checklists = byKind.filter((x) => x.kind === 'checklist');
  const done = checklists.filter((x) => x.done).length;
  const eods = byKind.filter((x) => x.kind === 'eod');

  // Group by day, then by site within it.
  const groups: { date: string; items: Item[] }[] = [];
  for (const h of hits.slice(0, shown)) {
    const g = groups[groups.length - 1];
    if (g?.date === h.date) g.items.push(h);
    else groups.push({ date: h.date, items: [h] });
  }

  return (
    <HeadOfficeShell>
    <main className="page wide">
      <header className="nav" style={{ paddingLeft: 24 }}>
        <span className="title">Checklists &amp; EODs</span>
        <WhoMenu />
      </header>
      <div className="body" style={{ paddingTop: 24, gap: 24 }}>
        <div className="titleblock"><span className="eyebrow">Head office · {SITES.length} sites</span><h1>Checklists &amp; EODs</h1></div>

        <div className="rs-tools">
          <div className="rs-filters" role="group" aria-label="Filters">
            <label><span className="vh">Site</span>
              <select className="in rs-sel" value={site} onChange={(e) => set('site', e.target.value)}>
                <option value="all">All {SITES.length} sites</option>
                {SITES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </label>
            <label><span className="vh">Dates</span>
              <select className="in rs-sel" value={dates} onChange={(e) => set('dates', e.target.value)}>
                {DATES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
            {dates === 'day' && <label><span className="vh">Day</span><input className="in rs-sel" type="date" value={picked} max={today} onChange={(e) => e.target.value && set('day', e.target.value)} /></label>}
            <label><span className="vh">Type</span>
              <select className="in rs-sel" value={kind} onChange={(e) => set('kind', e.target.value)}>
                {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </label>
          </div>
          <div className="chips" role="group" aria-label="Show">
            {SHOWS.map((s) => <button key={s.id} type="button" className="chip" aria-pressed={show === s.id} onClick={() => set('show', s.id)}>{s.label} <span className="muted" style={{ fontWeight: 500 }}>{byKind.filter(tests[s.id]).length}</span></button>)}
          </div>
        </div>

        <div className="hero" role="status" aria-live="polite" style={{ maxWidth: 720 }}>
          <span className="hl">{site === 'all' ? 'All sites' : findSite(site)?.name} · {span === 1 ? formatDay(last) : `${formatDay(addDays(last, 1 - span), { day: 'numeric', month: 'short' })} to ${formatDay(last, { day: 'numeric', month: 'short' })}`}</span>
          <div className="hm">
            <span>{done} of {checklists.length}<small>Checklists done</small></span>
            <span className={checklists.some((x) => x.missed) ? 'h-bad' : ''}>{checklists.filter((x) => x.missed).length}<small>Missed</small></span>
            <span className={eods.some((x) => x.notSent) ? 'h-warn' : ''}>{eods.filter((x) => !x.notSent).length} of {eods.length}<small>EODs sent</small></span>
          </div>
        </div>

        <section className="grp">
          {!hits.length && <div className="rs-empty"><b>Nothing matches</b><span>Try another site, or widen the dates.</span></div>}
          {groups.map((g) => (
            <div className="sub" key={g.date}>
              <div className="rs-month">{formatDay(g.date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              {g.items.map((x) => (
                <Link key={x.id} className="li" to={x.to}>
                  <span className={`av ${x.pill.cls === 'p-bad' ? 'bad' : x.pill.cls === 'p-warn' ? 'warn' : ''}`}><Icon d={x.kind === 'eod' ? ICONS.list : x.missed ? ICONS.bang : ICONS.check} size={16} /></span>
                  <span className="tx"><span>{x.siteName} · {x.title}</span><small>{x.sub}</small></span>
                  <span className="rs-rt"><span className={`pill ${x.pill.cls}`}>{x.pill.text}</span></span>
                </Link>
              ))}
            </div>
          ))}
          {hits.length > shown && <button type="button" className="btn b2" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, hits.length - shown)} more of {(hits.length - shown).toLocaleString('en-GB')}</button>}
          {example && <div className="banner" role="note"><Icon d={ICONS.bang} size={16} /><span>Example data. Checklists, names and figures are made up so you can see a full month.</span></div>}
        </section>
      </div>
    </main>
    </HeadOfficeShell>
  );
}
