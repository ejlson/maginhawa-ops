/**
 * Counting one area, one item at a time (S3-StockCount): the item on the main card, a big number
 * with − and +, and Next. Each figure saves as it's typed. A big change from last time gets one calm
 * line; it never blocks.
 */
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { isSwing, lastQty, parseQty, stepQty } from '@maginhawa/core';
import { recordedAs, useAuth } from '../lib/auth';
import { useStock } from '../lib/stock';
import { Foot, Icon, Nav } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

const show = (n: number | undefined) => (n === undefined ? '' : String(n));

export default function StockArea() {
  const { id = '', area: areaId = '' } = useParams();
  const { user } = useAuth();
  const { data, item, setLine } = useStock();
  const navigate = useNavigate();
  const count = data.counts.find((c) => c.id === id);
  const area = count?.areas.find((a) => a.id === areaId);
  // Start at the first item not counted yet.
  const [i, setI] = useState(() => Math.max(0, area ? area.itemIds.findIndex((x) => !count!.lines[x]) : 0));
  const itemId = area?.itemIds[i] ?? '';
  // What's typed, per item, so a half-typed "5." survives and nothing carries over to the next item.
  const [typed, setTyped] = useState<Record<string, string>>({});
  const text = typed[itemId] ?? show(count?.lines[itemId]?.qty);
  const setText = (t: string) => setTyped((m) => ({ ...m, [itemId]: t }));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, [itemId]);

  if (!user || !count || !area) return <Navigate to={count ? `/stock/count/${id}` : '/stock'} replace />;
  if (count.sentAt) return <Navigate to={`/stock/count/${id}`} replace />;
  const it = item(itemId);
  if (!it) return <Navigate to={`/stock/count/${id}`} replace />;

  const by = recordedAs(user);
  const total = area.itemIds.length;
  const qty = parseQty(text, it.parts);
  const invalid = text.trim() !== '' && qty === null;
  const last = lastQty(data.counts, count.siteCode, itemId, count);
  const swing = qty !== null && isSwing(qty, last);
  const isLast = i === total - 1;
  const one = it.unit.replace(/s$/, '');

  const type = (t: string) => {
    setText(t);
    const q = parseQty(t, it.parts);
    if (t.trim() === '') setLine(count.id, itemId, null, by);
    else if (q !== null) setLine(count.id, itemId, q, by);
  };
  const step = (n: number) => type(String(stepQty(qty ?? 0, n)));
  const next = () => {
    if (isLast) return navigate(count.areas.length === 1 ? `/stock/count/${id}/send` : `/stock/count/${id}`);
    setI(i + 1);
  };

  return (
    <main className="page">
      <Nav back={count.areas.length > 1 ? `/stock/count/${id}` : '/stock'} backLabel={count.areas.length > 1 ? 'Areas' : 'Stock'} title={`${area.name} · ${i + 1} of ${total}`} />
      <div className="body stk-body">
        <div className="stk-segs" role="progressbar" aria-label={`${area.name}: ${area.itemIds.filter((x) => count.lines[x]).length} of ${total} counted`}
          aria-valuemin={0} aria-valuemax={total} aria-valuenow={area.itemIds.filter((x) => count.lines[x]).length}>
          {area.itemIds.map((x, k) => <span key={x} className={count.lines[x] ? 'on' : k === i ? 'here' : ''} />)}
        </div>

        <div className="hero stk-hero stk-item">
          <span className="hl">{area.name}</span>
          <span className="stk-title">{it.name}</span>
        </div>

        <div className="stk-counter">
          <div className="stk-row">
            <button type="button" className="stk-step" aria-label="One less" onClick={() => step(-1)}><Icon d="M4 9h10" size={22} /></button>
            <input key={itemId} ref={input} className={`stk-num${invalid ? ' bad' : ''}`} type="text" inputMode={it.parts ? 'decimal' : 'numeric'} enterKeyHint="next"
              aria-label={`${it.name}, ${it.unit}`} placeholder="0" value={text} autoFocus
              onChange={(e) => type(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } }} />
            <button type="button" className="stk-step" aria-label="One more" onClick={() => step(1)}><Icon d={ICONS.plus} size={22} /></button>
          </div>
          <span className="stk-unit">{it.unit}</span>
          {invalid ? <span className="stk-note bad" role="alert">{it.parts ? 'Up to one decimal place, like 5.4' : `Whole ${it.unit} only`}</span>
            : swing ? <span className="stk-note warn" role="status">Last time it was {last}. Worth a second look.</span>
            : <span className="stk-note">{it.parts ? `Part ${one}? Type it, like 5.4` : ' '}</span>}
        </div>
      </div>
      <Foot>
        <button type="button" className="btn b1" onClick={next}>{isLast ? `Done with ${area.name}` : `Next: ${item(area.itemIds[i + 1]!)?.name ?? ''}`}</button>
        {i > 0 && <button type="button" className="stk-link center" onClick={() => setI(i - 1)}>Back to {item(area.itemIds[i - 1]!)?.name}</button>}
      </Foot>
    </main>
  );
}
