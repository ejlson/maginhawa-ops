/** Head office › Ordering and waste (OW4): the answer first, then Accept on each new price; waste by site. */
import { countValue, formatPounds, orderTotal, priceChangeText, SITES, wasteShare, wasteValue } from '@maginhawa/core';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { WhoMenu } from '../components/home/WhoMenu';
import { SiteMono } from '../lib/site-colours';
import { useOps } from '../lib/ops';
import { useStock } from '../lib/stock';

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
  const waste = SITES.map((s) => {
    const w = ops.data.waste.filter((x) => x.siteCode === s.code).reduce((n, x) => n + wasteValue(x.qty, x.unitCost), 0);
    const purchases = bought(s.code) || lastFullValue(s.code);
    return { s, w, share: wasteShare(w, purchases) ?? 0 };
  }).sort((a, b) => b.share - a.share);
  const totalWaste = waste.reduce((n, x) => n + x.w, 0);
  const high = waste.filter((x) => x.share >= 3);
  const item = (id: string) => data.items.find((i) => i.id === id);
  const accept = (id: string) => ops.settlePrice(id, 'accepted', (itemId, unitCost) => { const it = item(itemId); if (it) setItem({ ...it, costPence: unitCost }); });

  return (
    <HeadOfficeShell>
      <main className="page wide">
        <header className="nav" style={{ paddingLeft: 24 }}><span className="title">Ordering and waste</span><WhoMenu /></header>
        <div className="body" style={{ paddingTop: 24, gap: 28 }}>
          <div className="titleblock"><span className="eyebrow">All sites · this period</span><h1>Ordering and waste</h1></div>
          <div className="hero">
            <span className="hl">This week</span>
            <span className="ho-sentence">{toPlace.length ? `${toPlace.length} order${toPlace.length > 1 ? 's are' : ' is'} waiting to be placed. ` : ''}{open.length ? `${open.length} price${open.length > 1 ? 's' : ''} changed. ` : 'No price changes. '}Waste is {formatPounds(totalWaste)}{high.length ? `, with ${high.length} site${high.length > 1 ? 's' : ''} above 3%` : ''}.</span>
          </div>
          <div className="stk-cols">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {toPlace.length > 0 && (
              <section className="grp" aria-label="Orders to place">
                <div className="hd"><h2>Orders to place</h2><span>Sent by the sites</span></div>
                <div className="sub">
                  {toPlace.map((o) => (
                    <div className="li" key={o.id}><SiteMono code={o.siteCode} />
                      <span className="tx"><span>{ops.supplier(o.supplierId)?.name} · {formatPounds(orderTotal(o.lines))}</span><small>{o.lines.length} items · from {o.sentBy}</small></span>
                      <span className="rt"><button type="button" className="chip" onClick={() => ops.markPlaced(o.id, 'Head office')}>Placed</button></span></div>
                  ))}
                </div>
              </section>
            )}
            <section className="grp" aria-label="Price changes">
              <div className="hd"><h2>{open.length ? 'Accept the new prices?' : 'Prices'}</h2><span>From the invoices</span></div>
              <div className="sub">
                {open.length === 0 && <p className="lead">Nothing to look at.</p>}
                {open.map((p) => {
                  const it = item(p.itemId);
                  const up = p.to > p.from;
                  return (
                    <div className="li" key={p.id}>
                      <span className="tx"><span>{it?.name} · {ops.supplier(p.supplierId)?.name}</span><small>{formatPounds(p.from)} → {formatPounds(p.to)} a pack</small></span>
                      <span className="rt"><span className={`pill ${up ? 'p-warn' : 'p-ok'}`}>{priceChangeText(p.from, p.to)}</span>
                        <button type="button" className="chip" aria-pressed="true" aria-label={`Accept ${it?.name} price`} onClick={() => accept(p.id)}>Accept</button>
                        {up && <button type="button" className="stk-link" onClick={() => ops.settlePrice(p.id, 'queried', () => {})}>Ask supplier</button>}</span>
                    </div>
                  );
                })}
              </div>
              <p className="lead">Accepting updates stock values and dish costs from today. Counts already sent keep their prices.</p>
            </section>
            </div>
            <section className="grp" aria-label="Waste by site">
              <div className="hd"><h2>Waste</h2><span>% of what each site bought</span></div>
              {high.length > 0 && <p className="lead" style={{ color: 'var(--text)' }}><b>{high.map((h) => h.s.name).join(' and ')}</b> {high.length > 1 ? 'are' : 'is'} above 3%.</p>}
              <div className="sub">
                {waste.map(({ s, w, share }) => (
                  <div className="li" key={s.code}><SiteMono code={s.code} />
                    <span className="ord-bar wide" aria-hidden="true"><span style={{ width: `${Math.min(100, share / 4 * 100)}%` }} className={share >= 3 ? 'low' : ''} /></span>
                    <span className="rt"><span className="amt">{formatPounds(w)}</span><span className={`stk-meta${share >= 3 ? ' t-warn' : ''}`}>{share}%</span></span></div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </HeadOfficeShell>
  );
}
