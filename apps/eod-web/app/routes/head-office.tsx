import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { dailyNet, forecastNet, formatPounds, SITES, splitPounds, type StoredReport } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { formatDay, useDraft } from '../lib/draft';
import { deviceStore } from '../lib/store';
import { showExampleData } from '../lib/config';
import { demoReports } from '../lib/demo';
import { Icon, ICONS, RowLink } from '../components/ui';
import { TrendChart } from '../components/TrendChart';
import { WhoMenu } from '../components/home/WhoMenu';
import { useTradingHistory } from '../lib/history';

/** Head office · all sites for the trading day. Approve the clean ones in one go. */
export default function HeadOffice() {
  const { user } = useAuth();
  const { draft } = useDraft();
  const date = draft.businessDate;
  const [reports, setReports] = useState<StoredReport[]>([]);
  // Demo mode fills the other sites with example closes. Approving those only changes this screen.
  const demo = showExampleData();
  const [demoApproved, setDemoApproved] = useState<Set<string>>(new Set());
  const load = () => void deviceStore().listByDate(date).then((real) => {
    const examples = demo ? demoReports(date, new Set(real.map((r) => r.draft.siteCode))) : [];
    setReports([...real, ...examples.map((r) => (demoApproved.has(r.draft.siteCode) ? { ...r, status: 'approved' as const } : r))]);
  });
  useEffect(load, [date, demoApproved]);
  const isExample = (r: StoredReport) => r.draft.clientId.startsWith('demo-');
  const history = useTradingHistory();

  const bySite = new Map(reports.map((r) => [r.draft.siteCode, r]));
  const sent = reports.filter((r) => r.status === 'submitted' || r.status === 'approved');
  const net = sent.reduce((s, r) => s + (r.official?.totalNet ?? 0), 0);
  const covers = sent.reduce((s, r) => s + (r.official?.covers ?? 0), 0);
  const clean = reports.filter((r) => r.status === 'submitted' && !r.issues.some((i) => i.level === 'warn'));
  const [p, d] = splitPounds(net);

  // Tonight against forecast v1: the whole group, and the sites already in against their own forecasts.
  const tonight = useMemo(() => {
    if (!history.rows.length) return null;
    const group = forecastNet(dailyNet(history.rows))[0];
    const bySiteForecast = new Map<string, ReturnType<typeof forecastNet>[number] | undefined>(SITES.map((s) => [s.code, forecastNet(dailyNet(history.rows.filter((r) => r.siteCode === s.code)))[0]]));
    return { group, bySiteForecast };
  }, [history.rows]);
  const sentForecast = tonight ? sent.reduce((s, r) => s + (tonight.bySiteForecast.get(r.draft.siteCode)?.p50 ?? 0), 0) : 0;
  const pace = sentForecast ? net / sentForecast - 1 : null;

  // What head office should look at first, most serious first.
  const attention = reports.flatMap((r) => {
    const o = r.official;
    const site = SITES.find((s) => s.code === r.draft.siteCode)?.name ?? r.draft.siteCode;
    const out: { site: string; code: string; text: string; level: 'bad' | 'warn' }[] = [];
    if (o?.wageRag === 'red') out.push({ site, code: r.draft.siteCode, text: `wages ${o.wagePct}%`, level: 'bad' });
    const cash = o ? (o.sessions.lunch.cash.difference ?? 0) + (o.sessions.dinner.cash.difference ?? 0) : 0;
    if (cash) out.push({ site, code: r.draft.siteCode, text: `${formatPounds(Math.abs(cash))} ${cash < 0 ? 'short' : 'over'}`, level: 'warn' });
    if (r.status === 'draft') out.push({ site, code: r.draft.siteCode, text: 'not sent yet', level: 'warn' });
    return out;
  }).sort((a, b) => (a.level === b.level ? 0 : a.level === 'bad' ? -1 : 1));
  const notStarted = SITES.filter((s) => !bySite.has(s.code));

  const approveClean = async () => {
    for (const r of clean.filter((r) => !isExample(r))) await deviceStore().setStatus(r.draft.siteCode, r.draft.businessDate, 'approved');
    const examples = clean.filter(isExample).map((r) => r.draft.siteCode);
    if (examples.length) setDemoApproved((s) => new Set([...s, ...examples]));
    else load();
  };

  return (
    <main className="page wide">
      <header className="nav" style={{ paddingLeft: 24 }}>
        <span className="title">Maginhawa <span className="muted" style={{ fontWeight: 500 }}>Head office</span></span>
        <WhoMenu />
      </header>
      <div className="body" style={{ paddingTop: 24 }}>
        <div className="titleblock"><span className="eyebrow">{formatDay(date)}</span><h1>All sites</h1></div>
        <div className="ho-top">
          <div className="hero">
            <span className="hl">Tonight · group net · {sent.length} of {SITES.length} sites in</span>
            <div className="big"><b>{p}</b><i>{d}</i></div>
            <div className="segs" aria-hidden="true">{SITES.map((s) => <span key={s.code} className={sent.some((r) => r.draft.siteCode === s.code) ? 'd' : ''} />)}</div>
            <div className="hm">
              <span>{covers}<small>Covers</small></span>
              <span>{SITES.length - sent.length}<small>Still to come</small></span>
              <span className={reports.some((r) => r.issues.some((i) => i.level === 'warn')) ? 'h-warn' : ''}>{reports.filter((r) => r.issues.some((i) => i.level === 'warn')).length}<small>To check</small></span>
            </div>
          </div>

          <div className="hero ho-card">
            <span className="hl">Tonight vs forecast</span>
            {tonight?.group ? (
              <>
                <span className="ho-v">{formatPounds(Math.round(net))} <small>of {formatPounds(Math.round(tonight.group.p50))}</small></span>
                <div className="ho-bar" aria-hidden="true">
                  {tonight.group.p10 !== null && tonight.group.p90 !== null && (
                    <span className="rng" style={{ left: `${Math.min(100, (tonight.group.p10 / (tonight.group.p90 * 1.05)) * 100)}%`, width: `${((tonight.group.p90 - tonight.group.p10) / (tonight.group.p90 * 1.05)) * 100}%` }} />
                  )}
                  <span className="fill" style={{ width: `${Math.min(100, (net / ((tonight.group.p90 ?? tonight.group.p50) * 1.05)) * 100)}%` }} />
                </div>
                <span className="hs-small">
                  {pace === null ? 'Waiting for the first close.' : (
                    <><b className={Math.abs(pace) < 0.05 ? 'h-ok' : pace > 0 ? 'h-ok' : 'h-bad'}>{Math.abs(pace) < 0.05 ? 'On track' : pace > 0 ? 'Ahead' : 'Behind'}</b> · the {sent.length} {sent.length === 1 ? 'site' : 'sites'} in are {Math.abs(Math.round(pace * 100))}% {pace >= 0 ? 'above' : 'below'} their forecast</>
                  )}
                </span>
              </>
            ) : <span className="hs-small">Forecasts appear once there are 3 weeks of closes.</span>}
          </div>

          <div className="hero ho-card">
            <span className="hl">Needs attention</span>
            {attention.length || notStarted.length ? (
              <div className="ho-list">
                {attention.slice(0, 3).map((a) => (
                  <Link key={a.code + a.text} to={`/head-office/${a.code.toLowerCase()}`}><span className={`dot ${a.level}`} />{a.site} · {a.text}</Link>
                ))}
                {attention.length < 3 && notStarted.slice(0, 3 - attention.length).map((s) => (
                  <Link key={s.code} to={`/head-office/${s.code.toLowerCase()}`}><span className="dot" />{s.name} · not started</Link>
                ))}
              </div>
            ) : <span className="hs-small">Nothing to look at. Every close is in and clean.</span>}
          </div>
        </div>
        <TrendChart rows={history.rows} scope="all sites" />
        <section className="grp" style={{ gap: 12 }}>
          <div className="hd">
            <h2>Sites</h2>
            <button type="button" className="chip" style={{ background: clean.length ? 'var(--ink)' : 'var(--fill)', color: clean.length ? 'var(--onink)' : 'var(--sec)' }} disabled={!clean.length} onClick={approveClean}>
              {clean.length ? `Approve ${clean.length} clean ${clean.length === 1 ? 'close' : 'closes'}` : 'Nothing to approve'}
            </button>
          </div>
          <div className="table" role="table" aria-label="Sites">
            <div className="th" role="row"><span>Site</span><span>Net</span><span>Covers</span><span>Wages</span><span>Cash</span></div>
            {SITES.map((s) => {
              const r = bySite.get(s.code);
              const o = r?.official;
              const warn = r?.issues.filter((i) => i.level === 'warn').length ?? 0;
              const statusText = !r ? 'Not started' : r.status === 'draft' ? 'In progress' : r.status === 'approved' ? 'Approved' : warn ? `Submitted · ${warn} to check` : 'Submitted';
              const cashDiff = o ? (o.sessions.lunch.cash.difference ?? 0) + (o.sessions.dinner.cash.difference ?? 0) : null;
              return (
                <Link className="sr link" role="row" key={s.code} to={`/head-office/${s.code.toLowerCase()}`} aria-label={`${s.name}: see trends`}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span className={`av ${warn ? 'warn' : ''}`}>{s.code.slice(0, 2)}</span>
                    <span className="tx"><span style={{ fontWeight: 600 }}>{s.name}</span><small className={warn ? 'warn' : ''}>{statusText}</small></span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{o ? formatPounds(o.totalNet) : '—'}</span>
                  <span>{o ? o.covers : '—'}</span>
                  <span className={o?.wageRag === 'red' ? 'bad' : o?.wageRag === 'amber' ? 'warn' : ''}>{o?.wagePct != null ? `${o.wagePct}%` : '—'}</span>
                  <span className={cashDiff ? 'warn' : ''}>{cashDiff === null ? '—' : cashDiff === 0 ? 'Balanced' : `${formatPounds(Math.abs(cashDiff))} ${cashDiff < 0 ? 'short' : 'over'}`}</span>
                </Link>
              );
            })}
          </div>
          {demo && (
            <div className="banner" role="note"><Icon d={ICONS.bang} size={16} /><span>Example data. Every site except yours shows made-up figures so you can see a busy night. Real closes replace it once the app is connected.</span></div>
          )}
          {!sent.length && !demo && (
            <div className="banner"><Icon d={ICONS.bang} size={16} /><span>No closes yet for this day. In demo mode, this shows reports submitted on this device.</span></div>
          )}
        </section>
        <section className="grp">
          <div className="hd"><h2>Set-up</h2></div>
          <div className="sub" style={{ maxWidth: 560 }}>
            <RowLink to="/checklists/edit" lead={<span className="av"><Icon d={ICONS.check} /></span>} title="Checklists" sub="Change the group lists and see every site's own lists" />
          </div>
        </section>
      </div>
    </main>
  );
}
