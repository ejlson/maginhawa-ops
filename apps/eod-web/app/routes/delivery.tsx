/**
 * Check a delivery in (OW2): everything starts ticked; tap only what didn't come. A missing pack becomes a
 * credit to chase; a new price on the invoice goes to head office to accept. Anyone can do this.
 */
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { creditDue, formatPounds, priceChangeText } from '@maginhawa/core';
import { recordedAs, useAuth } from '../lib/auth';
import { useStock } from '../lib/stock';
import { useOps } from '../lib/ops';
import { packsText } from '../lib/ops-helpers';
import { Foot, Nav, Pie } from '../components/ui';

export default function Delivery() {
  const { order: orderId = '' } = useParams();
  const { user } = useAuth();
  const { item } = useStock();
  const ops = useOps();
  const order = ops.data.orders.find((o) => o.id === orderId);
  const [missing, setMissing] = useState<Record<string, number>>({});
  if (!user || !order) return <Navigate to="/stock/order" replace />;
  const sup = ops.supplier(order.supplierId);
  const done = !!order.receivedAt;
  const shown = done ? order.missing : missing;
  const credit = creditDue({ lines: order.lines, missing: shown });
  const nMissing = Object.values(shown).filter(Boolean).length;
  const priceFor = (itemId: string) => ops.data.priceChanges.find((p) => p.itemId === itemId && p.supplierId === order.supplierId && p.status === 'open');

  return (
    <main className="page">
      <Nav back="/stock/order" backLabel="Order" title="Delivery" />
      <div className="body">
        <div className="hero stk-hero" role="status">
          <span className="hl">{sup?.name} · {order.lines.length} items</span>
          <span className="stk-title">{done ? 'Checked in' : 'Anything missing?'}</span>
          <span className="stk-sub">{done ? `By ${order.receivedBy}` : "All ticked. Tap only what didn't come."}</span>
        </div>
        <section className="grp" aria-label="Items">
          <div className="sub">
            {order.lines.map((l) => {
              const it = item(l.itemId);
              const miss = !!shown[l.itemId];
              const pc = priceFor(l.itemId);
              const buy = ops.buying(l.itemId);
              return (
                <button type="button" className="li" key={l.itemId} aria-pressed={miss} disabled={done}
                  onClick={() => setMissing((m) => ({ ...m, [l.itemId]: m[l.itemId] ? 0 : 1 }))}>
                  <Pie status={miss ? 'started' : 'done'} />
                  <span className="tx">
                    <span>{it?.name} · {packsText(l.packs, buy?.pack ?? 'pack')}</span>
                    <small className={miss ? 't-warn' : ''}>{miss ? `One ${packsText(1, buy?.pack ?? 'pack').replace(/^1 /, '')} missing · ${formatPounds(l.packPrice)} credit to chase` : pc ? `Invoice ${formatPounds(pc.to)} a pack, was ${formatPounds(pc.from)}` : 'Arrived'}</small>
                  </span>
                  {pc && !miss && <span className="rt"><span className="pill p-warn">Price {priceChangeText(pc.from, pc.to)}</span></span>}
                </button>
              );
            })}
          </div>
        </section>
      </div>
      <Foot>
        {done ? <Link className="btn b1" to="/stock">Back to Stock</Link>
          : <button type="button" className="btn b1" onClick={() => ops.receiveOrder(order.id, missing, recordedAs(user))}>{nMissing ? `Done · ${nMissing} missing` : 'Done · everything came'}</button>}
        <p className="note">{nMissing ? `We'll chase the ${formatPounds(credit)} credit with ${sup?.name}` : order.lines.some((l) => priceFor(l.itemId)) ? 'The new price goes to head office to accept' : 'Stock goes up when you press Done'}</p>
      </Foot>
    </main>
  );
}
