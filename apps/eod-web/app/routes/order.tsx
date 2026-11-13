/**
 * One supplier's order (OW1): already filled in from the usual levels, a bar for how much is left, − and +
 * per line, and one button to send. Supervisors and above.
 */
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { addDays, cutOffText, formatPounds, orderTotal } from '@maginhawa/core';
import { recordedAs, useAuth } from '../lib/auth';
import { useStock } from '../lib/stock';
import { useOps } from '../lib/ops';
import { amountText, packsText, suggestions } from '../lib/ops-helpers';
import { useChecklists } from '../lib/checklists';
import { dayText } from '../lib/stock-helpers';
import { now } from '../lib/clock';
import { Foot, Icon, Nav } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

export default function OrderPage() {
  const { supplier: supplierId = '' } = useParams();
  const { user } = useAuth();
  const { data, siteCode } = useStock();
  const ops = useOps();
  const { businessDate } = useChecklists();
  const sup = ops.supplier(supplierId);
  const lines = suggestions(data.items, data.counts, ops, siteCode).filter((s) => s.supplierId === supplierId && s.packs > 0);
  const [packs, setPacks] = useState<Record<string, number>>(() => Object.fromEntries(lines.map((l) => [l.item.id, l.packs])));
  const [sent, setSent] = useState<string | null>(null);
  if (!user || !sup) return <Navigate to="/stock/order" replace />;

  const chosen = lines.map((l) => ({ itemId: l.item.id, packs: packs[l.item.id] ?? 0, packPrice: l.packPrice }));
  const total = orderTotal(chosen);
  const set = (id: string, d: number) => setPacks((p) => ({ ...p, [id]: Math.max(0, (p[id] ?? 0) + d) }));

  return (
    <main className="page">
      <Nav back="/stock/order" backLabel="Order" title={sup.name} />
      <div className="body">
        <div className="hero stk-hero" role="status">
          <span className="hl">Order by {sup.orderBy} · {cutOffText(now(), sup.orderBy)}</span>
          <span className="stk-title">{formatPounds(total)}</span>
          <span className="stk-sub">Arrives {dayText(addDays(businessDate, sup.leadDays), businessDate).toLowerCase()}</span>
        </div>

        {lines.length === 0 ? <p className="lead">Nothing from {sup.name} is below its usual level.</p> : (
          <section className="grp" aria-label="Order lines">
            <div className="hd"><h2>Filled in for you</h2><span>Change anything</span></div>
            <div className="sub">
              {lines.map((l) => {
                const share = l.onHand === null ? 0 : Math.min(1, l.onHand / l.par);
                const n = packs[l.item.id] ?? 0;
                return (
                  <div className="li" key={l.item.id}>
                    <span className="tx">
                      <span>{l.item.name}</span>
                      <small className="ord-left"><span className="ord-bar" aria-hidden="true"><span style={{ width: `${Math.max(4, share * 100)}%` }} className={share < 0.3 ? 'low' : ''} /></span>
                        {l.onHand === null ? 'Not counted yet' : l.onHand === 0 ? 'None left' : `${Number.isInteger(l.onHand) ? l.onHand : l.onHand.toFixed(1)} of ${amountText(l.par, l.item.unit)}`}</small>
                    </span>
                    <span className="rt ord-step">
                      <button type="button" className="stk-step sm" aria-label={`One less of ${l.item.name}`} disabled={!!sent} onClick={() => set(l.item.id, -1)}><Icon d="M4 9h10" size={16} /></button>
                      <b>{packsText(n, l.pack)}</b>
                      <button type="button" className="stk-step sm" aria-label={`One more of ${l.item.name}`} disabled={!!sent} onClick={() => set(l.item.id, 1)}><Icon d={ICONS.plus} size={16} /></button>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
      <Foot>
        {sent ? (
          <>
            <Link className="btn b1" to="/stock">Done</Link>
            <p className="note t-ok">{sup.name} has it. Check it in when it arrives.</p>
          </>
        ) : (
          <>
            <button type="button" className="btn b1" disabled={total <= 0} onClick={() => setSent(ops.sendOrder(sup.id, chosen, recordedAs(user)))}>Send order · {formatPounds(total)}</button>
            <p className="note">{sup.name} gets it by email</p>
          </>
        )}
      </Foot>
    </main>
  );
}
