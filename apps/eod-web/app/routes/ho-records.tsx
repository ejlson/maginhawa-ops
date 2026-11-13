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

export default function HoRecords() {
  const { user } = useAuth();
  const ops = useOps();
  const stock = useStock();
  const { businessDate: today } = useChecklists();
  const navigate = useNavigate();
  const [kind, setKind] = useState<ExportFor>('inspector');
  const [range, setRange] = useState<ExportRange>('12m');
  const [done, setDone] = useState('');
  if (!user) return null;
  const e = EXPORTS[kind];
  const months = EXPORT_RANGES.find((r) => r.id === range)!.months;
  const from = months === null ? '0000' : addMonths(today, -months);
  const siteName = (c: string) => SITES.find((s) => s.code === c)?.name ?? c;
  const itemName = (id: string) => stock.data.items.find((i) => i.id === id)?.name ?? id;
  const inRange = (d: string) => d.slice(0, 10) >= from;

  const run = () => {
    if (kind === 'inspector') return navigate('/food-safety/records');
    const files: [string, string][] = [];
    if (kind === 'accountant' || kind === 'site') {
      files.push(['stock-counts', stockCsv(stock.data.counts.filter((c) => c.sentAt && inRange(c.businessDate)), stock.data.items, siteName)]);
      files.push(['waste', wasteCsv(ops.data.waste.filter((w) => inRange(w.at)), itemName, siteName)]);
      files.push(['orders', csv(['Site', 'Sent', 'Supplier', 'Total (£)', 'Received', 'Missing packs'], ops.data.orders.filter((o) => o.sentAt && inRange(o.sentAt)).map((o) =>
        [siteName(o.siteCode), o.sentAt!.slice(0, 10), ops.supplier(o.supplierId)?.name ?? '', (orderTotal(o.lines) / 100).toFixed(2), o.receivedAt?.slice(0, 10) ?? 'Not yet', Object.values(o.missing).reduce((n, x) => n + x, 0)]))]);
    }
    if (kind === 'hse' || kind === 'site') {
      files.push(['accidents', csv(['Site', 'Date', 'Who', 'Name', 'What happened', 'Injury', 'First aid', 'Days off', 'HSE reference'], ops.data.accidents.filter((a) => inRange(a.businessDate)).map((a) =>
        [siteName(a.siteCode), a.businessDate, a.who, a.name, a.what, a.injury, a.firstAid, a.daysOff ?? '', a.hse?.ref ?? '']))]);
      files.push(['safety-checks', csv(['Site', 'Date', 'Check', 'By', 'Result'], ops.data.safetyChecks.filter((c) => inRange(c.businessDate)).map((c) =>
        [siteName(c.siteCode), c.businessDate, c.kind, c.by, c.answers.every((a) => a.yes) ? 'Passed' : 'Failed']))]);
      files.push(['service-visits', csv(['Site', 'Date', 'Service', 'Result', 'Certificate'], ops.data.visits.filter((v) => inRange(v.businessDate)).map((v) => {
        const s = ops.data.schedules.find((x) => x.id === v.scheduleId);
        return [siteName(s?.siteCode ?? ''), v.businessDate, s?.name ?? '', v.result, v.certificate ?? ''];
      }))]);
    }
    if (kind === 'staff') { setDone('Staff and pay records live in your payroll and rota tools. They can be exported here once those are connected.'); return; }
    const text = files.map(([n, body]) => `# ${n}\n${body}`).join('\n\n');
    download(`maginhawa-${kind}-${today}.csv`, text);
    ops.logExport({ by: recordedAs(user), what: e.title, range });
    setDone(`Exported ${files.length} record types, ${EXPORT_RANGES.find((r) => r.id === range)!.label.toLowerCase()}. Logged under your name.`);
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
                <button key={k} type="button" role="radio" aria-checked={k === kind} className={`rec-kind${k === kind ? ' on' : ''}`} onClick={() => { setKind(k); setDone(''); }}>
                  <b>{EXPORTS[k].title}</b><span>{EXPORTS[k].sub}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="stk-cols">
            <section className="grp" aria-label="What's included">
              <div className="hd"><h2>What's included</h2><span>And how long we keep it</span></div>
              <div className="sub">
                {e.records.map((r) => <div className="li" key={r.what}><span className="tx"><span>{r.what}</span><small>{r.law}{r.inApp ? '' : ' · from another tool'}</small></span><span className="rt"><span className="stk-meta">{r.keep}</span></span></div>)}
              </div>
              <p className="lead">{e.privacy}</p>
            </section>
            <section className="grp rec-panel" aria-label="Export">
              <div className="lab">Dates</div>
              <div className="chips" role="radiogroup" aria-label="Dates">
                {EXPORT_RANGES.map((r) => <button key={r.id} type="button" role="radio" aria-checked={r.id === range} className="chip" aria-pressed={r.id === range} onClick={() => setRange(r.id)}>{r.label}</button>)}
              </div>
              <div className="lab">You'll get</div>
              <p style={{ margin: 0 }}>{e.format}</p>
              <button type="button" className="btn b1" onClick={run}>{kind === 'inspector' ? 'Make the records pack' : 'Export'}</button>
              {done && <p className="note" role="status">{done}</p>}
              {ops.data.exportsLog.length > 0 && <p className="lead">Last export: {ops.data.exportsLog[ops.data.exportsLog.length - 1]!.what} by {ops.data.exportsLog[ops.data.exportsLog.length - 1]!.by}</p>}
            </section>
          </div>
        </div>
      </main>
    </HeadOfficeShell>
  );
}
