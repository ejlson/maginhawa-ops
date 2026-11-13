/**
 * One stock count. While it's open: the next area on the main card, then every area with its
 * progress circle (S2-StockAreas). Once sent: locked, with what was counted, and corrections for
 * supervisors and above.
 */
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import {
  areaProgress, countValue, formatPounds, itemIdsOf, lineValue, nextArea, parseQty, qtyOf, qtyText, stockCorrectionProblem, swings,
  type StockCount,
} from '@maginhawa/core';
import { can, recordedAs, useAuth } from '../lib/auth';
import { useStock } from '../lib/stock';
import { useChecklists } from '../lib/checklists';
import { dayText, names } from '../lib/stock-helpers';
import { hm } from '../lib/food-safety';
import { Icon, Nav, Pie, RowLink } from '../components/ui';
import { ICONS } from '../components/ui-helpers';
import { BigMoney } from '../components/ui';

export default function StockCountPage() {
  const { id = '' } = useParams();
  const { data } = useStock();
  const count = data.counts.find((c) => c.id === id);
  if (!count) return <Navigate to="/stock" replace />;
  return count.sentAt ? <Sent count={count} /> : <Open count={count} />;
}

function Open({ count }: { count: StockCount }) {
  const areas = areaProgress(count);
  const next = nextArea(count);
  const done = areas.filter((a) => a.status === 'done').length;
  const base = `/stock/count/${count.id}`;

  return (
    <main className="page">
      <Nav back="/stock" backLabel="Stock" title={count.name} />
      <div className="body">
        <div className="titleblock">
          <h1>{count.name}</h1>
          <p className="lead">{areas.length === 1 ? `${areas[0]!.counted} of ${areas[0]!.total} counted` : `${done} of ${areas.length} areas done`}</p>
        </div>

        <div className="hero stk-hero" role="status">
          {next ? (
            <>
              <span className="hl">{next.status === 'started' ? 'Carry on' : 'Next area'}</span>
              <span className="stk-title">{next.name}</span>
              <span className="stk-sub">{next.status === 'started' ? `${next.total - next.counted} of ${next.total} items left` : `${next.total} items`}</span>
              <Link className="upnext" to={`${base}/area/${next.id}`}>
                <span className="tx"><b>{next.status === 'started' ? 'Carry on counting' : 'Start counting'}</b></span>
                <span className="arrow"><Icon d={ICONS.arrow} size={16} /></span>
              </Link>
            </>
          ) : (
            <>
              <span className="hl">Everything counted</span>
              <span className="stk-title">Ready to send</span>
              <span className="stk-sub">{itemIdsOf(count).length} items</span>
              <Link className="upnext" to={`${base}/send`}>
                <span className="tx"><b>Check and send</b></span>
                <span className="arrow"><Icon d={ICONS.arrow} size={16} /></span>
              </Link>
            </>
          )}
        </div>

        <section className="grp" aria-label="Areas">
          <div className="sub">
            {areas.map((a) => (
              <RowLink key={a.id} to={`${base}/area/${a.id}`} lead={<Pie status={a.status} />} title={a.name}
                right={<span className="stk-meta">{a.status === 'done' ? names(a.by) : a.status === 'started' ? `${a.counted} of ${a.total}` : `${a.total} items`}</span>} />
            ))}
          </div>
          {next && done + (areas.some((a) => a.status === 'started') ? 1 : 0) > 0 && (
            <Link to={`${base}/send`} className="stk-link">Check and send</Link>
          )}
        </section>
      </div>
    </main>
  );
}

function Sent({ count }: { count: StockCount }) {
  const { user } = useAuth();
  const { data, item, correct } = useStock();
  const { businessDate } = useChecklists();
  const [fixing, setFixing] = useState<string | null>(null);
  if (!user) return null;
  const seeValue = can.seeStockValue(user.role);
  const { value, noCost } = countValue(count, data.items);
  const big = swings(count, data.counts);
  const cost = (id: string) => (count.costs && id in count.costs ? count.costs[id]! : item(id)?.costPence ?? null);

  return (
    <main className="page">
      <Nav back="/stock" backLabel="Stock" title={count.name} />
      <div className="body">
        <div className="titleblock">
          <h1>{count.name}</h1>
          <p className="lead">{dayText(count.businessDate, businessDate)} · sent at {hm(count.sentAt!)} by {count.sentBy}</p>
        </div>

        <div className="hero stk-hero">
          {seeValue ? (
            <>
              <span className="hl">Worth</span>
              <BigMoney value={value} />
              <div className="hm">
                <span>{itemIdsOf(count).length}<small>Items</small></span>
                <span>{big.length}<small>Big changes</small></span>
                <span>{noCost.length}<small>No cost</small></span>
              </div>
            </>
          ) : (
            <>
              <span className="hl">Sent</span>
              <span className="stk-title">{itemIdsOf(count).length} items counted</span>
            </>
          )}
        </div>

        <p className="stk-lock"><Icon d={ICONS.lock} size={16} />{can.correctStock(user.role) ? 'Locked. A correction keeps the old figure and says why.' : 'Locked. A supervisor or manager can correct a figure.'}</p>

        {count.areas.map((a) => (
          <section className="grp" key={a.id}>
            <div className="hd"><h2>{a.name}</h2><span>{a.itemIds.length} items</span></div>
            <div className="sub">
              {a.itemIds.map((id) => {
                const it = item(id);
                const qty = qtyOf(count, id);
                const fixes = count.corrections.filter((c) => c.itemId === id);
                const lv = qty === null ? null : lineValue(qty, cost(id));
                if (fixing === id) {
                  return <CorrectRow key={id} name={it?.name ?? id} unit={it?.unit ?? ''} parts={!!it?.parts} previous={qty}
                    onCancel={() => setFixing(null)}
                    onSave={(to, reason) => { correct(count.id, id, to, reason, recordedAs(user)); setFixing(null); }} />;
                }
                const last = fixes[fixes.length - 1];
                return (
                  <div className="li" key={id}>
                    <span className="tx">
                      <span>{it?.name ?? id}</span>
                      <small>{qty === null ? 'Not counted' : qtyText(qty, it?.unit ?? '')}{last ? ` · corrected from ${last.from} by ${last.by}: “${last.reason}”` : ''}</small>
                    </span>
                    <span className="rt">
                      {seeValue && <span className="amt">{lv === null ? <span className="pill p-mut">No cost</span> : formatPounds(lv)}</span>}
                      {can.correctStock(user.role) && <button type="button" className="chip" aria-label={`Correct ${it?.name ?? id}`} onClick={() => setFixing(id)}>Correct</button>}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function CorrectRow({ name, unit, parts, previous, onSave, onCancel }: {
  name: string; unit: string; parts: boolean; previous: number | null; onSave: (to: number, reason: string) => void; onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const value = parseQty(text, parts);
  const problem = stockCorrectionProblem({ previous, value, reason });
  return (
    <div className="stk-fix" role="group" aria-label={`Correct ${name}`}>
      <b>{name}</b>
      <small>Now {previous === null ? 'not counted' : qtyText(previous, unit)}</small>
      <label className="stk-fixrow">The right figure, in {unit}
        <input className="in short" inputMode={parts ? 'decimal' : 'numeric'} aria-label={`${name}, right figure`} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <input className="in wide" aria-label="Why it needs correcting" placeholder="Why it needs correcting" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="stk-fixbtns">
        <button type="button" className="chip" onClick={onCancel}>Cancel</button>
        <button type="button" className="chip" aria-pressed="true" disabled={!!problem} onClick={() => value !== null && onSave(value, reason)}>Save correction</button>
      </div>
      {problem && text !== '' && <small className="stk-problem">{problem}</small>}
    </div>
  );
}
