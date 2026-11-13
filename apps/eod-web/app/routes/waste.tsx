/**
 * Log waste (OW3): pick the item; the amount and reason start as what's usual for it, so most waste is two
 * taps. Anyone can log waste; it's valued at cost.
 */
import { useState } from 'react';
import { formatPounds, stepQty, WASTE_REASONS, wasteValue, type WasteReason } from '@maginhawa/core';
import { recordedAs, useAuth } from '../lib/auth';
import { useStock } from '../lib/stock';
import { useOps } from '../lib/ops';
import { Foot, Icon, Nav } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

const COMMON = ['pork', 'rice', 'lumpia', 'prosecco', 'prawns'];

export default function Waste() {
  const { user } = useAuth();
  const { data, siteCode } = useStock();
  const ops = useOps();
  const mine = ops.data.waste.filter((w) => w.siteCode === siteCode).sort((a, b) => b.at.localeCompare(a.at));
  const recent = [...new Set([...mine.map((w) => w.itemId), ...COMMON])].slice(0, 5).filter((id) => data.items.some((i) => i.id === id && i.active));
  const usual = (itemId: string) => {
    const last = mine.find((w) => w.itemId === itemId);
    const it = data.items.find((i) => i.id === itemId);
    return { qty: last?.qty ?? (it?.parts ? 0.5 : 1), reason: (last?.reason ?? 'Out of date') as WasteReason };
  };
  const [itemId, setItemId] = useState(recent[0] ?? data.items[0]!.id);
  const [qty, setQty] = useState(usual(itemId).qty);
  const [reason, setReason] = useState<WasteReason>(usual(itemId).reason);
  const [logged, setLogged] = useState('');
  if (!user) return null;
  const it = data.items.find((i) => i.id === itemId)!;
  const step = it.parts ? 0.5 : 1;
  const cost = it.costPence ?? 0;
  const value = wasteValue(qty, cost);
  const pick = (id: string) => { const u = usual(id); setItemId(id); setQty(u.qty); setReason(u.reason); setLogged(''); };

  return (
    <main className="page">
      <Nav back="/stock" backLabel="Stock" title="Log waste" />
      <div className="body stk-body">
        <div>
          <div className="lab">What</div>
          <div className="chips" role="radiogroup" aria-label="Item">
            {recent.map((id) => <button key={id} type="button" role="radio" aria-checked={id === itemId} className="chip" aria-pressed={id === itemId} onClick={() => pick(id)}>{data.items.find((i) => i.id === id)?.name}</button>)}
            <label className="chip waste-other"><Icon d={ICONS.search} size={15} />
              <select aria-label="Other item" value="" onChange={(e) => e.target.value && pick(e.target.value)}>
                <option value="">Other</option>
                {data.items.filter((i) => i.active && !recent.includes(i.id)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="stk-counter">
          <div className="stk-row">
            <button type="button" className="stk-step" aria-label="Less" onClick={() => { setQty(Math.max(step, stepQty(qty, -step))); setLogged(''); }}><Icon d="M4 9h10" size={22} /></button>
            <span className="stk-num stk-num-show">{qty}</span>
            <button type="button" className="stk-step" aria-label="More" onClick={() => { setQty(stepQty(qty, step)); setLogged(''); }}><Icon d={ICONS.plus} size={22} /></button>
          </div>
          <span className="stk-unit">{it.unit} of {it.name.toLowerCase()}</span>
        </div>

        <div>
          <div className="lab">Why</div>
          <div className="chips" role="radiogroup" aria-label="Why">
            {WASTE_REASONS.map((r) => <button key={r} type="button" role="radio" aria-checked={r === reason} className="chip" aria-pressed={r === reason} onClick={() => { setReason(r); setLogged(''); }}>{r}</button>)}
          </div>
        </div>
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={!!logged} onClick={() => {
          ops.logWaste({ itemId, qty, reason, unitCost: cost, by: recordedAs(user) });
          setLogged(`${qty} ${it.unit} of ${it.name.toLowerCase()}, ${reason.toLowerCase()} · ${formatPounds(value)}`);
        }}>{logged ? 'Logged' : `Log waste · ${formatPounds(value)}`}</button>
        <p className={`note${logged ? ' t-ok' : ''}`} role="status">{logged ? `Logged: ${logged}` : `Filled in from what's usual for ${it.name.toLowerCase()}. Change it if not.`}</p>
      </Foot>
    </main>
  );
}
