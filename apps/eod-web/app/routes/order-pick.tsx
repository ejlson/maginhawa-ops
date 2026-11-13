/**
 * Order: orders sent to the team that still need placing, deliveries to check in, then each supplier with
 * what's already filled in. For now the app doesn't contact suppliers: anyone sends an order to the team,
 * a supervisor or above places it (phone, portal, email) and marks it placed here.
 */
import { cutOffText, formatPounds, orderTotal } from '@maginhawa/core';
import { can, recordedAs, useAuth } from '../lib/auth';
import { useStock } from '../lib/stock';
import { useOps } from '../lib/ops';
import { suggestions } from '../lib/ops-helpers';
import { hm } from '../lib/food-safety';
import { now } from '../lib/clock';
import { Icon, Nav, RowLink } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

export default function OrderPick() {
  const { user } = useAuth();
  const { data, siteCode, item } = useStock();
  const ops = useOps();
  if (!user) return null;
  const sugg = suggestions(data.items, data.counts, ops, siteCode).filter((s) => s.packs > 0);
  const placer = can.placeOrders(user.role);
  const mine = ops.data.orders.filter((o) => o.siteCode === siteCode && o.sentAt);
  const toPlace = mine.filter((o) => !o.placedAt);
  const toCheck = mine.filter((o) => o.placedAt && !o.receivedAt);

  return (
    <main className="page">
      <Nav back="/stock" backLabel="Stock" title="Order" />
      <div className="body">
        <div className="titleblock"><h1>Order</h1><p className="lead">Each order is filled in from your usual levels. Send it to the team and they'll place it with the supplier.</p></div>

        {toPlace.length > 0 && (
          <section className="grp" aria-label="To place">
            <div className="hd"><h2>To place</h2><span>{placer ? 'Order these, then tick them off' : 'The team has these'}</span></div>
            <div className="sub">
              {toPlace.map((o) => {
                const sup = ops.supplier(o.supplierId);
                return (
                  <div className="li" key={o.id}>
                    <span className="av warn"><Icon d={ICONS.box} /></span>
                    <span className="tx">
                      <span>{sup?.name} · {formatPounds(orderTotal(o.lines))}</span>
                      <small>{o.lines.map((l) => `${l.packs} × ${item(l.itemId)?.name ?? l.itemId}`).join(', ')}</small>
                      <small>From {o.sentBy} at {hm(o.sentAt!)} · {sup ? `order by ${sup.orderBy}, ${cutOffText(now(), sup.orderBy).toLowerCase()}` : ''}</small>
                    </span>
                    {placer && <span className="rt"><button type="button" className="chip" aria-label={`Placed with ${sup?.name}`} onClick={() => ops.markPlaced(o.id, recordedAs(user))}>Placed</button></span>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {toCheck.length > 0 && (
          <section className="grp" aria-label="Deliveries to check in">
            <div className="hd"><h2>To check in</h2></div>
            <div className="sub">
              {toCheck.map((o) => <RowLink key={o.id} to={`/stock/delivery/${o.id}`} lead={<span className="av"><Icon d={ICONS.check} /></span>} title={ops.supplier(o.supplierId)?.name ?? 'Delivery'} sub={`${o.lines.length} items · placed by ${o.placedBy}`} />)}
            </div>
          </section>
        )}

        <section className="grp" aria-label="Suppliers">
          <div className="hd"><h2>Suppliers</h2><span>Soonest cut-off first</span></div>
          <div className="sub">
            {[...ops.data.suppliers].sort((a, b) => a.orderBy.localeCompare(b.orderBy)).map((s) => {
              const low = sugg.filter((x) => x.supplierId === s.id);
              return <RowLink key={s.id} to={`/stock/order/${s.id}`} lead={<span className="av"><Icon d={ICONS.box} /></span>}
                title={s.name} sub={`${low.length ? `${low.length} items low` : 'Nothing low'} · ${cutOffText(now(), s.orderBy)}`}
                right={low.length ? <b className="amt">{formatPounds(low.reduce((n, x) => n + x.packs * x.packPrice, 0))}</b> : undefined} />;
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
