/**
 * Head office › Stock (S5-StockHeadOffice): stock on hand from each site's latest full count, which
 * sites are counting, due or late, and the biggest changes from last time. CSV for finance.
 * GP% per period comes with purchases and EOD sales in phase 2 (docs/reports/stock-count-scope.md).
 */
import { Link } from 'react-router';
import { countValue, formatPounds, qtyText, SITES, stockCsv, swings, type StockCount } from '@maginhawa/core';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { WhoMenu } from '../components/home/WhoMenu';
import { SiteMono } from '../lib/site-colours';
import { useStock } from '../lib/stock';
import { useChecklists } from '../lib/checklists';
import { dayText, lastDueDay } from '../lib/stock-helpers';
import { isConnected } from '../lib/config';
import { BigMoney, Icon } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

const siteName = (code: string) => SITES.find((s) => s.code === code)?.name ?? code;

export default function HoStock() {
  const { data, allItems, itemsFor } = useStock();
  const { businessDate: today } = useChecklists();
  const val = (c: StockCount) => countValue(c, allItems).value;

  const rows = SITES.map((s) => {
    const full = data.counts.filter((c) => c.siteCode === s.code && c.kind === 'full').sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const sent = full.filter((c) => c.sentAt);
    const [latest, previous] = sent;
    const open = full.find((c) => !c.sentAt);
    const plan = data.plans.find((p) => p.siteCode === s.code && p.kind === 'full');
    const due = plan ? lastDueDay(plan, today) : null;
    const late = !!due && (!latest || latest.businessDate < due);
    const status = open ? { text: 'Counting now', cls: 'p-mut' }
      : late ? (due === today ? { text: 'Due today', cls: 'p-mut' } : { text: `Late · due ${dayText(due!, today)}`, cls: 'p-warn' })
      : { text: `Sent ${dayText(latest!.businessDate, today)}`, cls: 'p-ok' };
    const change = latest && previous ? val(latest) - val(previous) : null;
    return { site: s, latest, change, status };
  });
  const total = rows.reduce((n, r) => n + (r.latest ? val(r.latest) : 0), 0);
  const big = rows.flatMap((r) => (r.latest ? swings(r.latest, data.counts).map((w) => ({ ...w, count: r.latest! })) : []))
    .map((w) => ({ ...w, diff: Math.round((w.qty - w.last) * (w.count.costs?.[w.itemId] ?? itemsFor(w.count.siteCode).find((i) => i.id === w.itemId)?.costPence ?? 0)) }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  // Items with no cost, counted once however many sites list them; the link opens the first site that has one.
  const uncosted = allItems.filter((i) => i.active && i.costPence === null);
  const noCost = new Set(uncosted.map((i) => i.id)).size;
  const firstNoCostSite = uncosted[0]?.siteCode;
  const latestCounts = rows.flatMap((r) => (r.latest ? [r.latest] : []));

  const exportCsv = () => {
    const csv = stockCsv(latestCounts, allItems, siteName);
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `stock-${today}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch { /* no downloads here (tests, old browsers) */ }
  };

  return (
    <HeadOfficeShell>
      <main className="page wide">
        <header className="nav" style={{ paddingLeft: 24 }}>
          <span className="title">Stock</span>
          <WhoMenu />
        </header>
        <div className="body">
          <div className="stk-hohead">
            <div className="titleblock">
              <span className="eyebrow">Latest full counts · {SITES.length} sites</span>
              <h1>Stock</h1>
            </div>
            <div className="stk-actions">
              <Link className="chip stk-chip" to={`/head-office/stock/items${firstNoCostSite ? `?site=${firstNoCostSite}` : ''}`}>Items and costs{noCost ? ` · ${noCost} no cost` : ''}</Link>
              <button type="button" className="chip" onClick={exportCsv}>Export CSV</button>
            </div>
          </div>

          <div className="hero stk-hero ho-group">
            <span className="hl">Stock on hand · ex VAT</span>
            <BigMoney value={total} />
            <div className="hm">
              <span>{rows.filter((r) => r.status.cls === 'p-ok').length} of {SITES.length}<small>Up to date</small></span>
              <span>{big.filter((b) => !b.okay).length}<small>Changes to ask about</small></span>
              <span>{noCost}<small>Items with no cost</small></span>
            </div>
          </div>

          <div className="stk-cols">
            <section className="grp" aria-label="Sites">
              <div className="hd"><h2>Sites</h2><span>Latest full count</span></div>
              {/* S5's table. Its GP columns wait for purchases and sales (phase 2); the change since last count stands in. */}
              <div className="table">
                <div className="otable stk-table" role="table" aria-label="Sites">
                  <div className="oth" role="row">
                    <span role="columnheader">Site</span><span role="columnheader" className="r">Stock value</span><span role="columnheader" className="r">vs last count</span><span role="columnheader">Count</span>
                  </div>
                  {rows.map((r) => (
                    <div className="otr" role="row" key={r.site.code}>
                      <span role="cell" className="ot-site"><SiteMono code={r.site.code} />
                        <span className="tx"><b>{r.site.name}</b>{r.latest && r.status.cls === 'p-warn' && <small>Last full count {dayText(r.latest.businessDate, today)}</small>}</span></span>
                      <span role="cell" className="r amt">{r.latest ? formatPounds(val(r.latest)) : '—'}</span>
                      <span role="cell" className="r muted">{!r.latest ? 'No count yet' : r.change === null ? 'First count' : r.change === 0 ? 'Same' : `${r.change < 0 ? '−' : '+'}${formatPounds(Math.abs(r.change))}`}</span>
                      <span role="cell"><span className={`pill ${r.status.cls}`}>{r.status.text}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grp" aria-label="Biggest changes">
              <div className="hd"><h2>Biggest changes</h2><span>vs last count</span></div>
              <div className="sub">
                {big.length === 0 && <p className="lead">Nothing unusual in the latest counts.</p>}
                {big.slice(0, 8).map((b) => {
                  const it = itemsFor(b.count.siteCode).find((i) => i.id === b.itemId);
                  return (
                    <div className="li" key={`${b.count.id}-${b.itemId}`}>
                      <SiteMono code={b.count.siteCode} />
                      <span className="tx"><span>{it?.name}</span><small>{qtyText(b.qty, it?.unit ?? '')} · last time {b.last}</small></span>
                      <span className="rt stk-stack">
                        <span className="amt">{formatPounds(Math.abs(b.diff))} {b.diff < 0 ? 'less' : 'more'}</span>
                        <span className={`pill ${b.okay ? 'p-mut' : 'p-warn'}`}>{b.okay ? "Site: it's right" : 'Ask the site'}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="lead">A change is more than half above or below the item's last count.</p>
            </section>
          </div>

          {!isConnected() && <div className="banner" role="note"><Icon d={ICONS.bang} size={16} /><span>Example stock, saved on this device until the app is connected. Names and figures are made up.</span></div>}
        </div>
      </main>
    </HeadOfficeShell>
  );
}
