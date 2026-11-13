/**
 * One stock item (RC3): how long what's left will last at the usual pace, the dishes it's in, and who it's
 * bought from, with Order more.
 */
import { Link, Navigate, useParams } from 'react-router';
import { dailyUse, dishesUsing, formatPounds, priceChangeText, runsOutText } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { useStock } from '../lib/stock';
import { useOps } from '../lib/ops';
import { amountText, onHand } from '../lib/ops-helpers';
import { Icon, Nav, RowLink } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

export default function StockItem() {
  const { item: itemId = '' } = useParams();
  const { user } = useAuth();
  const { data, siteCode, item } = useStock();
  const ops = useOps();
  const it = item(itemId);
  if (!user || !it) return <Navigate to="/stock" replace />;
  const have = onHand(data.counts, siteCode, itemId);
  const perDay = dailyUse(itemId, ops.data.recipes);
  const lasts = have === null ? null : runsOutText(have, perDay);
  const dishes = dishesUsing(itemId, ops.data.recipes);
  const buy = ops.buying(itemId);
  const sup = buy ? ops.supplier(buy.supplierId) : undefined;
  const pc = ops.data.priceChanges.find((p) => p.itemId === itemId && p.status === 'open');

  return (
    <main className="page">
      <Nav back="/stock" backLabel="Stock" title={it.name} />
      <div className="body">
        <div className="hero stk-hero" role="status">
          <span className="hl">{it.name} · {have === null ? 'not counted yet' : `${amountText(have, it.unit)} left (last count)`}</span>
          <span className="stk-title">{lasts ?? (have === null ? 'Count it to see' : 'Not used in a dish')}</span>
          {perDay > 0 && <span className="stk-sub">At the usual pace of about {amountText(Math.round(perDay * 10) / 10, it.unit)} a day</span>}
          {sup && can.sendOrders(user.role) && (
            <Link className="upnext" to={`/stock/order/${sup.id}`}>
              <span className="tx"><b>Order more</b></span>
              <span className="arrow"><Icon d={ICONS.arrow} size={16} /></span>
            </Link>
          )}
        </div>

        {dishes.length > 0 && (
          <section className="grp" aria-label="Used in">
            <div className="hd"><h2>Used in</h2><span>{dishes.length} {dishes.length === 1 ? 'dish' : 'dishes'}</span></div>
            <div className="sub">
              {dishes.map((r) => {
                const line = r.lines.find((l) => l.itemId === itemId)!;
                return <RowLink key={r.id} to={`/recipes/${r.id}`} lead={<span className="av"><Icon d={ICONS.list} /></span>} title={r.name} sub={`${line.shown} a plate · about ${r.perDay} a day`} />;
              })}
            </div>
          </section>
        )}

        {buy && sup && (
          <section className="grp" aria-label="Buying it">
            <div className="hd"><h2>Buying it</h2></div>
            <div className="sub">
              <RowLink lead={<span className="av"><Icon d={ICONS.box} /></span>} title={sup.name}
                sub={`${buy.pack} · ${formatPounds(buy.packPrice)} · order by ${sup.orderBy}`}
                right={pc ? <span className="pill p-warn">{priceChangeText(pc.from, pc.to)} on the last invoice</span> : undefined} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
