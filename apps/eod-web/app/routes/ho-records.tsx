/**
 * Head office › Records and exports (EX1): start from who is asking. Each choice lists what's included,
 * the law and the keep period. Inspectors get the existing records pack; the rest download as CSV from
 * what the app holds. Records kept in other tools (payroll, rota, waste notes) are marked as such.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { addMonths, csv, EXPORT_ORDER, EXPORT_RANGES, EXPORTS, formatPounds, orderTotal, SITES, stockCsv, wasteCsv, type ExportFor, type ExportRange } from '@maginhawa/core';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { WhoMenu } from '../components/home/WhoMenu';
import { recordedAs, useAuth } from '../lib/auth';
import { useOps } from '../lib/ops';
import { useStock } from '../lib/stock';
import { useChecklists } from '../lib/checklists';
import { download } from '../lib/ops-helpers';
import { Icon } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

export default function HoRecords() {
  const { user } = useAuth();
  const ops = useOps();
  const stock = useStock();
  const { businessDate: today } = useChecklists();
  const navigate = useNavigate();
  const [kind, setKind] = useState<ExportFor>('inspector');
  const [range, setRange] = useState<ExportRange>('12m');
  const [done, setDone] = useState('');
  // EX1's Sites: all of them, or the ones picked. Nothing picked is the same as all.
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  if (!user) return null;
  const e = EXPORTS[kind];
  const months = EXPORT_RANGES.find((r) => r.id === range)!.months;
  const from = months === null ? '0000' : addMonths(today, -months);
  const siteName = (c: string) => SITES.find((s) => s.code === c)?.name ?? c;
  const itemName = (id: string) => stock.data.items.find((i) => i.id === id)?.name ?? id;
  // Inspector and staff exports don't filter by site. "Everything for one site" is always one site;
  // the others are all sites, or the ones picked (at least one).
  const bySite = kind !== 'inspector' && kind !== 'staff';
  const oneSite = kind === 'site';
  const narrowed = oneSite || picking;
  const inSites = (code: string) => !narrowed || picked.includes(code);
  const sitesText = narrowed ? picked.map((c) => SITES.find((s) => s.code === c)?.name ?? c).join(', ') : `all ${SITES.length} sites`;
  const blocked = bySite && narrowed && picked.length === 0;
  const inRange = (d: string) => d.slice(0, 10) >= from;

  const run = () => {
    if (kind === 'inspector') return navigate('/food-safety/records');
    const files: [string, string][] = [];
    if (kind === 'accountant' || kind === 'site') {
      files.push(['stock-counts', stockCsv(stock.data.counts.filter((c) => c.sentAt && inSites(c.siteCode) && inRange(c.businessDate)), stock.data.items, siteName)]);
      files.push(['waste', wasteCsv(ops.data.waste.filter((w) => inSites(w.siteCode) && inRange(w.at)), itemName, siteName)]);
      files.push(['orders', csv(['Site', 'Sent', 'Supplier', 'Total (£)', 'Received', 'Missing packs'], ops.data.orders.filter((o) => o.sentAt && inSites(o.siteCode) && inRange(o.sentAt)).map((o) =>
        [siteName(o.siteCode), o.sentAt!.slice(0, 10), ops.supplier(o.supplierId)?.name ?? '', (orderTotal(o.lines) / 100).toFixed(2), o.receivedAt?.slice(0, 10) ?? 'Not yet', Object.values(o.missing).reduce((n, x) => n + x, 0)]))]);
    }
    if (kind === 'hse' || kind === 'site') {
      files.push(['accidents', csv(['Site', 'Date', 'Who', 'Name', 'What happened', 'Injury', 'First aid', 'Days off', 'HSE reference'], ops.data.accidents.filter((a) => inSites(a.siteCode) && inRange(a.businessDate)).map((a) =>
        [siteName(a.siteCode), a.businessDate, a.who, a.name, a.what, a.injury, a.firstAid, a.daysOff ?? '', a.hse?.ref ?? '']))]);
      files.push(['safety-checks', csv(['Site', 'Date', 'Check', 'By', 'Result'], ops.data.safetyChecks.filter((c) => inSites(c.siteCode) && inRange(c.businessDate)).map((c) =>
        [siteName(c.siteCode), c.businessDate, c.kind, c.by, c.answers.every((a) => a.yes) ? 'Passed' : 'Failed']))]);
      files.push(['service-visits', csv(['Site', 'Date', 'Service', 'Result', 'Certificate'], ops.data.visits.filter((v) => inSites(ops.data.schedules.find((x) => x.id === v.scheduleId)?.siteCode ?? '') && inRange(v.businessDate)).map((v) => {
        const s = ops.data.schedules.find((x) => x.id === v.scheduleId);
        return [siteName(s?.siteCode ?? ''), v.businessDate, s?.name ?? '', v.result, v.certificate ?? ''];
      }))]);
    }
    if (kind === 'staff') { setDone('Staff and pay records live in your payroll and rota tools. They can be exported here once those are connected.'); return; }
    const text = files.map(([n, body]) => `# ${n}\n${body}`).join('\n\n');
    download(`maginhawa-${kind}-${today}.csv`, text);
    ops.logExport({ by: recordedAs(user), what: `${e.title} · ${sitesText}`, range });
    setDone(`Exported ${files.length} record types for ${sitesText}, ${EXPORT_RANGES.find((r) => r.id === range)!.label.toLowerCase()}. Logged under your name.`);
  };

  return (
    <HeadOfficeShell>
      <main className="page wide">
        <header className="nav" style={{ paddingLeft: 24 }}><span className="title">Records and exports</span><WhoMenu /></header>
        <div className="body" style={{ paddingTop: 24, gap: 28 }}>
          <div className="titleblock"><span className="eyebrow">Head office · all sites</span><h1>Records and exports</h1></div>
          <div>
            <div className="lab">Who is it for?</div>
            <div className="rec-kinds" role="radiogroup" aria-label="Who is it for?">
              {EXPORT_ORDER.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={k === kind} className={`rec-kind${k === kind ? ' on' : ''}`} onClick={() => { setKind(k); setDone(''); if (k === 'site') setPicked((p) => p.slice(0, 1)); }}>
                  <b>{EXPORTS[k].title}</b><span>{EXPORTS[k].sub}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="stk-cols">
            <section className="grp" aria-label="What's included">
              <div className="hd"><h2>What's included</h2><span>And how long we keep it</span></div>
              <div className="sub">
                {e.records.map((r) => <div className="li" key={r.what}><span className="av"><Icon d={ICONS.doc} /></span><span className="tx"><span>{r.what}</span><small>{r.law}{r.inApp ? '' : ' · from another tool'}</small></span><span className="rt"><span className="stk-meta">{r.keep}</span></span></div>)}
              </div>
              <p className="note rec-note">{e.privacy}</p>
            </section>
            <section className="rec-panel" aria-label="Export">
              <div className="lab">Dates</div>
              <div className="chips" role="radiogroup" aria-label="Dates">
                {EXPORT_RANGES.map((r) => <button key={r.id} type="button" role="radio" aria-checked={r.id === range} className="chip sm" aria-pressed={r.id === range} onClick={() => setRange(r.id)}>{r.label}</button>)}
              </div>
              {bySite && <div className="lab">{oneSite ? 'Which site' : 'Sites'}</div>}
              {bySite && !oneSite && (
                <div className="chips" role="radiogroup" aria-label="Sites">
                  <button type="button" role="radio" aria-checked={!picking} className="chip sm" aria-pressed={!picking} onClick={() => setPicking(false)}>All {SITES.length} sites</button>
                  <button type="button" role="radio" aria-checked={picking} className="chip sm" aria-pressed={picking} onClick={() => setPicking(true)}>Pick sites</button>
                </div>
              )}
              {bySite && oneSite && (
                <div className="chips" role="radiogroup" aria-label="Which site">
                  {SITES.map((x) => <button key={x.code} type="button" role="radio" aria-checked={picked[0] === x.code} className="chip sm" aria-pressed={picked[0] === x.code} onClick={() => setPicked([x.code])}>{x.name}</button>)}
                </div>
              )}
              {bySite && !oneSite && picking && (
                <div className="chips" role="group" aria-label="Which sites">
                  {SITES.map((x) => {
                    const on = picked.includes(x.code);
                    return <button key={x.code} type="button" className="chip sm" aria-pressed={on} onClick={() => setPicked((p) => on ? p.filter((c) => c !== x.code) : [...p, x.code])}>{x.name}</button>;
                  })}
                </div>
              )}
              <div className="lab">You'll get</div>
              <p style={{ margin: 0 }}>{e.format}</p>
              <button type="button" className="btn b1" disabled={blocked} onClick={run}>Export</button>
              {blocked && <p className="note t-warn">{oneSite ? 'Pick the site first.' : 'Pick at least one site.'}</p>}
              <p className="note">{kind === 'inspector' ? 'Opens the records pack for the inspector, ready to print.' : 'Downloads to this computer for now. Once connected, it saves to the Exports folder in SharePoint, with a link you can share that expires.'}</p>
              {done && <p className="note" role="status">{done}</p>}
              {ops.data.exportsLog.length > 0 && <p className="note">Last export: {ops.data.exportsLog[ops.data.exportsLog.length - 1]!.what} by {ops.data.exportsLog[ops.data.exportsLog.length - 1]!.by}</p>}
            </section>
          </div>
        </div>
      </main>
    </HeadOfficeShell>
  );
}
