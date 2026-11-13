/**
 * Straight after a count is sent (S6-CountToOrder): how many items are low, grouped by supplier, with the
 * orders already filled in. One tap to order; "Not now" goes back to Stock.
 */
import { Link, Navigate, useParams } from 'react-router';
import { formatPounds, itemIdsOf } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { useStock } from '../lib/stock';
import { useOps } from '../lib/ops';
import { suggestions, plural } from '../lib/ops-helpers';
import { hm } from '../lib/food-safety';
import { Foot, Icon, Nav, RowLink } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

export default function StockLow() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { data } = useStock();
  const ops = useOps();
  const count = data.counts.find((c) => c.id === id);
  if (!user || !count) return <Navigate to="/stock" replace />;
  const inCount = new Set(itemIdsOf(count));
  const low = suggestions(data.items, data.counts, ops, count.siteCode).filter((s) => s.packs > 0 && inCount.has(s.item.id));
  if (!low.length) return <Navigate to={`/stock/count/${id}`} replace />;
  const bySupplier = ops.data.suppliers
    .map((sup) => ({ sup, lines: low.filter((l) => l.supplierId === sup.id) }))
    .filter((g) => g.lines.length)
    .sort((a, b) => a.sup.orderBy.localeCompare(b.sup.orderBy));
  const first = bySupplier[0]!;
  const canOrder = can.sendOrders(user.role);

  return (
    <main className="page">
      <Nav back="/stock" backLabel="Stock" title="Count sent" />
      <div className="body">
        <div className="hero stk-hero" role="status">
          <span className="hl">{count.name} sent{count.sentAt ? ` · ${hm(count.sentAt)}` : ''}</span>
          <span className="stk-title">{plural(low.length, 'item is', 'items are')} low</span>
          <span className="stk-sub">Below your usual level. {canOrder ? 'The orders are already filled in.' : 'A supervisor or manager can order them.'}</span>
          {canOrder && (
            <Link className="upnext" to={`/stock/order/${first.sup.id}`}>
              <span className="tx"><b>Order what's low</b></span>
              <span className="arrow"><Icon d={ICONS.arrow} size={16} /></span>
            </Link>
          )}
        </div>

        <section className="grp" aria-label="By supplier">
          <div className="hd"><h2>By supplier</h2><span>Soonest cut-off first</span></div>
          <div className="sub">
            {bySupplier.map(({ sup, lines }) => (
              <RowLink key={sup.id} to={canOrder ? `/stock/order/${sup.id}` : undefined} lead={<span className="av"><Icon d={ICONS.box} /></span>}
                title={sup.name} sub={`${lines.map((l) => l.item.name).join(', ')} · by ${sup.orderBy}`}
                right={<b className="amt">{formatPounds(lines.reduce((n, l) => n + l.packs * l.packPrice, 0))}</b>} />
            ))}
          </div>
          <p className="lead">Low means below the usual level for that item at this site.</p>
        </section>
      </div>
      <Foot><Link className="btn b2" to="/stock">Not now</Link></Foot>
    </main>
  );
}
