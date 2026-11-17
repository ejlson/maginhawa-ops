/**
 * One site's items and costs (each site keeps its own list; docs/reports/per-site-recipes-and-items.md).
 * Used at the site (/stock/items, supervisors and up) and by head office with a site picker. Costs are per
 * unit, ex VAT. A count keeps the costs it was sent with, so a change here only affects counts sent from now on.
 */
import { useState } from 'react';
import { SITES, type Pence } from '@maginhawa/core';
import { useStock } from '../lib/stock';
import { MoneyInput, Toggle } from './ui';

export function ItemsEditor({ siteCode }: { siteCode: string }) {
  const { itemsFor, setItem, addItem } = useStock();
  const items = itemsFor(siteCode);
  const siteName = SITES.find((s) => s.code === siteCode)?.name ?? siteCode;
  const categories = [...new Set(items.map((i) => i.category))];
  const [draft, setDraft] = useState({ name: '', category: categories[0] ?? '', unit: '', parts: false, costPence: null as Pence | null });
  const ready = draft.name.trim().length > 1 && draft.unit.trim().length > 0 && draft.category.trim().length > 0;
  const noCost = items.filter((i) => i.active && i.costPence === null).length;

  return (
    <>
      <p className="lead" style={{ margin: 0 }}>{siteName}'s own list. Cost of one unit, ex VAT. {noCost ? `${noCost} ${noCost === 1 ? 'item has' : 'items have'} no cost yet: they're counted but not valued.` : 'Every item has a cost.'} Changes only affect counts sent from now on.</p>

      {categories.map((cat) => (
        <section className="grp" key={cat} aria-label={cat}>
          <div className="hd"><h2>{cat}</h2></div>
          <div className="sub">
            {items.filter((i) => i.category === cat).map((i) => (
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
            <input className="in wide" list="item-groups" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            <datalist id="item-groups">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label>Counted in<input className="in wide" placeholder="bottles, kg, bags" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} /></label>
          <label>Cost of one, ex VAT<MoneyInput label="Cost of one, ex VAT" value={draft.costPence} onChange={(p) => setDraft({ ...draft, costPence: p })} /></label>
          <span className="stk-toggle"><Toggle label="Part units allowed" checked={draft.parts} onChange={(v) => setDraft({ ...draft, parts: v })} />Part units allowed (like 5.4 bottles)</span>
          <button type="button" className="btn b1 stk-add" disabled={!ready} onClick={() => {
            addItem({ name: draft.name.trim(), category: draft.category.trim(), unit: draft.unit.trim(), parts: draft.parts, costPence: draft.costPence }, siteCode);
            setDraft({ ...draft, name: '', unit: '', costPence: null, parts: false });
          }}>Add item</button>
        </div>
        <p className="note">New items go on {siteName}'s list only, at the end of the areas that hold that group.</p>
      </section>
    </>
  );
}

/** Head office's site picker for per-site lists, kept in the address (?site=). */
export function SitePick({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return (
    <label className="site-pick">
      <span className="vh">Site</span>
      <select className="in" value={value} onChange={(e) => onChange(e.target.value)}>
        {SITES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
      </select>
    </label>
  );
}
