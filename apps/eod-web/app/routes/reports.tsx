import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { cashWords, DEFAULT_SETTINGS, formatPounds, MONTH_NAMES, REPORT_DATES, reportsCsv, searchReports, SITES, splitPounds, type ReportDates, type ReportFlag, type ReportHit } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { formatDay } from '../lib/draft';
import { useReportRows } from '../lib/reports';
import { Icon } from '../components/ui';
import { ICONS } from '../components/ui-helpers';
import { WhoMenu } from '../components/home/WhoMenu';
import { HeadOfficeShell } from '../components/HeadOfficeShell';

const FLAGS: { id: ReportFlag; label: string }[] = [
  { id: 'wages', label: `Wages ${DEFAULT_SETTINGS.wageAmberPct}% or more` },
  { id: 'cash', label: 'Cash short or over' },
  { id: 'workbook', label: 'Old workbook' },
];
const PAGE = 60;

/** The sidebar's saved searches, opened as /head-office/reports?saved=… */
const PRESETS: Record<string, { text?: string; dates: ReportDates; flags?: ReportFlag[] }> = {
  wages: { dates: '30D', flags: ['wages'] },
  cash: { dates: '30D', flags: ['cash'] },
  refund: { text: 'refund', dates: 'All' },
};

/** Head office · search every report, from the app and the old workbook, and export the results to Excel. */
export default function Reports() {
  const { user } = useAuth();
  const { rows, example, lastDate } = useReportRows();
  const [text, setText] = useState('');
  const [site, setSite] = useState('all');
  const [dates, setDates] = useState<ReportDates>('30D');
  const [flags, setFlags] = useState<ReportFlag[]>([]);
  const [shown, setShown] = useState(PAGE);
  const [params] = useSearchParams();
  const saved = params.get('saved');
  useEffect(() => {
    const p = saved ? PRESETS[saved] : null;
    if (!p) return;
    setText(p.text ?? ''); setSite('all'); setDates(p.dates); setFlags(p.flags ?? []); setShown(PAGE);
  }, [saved]);

  const result = useMemo(() => searchReports(rows, { text, site, dates, flags }, lastDate), [rows, text, site, dates, flags, lastDate]);
  if (user && !can.seeAllSites(user.role)) return <Navigate to="/" replace />;

  const filter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setShown(PAGE); };
  const toggle = (f: ReportFlag) => filter(setFlags)(flags.includes(f) ? flags.filter((x) => x !== f) : [...flags, f]);
  const reset = () => { setText(''); setSite('all'); setDates('All'); setFlags([]); setShown(PAGE); };

  const [p, d] = splitPounds(result.net);
  const count = result.hits.length;
  const reports = `${count.toLocaleString('en-GB')} ${count === 1 ? 'report' : 'reports'}`;
  const short = result.hits.filter((h) => h.row.cashDiff < 0).length;
  const over = result.hits.filter((h) => h.row.cashDiff > 0).length;
  const wageClass = result.wagePct === null ? '' : result.wagePct > DEFAULT_SETTINGS.wageRedPct ? 'h-bad' : result.wagePct >= DEFAULT_SETTINGS.wageAmberPct ? 'h-warn' : 'h-ok';
  const attention = result.hits.filter((h) => h.wagesHigh || h.cashOff).slice(0, 3);

  // Group the shown rows by month, newest first.
  const groups: { label: string; hits: ReportHit[] }[] = [];
  for (const h of result.hits.slice(0, shown)) {
    const label = `${MONTH_NAMES[+h.row.date.slice(5, 7) - 1]} ${h.row.date.slice(0, 4)}`;
    const g = groups[groups.length - 1];
    if (g?.label === label) g.hits.push(h);
    else groups.push({ label, hits: [h] });
  }

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([reportsCsv(result.hits)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `maginhawa-reports-${site === 'all' ? 'all-sites' : site.toLowerCase()}-${lastDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <HeadOfficeShell>
    <main className="page wide">
      <header className="nav" style={{ paddingLeft: 24 }}>
        <span className="title">Reports</span>
        <WhoMenu />
      </header>
      <div className="body" style={{ paddingTop: 24, gap: 24 }}>
        <div className="titleblock"><span className="eyebrow">Head office · {SITES.length} sites</span><h1>Reports</h1></div>

        <div className="rs-tools">
          <label className="rs-search">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="9" r="5.5" /><path d="M13 13l4 4" /></svg>
            <span className="vh">Search reports</span>
            <input type="search" value={text} onChange={(e) => filter(setText)(e.target.value)} placeholder="Search sites, dates, managers, notes, discounts, voids" />
            {text && <button type="button" className="rs-clear" aria-label="Clear search" onClick={() => filter(setText)('')}><Icon d={ICONS.x} size={12} /></button>}
          </label>
          <div className="rs-filters" role="group" aria-label="Filters">
            <label><span className="vh">Site</span>
              <select className="in rs-sel" value={site} onChange={(e) => filter(setSite)(e.target.value)}>
                <option value="all">All {SITES.length} sites</option>
                {SITES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </label>
            <label><span className="vh">Dates</span>
              <select className="in rs-sel" value={dates} onChange={(e) => filter(setDates)(e.target.value as ReportDates)}>
                {REPORT_DATES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            {FLAGS.map((f) => (
              <button key={f.id} type="button" className="chip" aria-pressed={flags.includes(f.id)} onClick={() => toggle(f.id)}>{f.label}</button>
            ))}
          </div>
        </div>

        <div className="ho-top">
          <div className="hero" role="status" aria-live="polite" aria-atomic="true">
            <span className="hl">Net sales · {reports}</span>
            <div className="big"><b>{p}</b><i>{d}</i></div>
            <div className="hm">
              <span>{result.covers.toLocaleString('en-GB')}<small>Covers</small></span>
              <span className={wageClass}>{result.wagePct === null ? '—' : `${result.wagePct}%`}<small>Wages</small></span>
              <span className={result.flagged ? 'h-warn' : ''}>{result.flagged}<small>To check</small></span>
            </div>
          </div>

          <div className="hero ho-card">
            <span className="hl">Cash</span>
            <span className="ho-v">{cashWords(result.cashDiff)} <small>overall</small></span>
            <span className="hs-small">
              {short || over
                ? <>{short ? <b className="h-bad">{short} {short === 1 ? 'day' : 'days'} short</b> : null}{short && over ? ' · ' : ''}{over ? <b className="h-warn">{over} over</b> : null} out of {count.toLocaleString('en-GB')}</>
                : count ? 'Every day balanced.' : 'No reports to add up.'}
            </span>
          </div>

          <div className="hero ho-card">
            <span className="hl">Needs attention</span>
            {attention.length ? (
              <div className="ho-list">
                {attention.map((h) => (
                  <Link key={h.row.siteCode + h.row.date} to={`/head-office/${h.row.siteCode.toLowerCase()}/${h.row.date}/eod`}>
                    <span className={`dot ${h.wagesHigh && (h.wagePct ?? 0) > DEFAULT_SETTINGS.wageRedPct ? 'bad' : 'warn'}`} />
                    {h.siteName} · {formatDay(h.row.date, { day: 'numeric', month: 'short' })} · {h.wagesHigh ? `wages ${h.wagePct}%` : cashWords(h.row.cashDiff)}
                  </Link>
                ))}
              </div>
            ) : <span className="hs-small">Nothing flagged in these results.</span>}
          </div>
        </div>

        <section className="grp">
          <div className="hd">
            <h2>Results</h2>
            <button type="button" className="chip rs-export" disabled={!count} onClick={exportCsv}>
              <Icon d={ICONS.down} size={16} />Export {reports} to Excel
            </button>
          </div>

          {!count && (
            <div className="rs-empty">
              <b>No reports match</b>
              <span>Try another word, or widen the dates.</span>
              <button type="button" className="linkbtn" onClick={reset}>Clear all filters</button>
            </div>
          )}

          {groups.map((g) => (
            <div className="sub" key={g.label}>
              <div className="rs-month">{g.label}</div>
              {g.hits.map((h) => <ResultRow key={h.row.siteCode + h.row.date} hit={h} />)}
            </div>
          ))}

          {count > shown && (
            <button type="button" className="btn b2" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, count - shown)} more of {(count - shown).toLocaleString('en-GB')}</button>
          )}

          {example && (
            <div className="banner" role="note"><Icon d={ICONS.bang} size={16} /><span>Example data. Every figure, name and note is made up. Days older than eight weeks stand in for the old Excel workbook, which is imported once the app is connected.</span></div>
          )}
        </section>
      </div>
    </main>
    </HeadOfficeShell>
  );
}

function ResultRow({ hit: h }: { hit: ReportHit }) {
  const r = h.row;
  const services = [r.net.lunch && 'Lunch', r.net.dinner && 'dinner', r.net.delivery && 'delivery'].filter(Boolean).join(' + ');
  const pill = h.wagesHigh
    ? <span className={`pill ${(h.wagePct ?? 0) > DEFAULT_SETTINGS.wageRedPct ? 'p-bad' : 'p-warn'}`}>Wages {h.wagePct}%</span>
    : h.cashOff ? <span className={`pill ${r.cashDiff < 0 ? 'p-bad' : 'p-warn'}`}>{cashWords(r.cashDiff)}</span>
    : r.source === 'workbook' ? <span className="pill p-mut">Workbook</span>
    : <span className="pill p-ok">All fine</span>;
  return (
    <Link className="li" to={`/head-office/${r.siteCode.toLowerCase()}/${r.date}/eod`} aria-label={`${h.siteName}, ${formatDay(r.date)}: ${formatPounds(h.net)}`}>
      <span className={`av ${h.wagesHigh || h.cashOff ? 'warn' : ''}`}>{r.siteCode.slice(0, 2)}</span>
      <span className="tx">
        <span>{h.siteName} · {formatDay(r.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
        <small>{services.charAt(0).toUpperCase() + services.slice(1)} · {r.manager ?? 'Manager not recorded'} · {h.covers} covers</small>
        {h.match && <small className="rs-hit">{h.match.field}: “{h.match.before}<mark>{h.match.hit}</mark>{h.match.after}”</small>}
      </span>
      <span className="rs-rt"><b>{formatPounds(h.net)}</b>{pill}</span>
    </Link>
  );
}
