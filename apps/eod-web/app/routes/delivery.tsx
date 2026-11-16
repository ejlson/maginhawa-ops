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
import { packsText, unitOne } from '../lib/ops-helpers';
import { Foot, Nav } from '../components/ui';

/** OW2's mark: a filled tick when it came, an amber minus when it didn't. */
function Came({ ok }: { ok: boolean }) {
  return (
    <span className={`dl-mark${ok ? '' : ' miss'}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="11" /><path d={ok ? 'M7.5 12.5l3 3 6-6.5' : 'M7.5 12h9'} /></svg>
    </span>
  );
}

/** "Invoice £10.60 a kg, was £9.80": per unit when the pack size is known, else per pack. */
function priceLine(from: number, to: number, packSize?: number, unit?: string) {
  if (!packSize || !unit || packSize === 1) return `Invoice ${formatPounds(to)} a ${unit && packSize === 1 ? unitOne(unit) : 'pack'}, was ${formatPounds(from)}`;
  return `Invoice ${formatPounds(Math.round(to / packSize))} a ${unitOne(unit)}, was ${formatPounds(Math.round(from / packSize))}`;
}

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
      <Nav back="/stock" backLabel="Stock" title="Delivery" />
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
                <button type="button" className="li dl-li" key={l.itemId} aria-pressed={miss} disabled={done}
                  onClick={() => setMissing((m) => ({ ...m, [l.itemId]: m[l.itemId] ? 0 : 1 }))}>
                  <Came ok={!miss} />
                  <span className="tx">
                    <span>{it?.name} · {packsText(l.packs, buy?.pack ?? 'pack')}</span>
                    <small className={miss ? 't-warn' : ''}>{miss ? `One ${packsText(1, buy?.pack ?? 'pack').replace(/^1 /, '')} missing · ${formatPounds(l.packPrice)} credit to chase` : pc ? priceLine(pc.from, pc.to, buy?.packSize, it?.unit) : 'Arrived'}</small>
                  </span>
                  {pc && !miss && <span className="rt"><span className="pill p-warn">{priceChangeText(pc.from, pc.to)}</span></span>}
                </button>
              );
            })}
          </div>
        </section>
      </div>
      <Foot>
        {done ? <Link className="btn b1" to="/stock">Back to Stock</Link>
          : <button type="button" className="btn b1" onClick={() => ops.receiveOrder(order.id, missing, recordedAs(user))}>{nMissing ? `Done · ${nMissing} missing` : 'Done · everything came'}</button>}
        <p className="note">{nMissing ? `We'll chase the ${formatPounds(credit)} credit with ${sup?.name}` : order.lines.some((l) => priceFor(l.itemId)) ? 'The new price goes to head office to accept' : ''}</p>
      </Foot>
    </main>
  );
}
