/**
 * Tonight at a set of sites (design/redesign-canvas, Option C): head office's Today (every site) and
 * a multi-site manager's "My sites" (just theirs). One tall card with the group figures and the last
 * two weeks against tonight's forecast, a search in the header, then one sortable row per site.
 * Head office clicks a site to see its figures and note and approve or send it back; a manager taps
 * a site to go and work in it.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  cashWords, clockTime, dailyNet, forecastNet, formatPounds, isSyncError, reviewedMessage, siteName, splitPounds,
  type ReportStatus, type Site, type StoredReport,
} from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { formatDay, useDraft } from '../lib/draft';
import { dayCashDiff } from '../lib/day-status';
import { deviceStore } from '../lib/store';
import { showExampleData } from '../lib/config';
import { demoReports } from '../lib/demo';
import { Icon, Nav, RowLink } from './ui';
import { ICONS } from './ui-helpers';
import { TrendChart } from './TrendChart';
import { WhoMenu } from './home/WhoMenu';
import { HeadOfficeShell } from './HeadOfficeShell';
import { HoSearch } from './HoSearch';
import { useTradingHistory } from '../lib/history';
import { PageSkeleton } from './Skeleton';
import { useDelayed } from './skeleton-helpers';
import { colourVars, SiteMono, useSiteColourChoices } from '../lib/site-colours';

type SortKey = 'site' | 'net' | 'forecast' | 'wages' | 'cash';
const SORT_COLS: { key: SortKey; label: string }[] = [
  { key: 'site', label: 'Site' }, { key: 'net', label: 'Net' }, { key: 'forecast', label: 'vs forecast' }, { key: 'wages', label: 'Wages' }, { key: 'cash', label: 'Cash' },
];
interface SiteRow {
  s: Site; r: StoredReport | undefined; o: StoredReport['official'] | undefined; warn: number; statusText: string;
  cashDiff: number | null; vsForecast: number | null; spark: number[];
}
type SiteFilter = 'all' | 'check' | 'waiting' | 'approved';
const SITE_FILTERS: { id: SiteFilter; label: string; test: (x: SiteRow) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'check', label: 'To check', test: (x) => x.warn > 0 || Boolean(x.cashDiff) || x.o?.wageRag === 'red' },
  { id: 'waiting', label: 'Not in yet', test: (x) => !x.r || x.r.status === 'draft' },
  { id: 'approved', label: 'Approved', test: (x) => x.r?.status === 'approved' },
];

export function SitesOverview({ sites, mine = false }: { sites: readonly Site[]; mine?: boolean }) {
  const { user, switchSite } = useAuth();
  const navigate = useNavigate();
  const { draft } = useDraft();
  const { colourOf } = useSiteColourChoices();
  const date = draft.businessDate;
  const codes = useMemo(() => new Set<string>(sites.map((s) => s.code)), [sites]);
  const Shell = mine ? Plain : HeadOfficeShell;
  const [reports, setReports] = useState<StoredReport[] | null>(null);
  // Demo mode fills the other sites with example closes. Reviewing those only changes this screen.
  const demo = showExampleData();
  const [demoStatus, setDemoStatus] = useState<Record<string, ReportStatus>>({});
  const [approveNote, setApproveNote] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = () => void deviceStore().listByDate(date).then((real) => {
    const examples = demo ? demoReports(date, new Set(real.map((r) => r.draft.siteCode))) : [];
    const all = [...real, ...examples.map((r) => (demoStatus[r.draft.siteCode] ? { ...r, status: demoStatus[r.draft.siteCode]! } : r))];
    setReports(all.filter((r) => codes.has(r.draft.siteCode)));
  });
  useEffect(load, [date, demoStatus, codes]); // eslint-disable-line react-hooks/exhaustive-deps
  const isExample = (r: StoredReport) => r.draft.clientId.startsWith('demo-');
  const allHistory = useTradingHistory();
  const history = useMemo(() => ({ ...allHistory, rows: allHistory.rows.filter((r) => codes.has(r.siteCode)) }), [allHistory, codes]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'site', dir: 1 });
  const [siteFilter, setSiteFilter] = useState<SiteFilter>('all');

  // Tonight against forecast v1: the whole group, and each site against its own forecast.
  const tonight = useMemo(() => {
    if (!history.rows.length) return null;
    const groupDaily = dailyNet(history.rows);
    const group = forecastNet(groupDaily)[0];
    const bySite = new Map<string, { forecast: ReturnType<typeof forecastNet>[number] | undefined; last7: number[] }>(sites.map((s) => {
      const daily = dailyNet(history.rows.filter((r) => r.siteCode === s.code));
      return [s.code, { forecast: forecastNet(daily)[0], last7: daily.slice(-7).map((d) => d.value).filter((v): v is number => v !== null) }] as const;
    }));
    const last14 = groupDaily.slice(-14).filter((d): d is { date: string; value: number } => d.value !== null);
    return { group, last14, bySite };
  }, [history.rows, sites]);
  const loading = useDelayed(reports === null);

  // Esc closes the site details.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Keep the sidebar while tonight's reports are read; the skeleton only shows if that takes a moment.
  if (reports === null) return <Shell>{loading && <PageSkeleton wide />}</Shell>;
  const bySite = new Map(reports.map((r) => [r.draft.siteCode, r]));
  const sent = reports.filter((r) => r.status === 'submitted' || r.status === 'approved');
  const net = sent.reduce((s, r) => s + (r.official?.totalNet ?? 0), 0);
  const covers = sent.reduce((s, r) => s + (r.official?.covers ?? 0), 0);
  const wageNet = sent.reduce((s, r) => s + (r.official?.wagePct != null ? r.official.totalNet : 0), 0);
  const groupWages = wageNet ? sent.reduce((s, r) => s + (r.official?.wagePct ?? 0) * (r.official?.wagePct != null ? r.official.totalNet : 0), 0) / wageNet : null;
  const clean = reports.filter((r) => r.status === 'submitted' && !r.issues.some((i) => i.level === 'warn'));
  const toCheck = reports.filter((r) => r.issues.some((i) => i.level === 'warn')).length;
  const [p, d] = splitPounds(net);
  const sentForecast = tonight ? sent.reduce((s, r) => s + (tonight.bySite.get(r.draft.siteCode)?.forecast?.p50 ?? 0), 0) : 0;
  const pace = sentForecast ? net / sentForecast - 1 : null;

  /** Approve or send back. Each change is conditional on the version on this screen; if it changed since, it's skipped and the screen says who. */
  const review = async (list: StoredReport[], status: 'approved' | 'sent-back') => {
    const skipped: string[] = [];
    for (const r of list.filter((r) => !isExample(r))) {
      try {
        await deviceStore().setStatus(r.draft.siteCode, r.draft.businessDate, status, { baseVersion: r.version ?? null, by: user?.name ?? 'Head office' });
      } catch (e) {
        if (!isSyncError(e)) throw e;
        skipped.push(`${siteName(r.draft.siteCode)}: ${e.message}`);
      }
    }
    setApproveNote(skipped.length ? `Not changed, it changed since you looked. ${skipped.join(' · ')}` : null);
    const examples = list.filter(isExample).map((r) => r.draft.siteCode);
    if (examples.length) setDemoStatus((m) => ({ ...m, ...Object.fromEntries(examples.map((c) => [c, status])) }));
    else load();
  };

  const siteRows: SiteRow[] = sites.map((s) => {
    const r = bySite.get(s.code);
    const o = r?.official;
    const warn = r?.issues.filter((i) => i.level === 'warn').length ?? 0;
    const statusText = !r ? 'Not started' : r.status === 'draft' ? 'In progress' : r.status === 'approved' ? 'Approved'
      : r.status === 'sent-back' ? 'Sent back' : warn ? `Submitted · ${warn} to check` : 'Submitted';
    const cashDiff = o ? dayCashDiff(o) : null;
    const f = tonight?.bySite.get(s.code);
    const vsForecast = o && f?.forecast?.p50 ? Math.round((o.totalNet / f.forecast.p50) * 100) : null;
    return { s, r, o, warn, statusText, cashDiff, vsForecast, spark: f?.last7 ?? [] };
  });
  const sortValue = (x: SiteRow): number | string | null => {
    switch (sort.key) {
      case 'site': return x.s.name;
      case 'net': return x.o?.totalNet ?? null;
      case 'forecast': return x.vsForecast;
      case 'wages': return x.o?.wagePct ?? null;
      // Cash sorts by how far out it is, either way.
      case 'cash': return x.cashDiff === null ? null : Math.abs(x.cashDiff);
    }
  };
  const activeFilter = SITE_FILTERS.find((f) => f.id === siteFilter)!;
  const shownRows = siteRows.filter((x) => activeFilter.test(x)).sort((a, b) => {
    const va = sortValue(a), vb = sortValue(b);
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    return (typeof va === 'string' ? va.localeCompare(vb as string) : va - (vb as number)) * sort.dir;
  });
  const openRow = open ? siteRows.find((x) => x.s.code === open) ?? null : null;
  const pickSite = (code: string) => {
    if (mine) { switchSite(code); navigate('/'); } else setOpen(code);
  };

  return (
    <Shell inToday={`${sent.length} of ${sites.length} in`}>
    <main className="page wide ho-page">
      {mine ? <Nav back="/" backLabel={siteName(user?.siteCode ?? '')} title="My sites" right={<WhoMenu />} /> : (
        <header className="nav" style={{ paddingLeft: 24 }}>
          <span className="title">Maginhawa <span className="muted" style={{ fontWeight: 500 }}>Head office</span></span>
          <WhoMenu />
        </header>
      )}
      <div className="body" style={{ paddingTop: 24 }}>
        <div className="ho-head">
          <div className="titleblock"><span className="eyebrow">{formatDay(date)}</span><h1>{mine ? 'My sites' : 'All sites'}</h1></div>
          <div className="ho-head-r">
            <HoSearch sites={siteRows.map((x) => ({ code: x.s.code, name: x.s.name, sub: x.statusText }))} onSite={pickSite} screens={!mine} />
            {!mine && (
              <button type="button" className="btn b1 ho-approve" data-tour="ho-approve" disabled={!clean.length} onClick={() => review(clean, 'approved')}>
                {clean.length ? `Approve ${clean.length} clean ${clean.length === 1 ? 'close' : 'closes'}` : 'Nothing to approve'}
              </button>
            )}
          </div>
        </div>
        {approveNote && <p className="note" role="status">{approveNote}</p>}

        <div className="hero ho-hero" data-tour="ho-hero">
          <div className="ho-hero-l">
            <span className="hl">Tonight · {mine ? 'your sites' : 'group'} net so far</span>
            <div className="big"><b>{p}</b><i>{d}</i></div>
            <span className="hs-small">{sent.length} of {sites.length} {sites.length === 1 ? 'close' : 'closes'} in</span>
            <div className="ho-kpis">
              <span><small>vs forecast</small>{pace === null ? '—' : `${pace >= 0 ? '+' : '−'}${Math.abs(Math.round(pace * 100))}%`}<small>{pace === null ? 'Waiting for the first close' : `for the ${sent.length} in`}</small></span>
              <span><small>Wages</small>{groupWages === null ? '—' : `${groupWages.toFixed(1)}%`}<small>{reports.filter((r) => r.official?.wageRag === 'red').length ? `${reports.filter((r) => r.official?.wageRag === 'red').length} over the red line` : 'Weighted by net'}</small></span>
              <span><small>Covers</small>{covers.toLocaleString('en-GB')}<small>{covers ? `${formatPounds(Math.round(net / covers))} a head` : 'None in yet'}</small></span>
              <span className={toCheck ? 'h-warn' : ''}><small>To check</small>{toCheck}<small>{sites.length - sent.length} still to come</small></span>
            </div>
          </div>
          <GroupChart last14={tonight?.last14 ?? []} forecast={tonight?.group} soFar={net} />
        </div>

        <section id="sites" className="grp anchor" data-tour="ho-sites" style={{ gap: 14 }}>
          <div className="hd ho-tools">
            <div className="chips" role="group" aria-label="Show">
              {SITE_FILTERS.map((f) => {
                const n = siteRows.filter((x) => f.test(x)).length;
                return <button key={f.id} type="button" className="chip" aria-pressed={siteFilter === f.id} onClick={() => setSiteFilter(f.id)}>{f.label} <span className="muted" style={{ fontWeight: 500 }}>{n}</span></button>;
              })}
            </div>
            {!mine && <span>Click a site for its details</span>}
          </div>
          <div className="table stable" role="table" aria-label="Sites">
            <div className="th" role="row">
              {SORT_COLS.map((c) => (
                <span key={c.key} role="columnheader" aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className={`sortbtn ${sort.key === c.key ? 'on' : ''}`} onClick={() => setSort(sort.key === c.key ? { key: c.key, dir: sort.dir === 1 ? -1 : 1 } : { key: c.key, dir: c.key === 'site' ? 1 : -1 })}>
                    {c.label}
                    <svg width="8" height="10" viewBox="0 0 8 10" aria-hidden="true" style={{ transform: sort.key === c.key && sort.dir === 1 ? 'rotate(180deg)' : undefined }}><path d="M1 3.5L4 7l3-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </span>
              ))}
              <span role="columnheader" className="r">Last 7 nights</span>
            </div>
            {shownRows.map((x) => {
              const inner = <SiteCells x={x} colour={colourOf(x.s.code).hex} />;
              return mine
                ? <Link className="sr link" role="row" key={x.s.code} to="/" onClick={() => switchSite(x.s.code)} aria-label={`${x.s.name}: open`}>{inner}</Link>
                : <button type="button" className={`sr link${open === x.s.code ? ' sel' : ''}`} role="row" key={x.s.code} aria-label={`${x.s.name}: details`} aria-expanded={open === x.s.code} onClick={() => setOpen(x.s.code)}>{inner}</button>;
            })}
            {!shownRows.length && <div className="sr" role="row"><span className="muted" style={{ paddingLeft: 46 }}>No sites here right now.</span></div>}
          </div>
          {demo && (
            <div className="banner" role="note"><Icon d={ICONS.bang} size={16} /><span>Example data. Every site except yours shows made-up figures so you can see a busy night. Real closes replace it once the app is connected.</span></div>
          )}
          {!sent.length && !demo && (
            <div className="banner"><Icon d={ICONS.bang} size={16} /><span>No closes yet for this day. In demo mode, this shows reports submitted on this device.</span></div>
          )}
        </section>
        <div id="trends" className="anchor"><TrendChart rows={history.rows} scope={mine ? 'your sites' : 'all sites'} /></div>
        {mine && <p className="note">Head office approves closes and sets which sites you work at.</p>}
        {!mine && <section className="grp">
          <div className="hd"><h2>Set-up</h2></div>
          <div className="sub" style={{ maxWidth: 560 }}>
            <RowLink to="/checklists/edit" lead={<span className="av"><Icon d={ICONS.check} /></span>} title="Checklists" sub="Change the group lists and see every site's own lists" />
            <RowLink to="/food-safety/records" lead={<span className="av"><Icon d={ICONS.list} /></span>} title="Records for an inspector" sub="One PDF for any site and dates" />
            <RowLink to="/food-safety/keep" lead={<span className="av"><Icon d={ICONS.lock} /></span>} title="How long we keep records" sub="Food-safety keep periods" />
          </div>
        </section>}
      </div>

      {openRow && !mine && (
        <SiteDetails x={openRow} colour={colourOf(openRow.s.code)} onClose={() => setOpen(null)}
          onReview={(status) => openRow.r && review([openRow.r], status)} />
      )}
    </main>
    </Shell>
  );
}

/** One site's row: badge and status, net, against forecast, wages, cash and the last week. */
function SiteCells({ x, colour }: { x: SiteRow; colour: string }) {
  const { s, o, warn, statusText, cashDiff, vsForecast, spark } = x;
  return (
    <>
      <span className="st-site">
        <SiteMono code={s.code} />
        <span className="tx"><span>{s.name}</span><small className={warn ? 'warn' : ''}>{statusText}</small></span>
      </span>
      <span className="st-net">{o ? formatPounds(o.totalNet) : '—'}</span>
      <span className="st-fc">{vsForecast === null ? '—' : <>{vsForecast}%<span className="st-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, vsForecast)}%` }} /></span></>}</span>
      <span className={o?.wageRag === 'red' ? 'bad' : o?.wageRag === 'amber' ? 'warn' : ''}>{o?.wagePct != null ? `${o.wagePct}%` : '—'}</span>
      <span>{cashDiff === null ? <span className="muted">—</span> : <span className={`pill ${cashDiff ? 'bad' : 'ok'}`}>{cashWords(cashDiff)}</span>}</span>
      <span className="r"><Spark values={spark} colour={colour} /></span>
    </>
  );
}

function Spark({ values, colour, w = 92, h = 24 }: { values: number[]; colour: string; w?: number; h?: number }) {
  if (values.length < 2) return <span className="muted">—</span>;
  const max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - min) / (max - min || 1)) * (h - 6)).toFixed(1)}`).join(' ');
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Net over the last nights"><polyline points={pts} fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** The last two weeks of group net, then tonight: the forecast range, its middle, and what's in so far. */
function GroupChart({ last14, forecast, soFar }: { last14: { date: string; value: number }[]; forecast: { p10: number | null; p50: number; p90: number | null } | undefined; soFar: number }) {
  if (last14.length < 3) {
    return <div className="ho-chart ho-chart-empty"><span className="hl">Last 2 weeks and tonight</span><span className="hs-small">The chart appears after a few nights of closes.</span></div>;
  }
  const W = 640, H = 190, padT = 14, padB = 14;
  const slots = last14.length + 1;
  const hi = Math.max(...last14.map((d) => d.value), forecast?.p90 ?? forecast?.p50 ?? 0, soFar) * 1.08;
  const x = (i: number) => (i / (slots - 1)) * (W - 24) + 12;
  const y = (v: number) => H - padB - (v / hi) * (H - padT - padB);
  const line = last14.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(last14.length - 1).toFixed(1)},${H - padB} L${x(0).toFixed(1)},${H - padB} Z`;
  const tx = x(slots - 1);
  const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
  return (
    <div className="ho-chart">
      <div className="ho-chart-hd">
        <span>Last 2 weeks and tonight</span>
        <span className="ho-key"><i className="k-line" />Net<i className="k-band" />Tonight's likely range<i className="k-dot" />In so far</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img"
        aria-label={`Group net for the last ${last14.length} nights${forecast ? `, and tonight's forecast of ${formatPounds(Math.round(forecast.p50))}` : ''}, with ${formatPounds(soFar)} in so far`}>
        <defs><linearGradient id="hoArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".3" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={padT + (H - padT - padB) * f} y2={padT + (H - padT - padB) * f} stroke="rgba(255,255,255,.12)" />)}
        <path d={area} fill="url(#hoArea)" className="ho-area" />
        <path d={line} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ho-line" pathLength={1} />
        {forecast?.p10 != null && forecast.p90 != null && (
          <rect x={tx - 12} width="24" y={y(forecast.p90)} height={Math.max(4, y(forecast.p10) - y(forecast.p90))} rx="8" fill="rgba(255,255,255,.2)" />
        )}
        {forecast && <line x1={tx - 14} x2={tx + 14} y1={y(forecast.p50)} y2={y(forecast.p50)} stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeDasharray="4 3" />}
        <circle cx={tx} cy={y(soFar)} r="6" fill="#fff" />
        <circle cx={tx} cy={y(soFar)} r="12" fill="#fff" className="ho-pulse" />
      </svg>
      <div className="ho-chart-x"><span>{day(last14[0]!.date)}</span><span>{day(last14[last14.length - 1]!.date)}</span><b>Tonight</b></div>
    </div>
  );
}

/** A site's details beside the table: figures, the manager's note, and approve or send back. */
function SiteDetails({ x, colour, onClose, onReview }: {
  x: SiteRow; colour: ReturnType<ReturnType<typeof useSiteColourChoices>['colourOf']>;
  onClose: () => void; onReview: (status: 'approved' | 'sent-back') => void;
}) {
  const { s, r, o, statusText, cashDiff, vsForecast, spark } = x;
  const note = r ? [...r.draft.handover, ...r.draft.feedback].map((n) => n.body.trim()).find(Boolean) : undefined;
  // First sends read "Sent by Jo at 23:18"; reviews and re-sends use the shared wording.
  const reviewed = !r || r.status === 'draft' ? statusText
    : r.status === 'submitted' && !r.reviewedAt ? `Sent by ${r.submittedBy ?? 'the manager'}${r.submittedAt ? ` at ${clockTime(r.submittedAt)}` : ''}`
    : reviewedMessage(r);
  const canApprove = r?.status === 'submitted';
  const canSendBack = r?.status === 'submitted' || r?.status === 'approved';
  return (
    <>
      <button type="button" className="ho-back" aria-label="Close details" onClick={onClose} />
      <aside className="ho-panel" role="dialog" aria-label={`${s.name} details`} style={colourVars(colour) as React.CSSProperties}>
        <div className="ho-panel-hd">
          <SiteMono code={s.code} size="lg" />
          <span className="tx"><span>{s.name}</span><small>{reviewed}</small></span>
          <button type="button" className="mini" aria-label="Close" onClick={onClose}><Icon d={ICONS.x} size={16} /></button>
        </div>
        <div className="ho-panel-net">
          <span><small>Net tonight</small><b>{o ? formatPounds(o.totalNet) : '—'}</b></span>
          <Spark values={spark} colour={colour.hex} w={120} h={36} />
        </div>
        <div className="ho-kv">
          <div><span>vs forecast</span><b>{vsForecast === null ? '—' : `${vsForecast}%`}</b></div>
          <div><span>Covers</span><b>{o ? o.covers : '—'}</b></div>
          <div><span>Wages</span><b className={o?.wageRag === 'red' ? 'bad' : o?.wageRag === 'amber' ? 'warn' : ''}>{o?.wagePct != null ? `${o.wagePct}%` : '—'}</b></div>
          <div><span>Cash</span><b className={cashDiff ? 'bad' : ''}>{cashDiff === null ? '—' : cashWords(cashDiff)}</b></div>
          <div><span>Things to check</span><b>{r ? r.issues.filter((i) => i.level === 'warn').length : '—'}</b></div>
        </div>
        <div className="ho-note">
          <span className="sl">Manager's note{r?.submittedBy ? ` · ${r.submittedBy}` : ''}</span>
          <p>{note ?? (r ? 'No note left tonight.' : 'Not started yet.')}</p>
        </div>
        <Link to={`/head-office/${s.code.toLowerCase()}`} className="linkbtn">See {s.name}'s trends</Link>
        <div className="ho-panel-act">
          {canApprove && <button type="button" className="btn b1" onClick={() => onReview('approved')}>{cashDiff ? 'Approve anyway' : 'Approve'}</button>}
          {canSendBack && <button type="button" className="btn ho-sec" onClick={() => onReview('sent-back')}>Send back</button>}
          {!canApprove && !canSendBack && r && <p className="note" style={{ margin: 0 }}>Still being closed. You can review it once it's sent.</p>}
        </div>
      </aside>
    </>
  );
}

/** A manager's frame for My sites: just the page, no head-office sidebar. */
function Plain({ children }: { inToday?: string; children: ReactNode }) {
  return <>{children}</>;
}
