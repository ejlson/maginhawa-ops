/**
 * Head office › Stock › Items and costs: the group's item list. Costs are per unit, ex VAT. A count
 * keeps the costs it was sent with, so changing one here only affects counts sent from now on.
 */
import { useState } from 'react';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { WhoMenu } from '../components/home/WhoMenu';
import { useStock } from '../lib/stock';
import { MoneyInput, Nav, Toggle } from '../components/ui';
import type { Pence } from '@maginhawa/core';

export default function HoStockItems() {
  const { data, setItem, addItem } = useStock();
  const categories = [...new Set(data.items.map((i) => i.category))];
  const [draft, setDraft] = useState({ name: '', category: categories[0] ?? '', unit: '', parts: false, costPence: null as Pence | null });
  const ready = draft.name.trim().length > 1 && draft.unit.trim().length > 0;
  const noCost = data.items.filter((i) => i.active && i.costPence === null).length;

  return (
    <HeadOfficeShell>
      <main className="page wide">
        <Nav back="/head-office/stock" backLabel="Stock" title="Items and costs" right={<WhoMenu />} />
        <div className="body" style={{ paddingTop: 24, gap: 28 }}>
          <div className="titleblock">
            <h1>Items and costs</h1>
            <p className="lead">Cost of one unit, ex VAT. {noCost ? `${noCost} ${noCost === 1 ? 'item has' : 'items have'} no cost yet: they're counted but not valued.` : 'Every item has a cost.'} Changes only affect counts sent from now on.</p>
          </div>

          {categories.map((cat) => (
            <section className="grp" key={cat}>
              <div className="hd"><h2>{cat}</h2></div>
              <div className="sub">
                {data.items.filter((i) => i.category === cat).map((i) => (
                  <div className="li" key={i.id}>
                    <span className="tx"><span>{i.name}</span><small>Per {i.unit.replace(/s$/, '')}{i.parts ? ' · part units allowed' : ''}{i.active ? '' : ' · not counted'}</small></span>
                    <span className="rt">
                      {i.costPence === null && i.active && <span className="pill p-warn">No cost</span>}
                      <MoneyInput label={`${i.name} cost`} value={i.costPence} onChange={(p) => setItem({ ...i, costPence: p })} />
                      <Toggle label={`Count ${i.name}`} checked={i.active} onChange={(v) => setItem({ ...i, active: v })} />
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="grp" aria-label="Add an item">
            <div className="hd"><h2>Add an item</h2></div>
            <div className="stk-form">
              <label>Name<input className="in wide" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
              <label>Group
                <select className="in wide" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label>Counted in<input className="in wide" placeholder="bottles, kg, bags" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} /></label>
              <label>Cost of one, ex VAT<MoneyInput label="Cost of one, ex VAT" value={draft.costPence} onChange={(p) => setDraft({ ...draft, costPence: p })} /></label>
              <span className="stk-toggle"><Toggle label="Part units allowed" checked={draft.parts} onChange={(v) => setDraft({ ...draft, parts: v })} />Part units allowed (like 5.4 bottles)</span>
              <button type="button" className="btn b1 stk-add" disabled={!ready} onClick={() => {
                addItem({ name: draft.name.trim(), category: draft.category, unit: draft.unit.trim(), parts: draft.parts, costPence: draft.costPence });
                setDraft({ ...draft, name: '', unit: '', costPence: null, parts: false });
              }}>Add item</button>
            </div>
            <p className="lead">New items go on the list for every site. Each site's areas and shelf order are set up with head office for now.</p>
          </section>
        </div>
      </main>
    </HeadOfficeShell>
  );
}
