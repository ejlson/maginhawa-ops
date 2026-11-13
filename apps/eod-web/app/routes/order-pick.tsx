/** Order: pick a supplier. Each shows what's already filled in and when to order by. */
import { formatPounds } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { useStock } from '../lib/stock';
import { useOps } from '../lib/ops';
import { suggestions } from '../lib/ops-helpers';
import { now } from '../lib/clock';
import { cutOffText } from '@maginhawa/core';
import { Icon, Nav, RowLink } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

export default function OrderPick() {
  const { user } = useAuth();
  const { data, siteCode } = useStock();
  const ops = useOps();
  if (!user) return null;
  const sugg = suggestions(data.items, data.counts, ops, siteCode).filter((s) => s.packs > 0);
  const canOrder = can.sendOrders(user.role);
  const waiting = ops.data.orders.filter((o) => o.siteCode === siteCode && o.sentAt && !o.receivedAt);

  return (
    <main className="page">
      <Nav back="/stock" backLabel="Stock" title="Order" />
      <div className="body">
        <div className="titleblock"><h1>Order</h1><p className="lead">{canOrder ? 'Each order is filled in from your usual levels. Change anything, then send.' : 'A supervisor or manager sends orders. You can check deliveries in.'}</p></div>
        {waiting.length > 0 && (
          <section className="grp" aria-label="Deliveries to check in">
            <div className="hd"><h2>To check in</h2></div>
            <div className="sub">
              {waiting.map((o) => <RowLink key={o.id} to={`/stock/delivery/${o.id}`} lead={<span className="av"><Icon d={ICONS.check} /></span>} title={ops.supplier(o.supplierId)?.name ?? 'Delivery'} sub={`${o.lines.length} items · sent by ${o.sentBy}`} />)}
            </div>
          </section>
        )}
        <section className="grp" aria-label="Suppliers">
          <div className="hd"><h2>Suppliers</h2><span>Soonest cut-off first</span></div>
          <div className="sub">
            {[...ops.data.suppliers].sort((a, b) => a.orderBy.localeCompare(b.orderBy)).map((s) => {
              const mine = sugg.filter((x) => x.supplierId === s.id);
              return <RowLink key={s.id} to={canOrder ? `/stock/order/${s.id}` : undefined} lead={<span className="av"><Icon d={ICONS.box} /></span>}
                title={s.name} sub={`${mine.length ? `${mine.length} items low` : 'Nothing low'} · ${cutOffText(now(), s.orderBy)}`}
                right={mine.length ? <b className="amt">{formatPounds(mine.reduce((n, x) => n + x.packs * x.packPrice, 0))}</b> : undefined} />;
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
