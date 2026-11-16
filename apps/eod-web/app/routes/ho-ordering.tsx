/** Head office › Ordering and waste (OW4): the answer first, then Accept on each new price; waste by site. */
import { Link } from 'react-router';
import { countValue, creditDue, dishCost, dishesUsing, dishGp, formatPounds, orderTotal, priceChangeText, SITES, wasteShare, wasteValue } from '@maginhawa/core';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { WhoMenu } from '../components/home/WhoMenu';
import { SiteMono } from '../lib/site-colours';
import { useOps } from '../lib/ops';
import { useStock } from '../lib/stock';
import { Icon } from '../components/ui';
import { plural, unitOne } from '../lib/ops-helpers';
import { ICONS } from '../components/ui-helpers';

export default function HoOrdering() {
  const ops = useOps();
  const { data, setItem } = useStock();
  const open = ops.data.priceChanges.filter((p) => p.status === 'open');
  const toPlace = ops.data.orders.filter((o) => o.sentAt && !o.placedAt);
  const bought = (code: string) => ops.data.orders.filter((o) => o.siteCode === code && o.sentAt).reduce((n, o) => n + orderTotal(o.lines), 0);
  // Until every order goes through the app, purchases fall back to the value of the latest full count.
  const lastFullValue = (code: string) => {
    const c = data.counts.filter((x) => x.siteCode === code && x.kind === 'full' && x.sentAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    return c ? countValue(c, data.items).value : 0;
  };
  const item = (id: string) => data.items.find((i) => i.id === id);
  const waste = SITES.map((s) => {
    const w = ops.data.waste.filter((x) => x.siteCode === s.code).reduce((n, x) => n + wasteValue(x.qty, x.unitCost), 0);
    const purchases = bought(s.code) || lastFullValue(s.code);
    return { s, w, share: wasteShare(w, purchases) ?? 0 };
  }).sort((a, b) => b.share - a.share);
  const totalWaste = waste.reduce((n, x) => n + x.w, 0);
  const high = waste.filter((x) => x.share >= 3);
  // The reason behind most of the waste at the sites above 3%, by value.
  const byReason = new Map<string, number>();
  for (const x of ops.data.waste) if (high.some((h) => h.s.code === x.siteCode)) byReason.set(x.reason, (byReason.get(x.reason) ?? 0) + wasteValue(x.qty, x.unitCost));
  const mainReason = [...byReason].sort((a, b) => b[1] - a[1])[0]?.[0];
  const sent = ops.data.orders.filter((o) => o.sentAt);
  const boughtAll = sent.reduce((n, o) => n + orderTotal(o.lines), 0);
  const credits = sent.filter((o) => o.receivedAt).reduce((n, o) => n + creditDue(o), 0);
  // Dishes the new invoice price would leave below the GP target (costed at the new price per unit).
  const belowTarget = (itemId: string, supplierId: string, packPrice: number) => {
    const b = ops.data.supplierItems.find((x) => x.itemId === itemId && x.supplierId === supplierId);
    if (!b) return 0;
    const unitCost = Math.round(packPrice / (b?.packSize || 1));
    const items = data.items.map((i) => (i.id === itemId ? { ...i, costPence: unitCost } : i));
    return dishesUsing(itemId, ops.data.recipes).filter((r) => dishGp(r.pricePence, dishCost(r, items)) < ops.data.targetGp).length;
  };
  const perUnit = (itemId: string, supplierId: string, pence: number) => {
    const b = ops.data.supplierItems.find((x) => x.itemId === itemId && x.supplierId === supplierId);
    return b && b.packSize > 1 ? formatPounds(Math.round(pence / b.packSize)) : formatPounds(pence);
  };
  const unitWord = (itemId: string, supplierId: string) => {
    const b = ops.data.supplierItems.find((x) => x.itemId === itemId && x.supplierId === supplierId);
    return b && b.packSize > 1 ? unitOne(item(itemId)?.unit ?? 'pack') : 'pack';
  };
    const accept = (id: string) => ops.settlePrice(id, 'accepted', (itemId, unitCost) => { const it = item(itemId); if (it) setItem({ ...it, costPence: unitCost }); });

  return (
    <HeadOfficeShell>
      <main className="page wide">
        <header className="nav" style={{ paddingLeft: 24 }}><span className="title">Ordering and waste</span><WhoMenu /></header>
        <div className="body" style={{ paddingTop: 24, gap: 28 }}>
          <div className="titleblock"><span className="eyebrow">All sites · so far</span><h1>Ordering and waste</h1></div>
          <div className="hero">
            <span className="hl">So far</span>
            <span className="ho-sentence">{toPlace.length ? `${toPlace.length} order${toPlace.length > 1 ? 's are' : ' is'} waiting to be placed. ` : ''}{open.length ? `${open.length} price${open.length > 1 ? 's' : ''} changed. ` : 'No price changes. '}Waste is {formatPounds(totalWaste)}{high.length ? `, with ${high.length} site${high.length > 1 ? 's' : ''} above 3%` : ''}.</span>
            <div className="hm two"><span>{formatPounds(boughtAll)}<small>Bought, ex VAT</small></span><span>{formatPounds(credits)}<small>Credits to chase</small></span></div>
          </div>
          <div className="stk-cols">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {toPlace.length > 0 && (
              <section className="grp" aria-label="Orders to place">
                <div className="hd"><h2>Orders to place</h2><span>Sent by the sites</span></div>
                <div className="sub">
                  {toPlace.map((o) => (
                    <div className="li" key={o.id}><SiteMono code={o.siteCode} />
                      <span className="tx"><span>{ops.supplier(o.supplierId)?.name} · {formatPounds(orderTotal(o.lines))}</span><small>{plural(o.lines.length, 'item')} · from {o.sentBy}</small></span>
                      <span className="rt"><button type="button" className="chip" onClick={() => ops.markPlaced(o.id, 'Head office')}>Placed</button></span></div>
                  ))}
                </div>
              </section>
            )}
            <section className="grp" aria-label="Price changes">
              <div className="hd"><h2>{open.length ? 'Accept the new prices?' : 'Prices'}</h2><span>From this week's invoices</span></div>
              <div className="sub">
                {open.length === 0 && <p className="lead">Nothing to look at.</p>}
                {open.map((p) => {
                  const it = item(p.itemId);
                  const up = p.to > p.from;
                  return (
                    <div className="li" key={p.id}>
                      <span className="av"><Icon d={ICONS.tag} /></span>
                      <span className="tx"><span>{it?.name} · {ops.supplier(p.supplierId)?.name}</span><small><b className={up ? 't-warn' : 't-ok'}>{priceChangeText(p.from, p.to)}</b> · {perUnit(p.itemId, p.supplierId, p.from)} → {perUnit(p.itemId, p.supplierId, p.to)} a {unitWord(p.itemId, p.supplierId)}
                        {belowTarget(p.itemId, p.supplierId, p.to) > 0 && <> · <Link to="/head-office/menu">{belowTarget(p.itemId, p.supplierId, p.to)} {belowTarget(p.itemId, p.supplierId, p.to) === 1 ? 'dish' : 'dishes'} below target</Link></>}</small></span>
                      <span className="rt ho-price-act">
                        <button type="button" className="btn b1 btn-sm" aria-label={`Accept ${it?.name} price`} onClick={() => accept(p.id)}>Accept</button>
                        <button type="button" className="stk-link" onClick={() => ops.settlePrice(p.id, 'queried', () => {})}>Ask supplier</button></span>
                    </div>
                  );
                })}
              </div>
              <p className="note ord-note">Accepting updates stock values and dish costs from today.</p>
            </section>
            </div>
            <section className="grp" aria-label="Waste by site">
              <div className="hd"><h2>Waste</h2><span>% of what each site bought</span></div>
              {high.length > 0 && <p className="lead" style={{ color: 'var(--text)' }}><b>{high.map((h) => h.s.name).join(' and ')}</b> {high.length > 1 ? 'are' : 'is'} above 3%{mainReason ? `, mostly “${mainReason.toLowerCase()}”` : ''}.</p>}
              <div className="sub">
                {waste.map(({ s, w, share }) => (
                  <div className="li waste-li" key={s.code} title={`${s.name}: ${formatPounds(w)} wasted`}><SiteMono code={s.code} />
                    <span className="ord-bar wide" aria-hidden="true"><span style={{ width: `${Math.min(100, share / 4 * 100)}%` }} className={share >= 3 ? 'low' : ''} /></span>
                    <span className="rt"><span className="vh">{s.name}: {formatPounds(w)},</span><b className={`waste-pct${share >= 3 ? ' t-warn' : ''}`}>{share}%</b></span></div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </HeadOfficeShell>
  );
}
