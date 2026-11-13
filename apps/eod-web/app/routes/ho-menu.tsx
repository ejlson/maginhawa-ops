/**
 * Head office › Menu costing (RC2): only the dishes below target, why, and the fix as one button.
 * The allergen check compares each recipe's ingredients with the dish's allergen record.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { allergenGaps, dishCost, dishGp, formatPounds, priceForTarget } from '@maginhawa/core';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { WhoMenu } from '../components/home/WhoMenu';
import { useOps } from '../lib/ops';
import { useStock } from '../lib/stock';

export default function HoMenu() {
  const ops = useOps();
  const { data } = useStock();
  const target = ops.data.targetGp;
  const dishes = ops.data.recipes.map((r) => { const cost = dishCost(r, data.items); return { r, cost, gp: dishGp(r.pricePence, cost) }; });
  const below = dishes.filter((d) => d.gp < target).sort((a, b) => a.gp - b.gp);
  const fine = dishes.filter((d) => d.gp >= target);
  const [sel, setSel] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const picked = dishes.find((d) => d.r.id === (sel ?? below[0]?.r.id ?? dishes[0]?.r.id));
  const avg = dishes.length ? Math.round(dishes.reduce((n, d) => n + d.gp, 0) / dishes.length * 10) / 10 : 0;
  const gaps = ops.data.recipes.map((r) => ({ r, gaps: allergenGaps(r, data.items) })).filter((x) => x.gaps.length);
  const name = (id: string) => data.items.find((i) => i.id === id)?.name ?? id;
  const why = (d: (typeof dishes)[number]) => {
    const pc = ops.data.priceChanges.find((p) => p.status === 'accepted' && p.to > p.from && d.r.lines.some((l) => l.itemId === p.itemId));
    return pc ? `${name(pc.itemId).split(' ')[0]} went up` : '';
  };
  const fix = picked ? priceForTarget(picked.cost, target) : 0;

  const line = (d: (typeof dishes)[number]) => (
    <button type="button" key={d.r.id} className={`li menu-row${picked?.r.id === d.r.id ? ' on' : ''}`} onClick={() => setSel(d.r.id)} aria-pressed={picked?.r.id === d.r.id}>
      <span className="tx"><span>{d.r.name}</span><small>{d.r.section}{why(d) ? ` · ${why(d)}` : ''}</small></span>
      <span className="rt"><span className="stk-meta">{formatPounds(d.r.pricePence)}</span><span className="stk-meta">cost {formatPounds(d.cost)}</span><b className={`amt${d.gp < target ? ' t-warn' : ''}`}>{d.gp.toFixed(1)}%</b></span>
    </button>
  );

  return (
    <HeadOfficeShell>
      <main className="page wide">
        <header className="nav" style={{ paddingLeft: 24 }}><span className="title">Menu costing</span><WhoMenu /></header>
        <div className="body" style={{ paddingTop: 24, gap: 28 }}>
          <div className="titleblock"><span className="eyebrow">Food menu · prices include 20% VAT · target GP {target}%</span><h1>Menu costing</h1></div>
          <div className="hero">
            <span className="hl">Today's prices</span>
            <span className="ho-sentence">{below.length ? `${below.length} dish${below.length > 1 ? 'es are' : ' is'} below ${target}%.` : `Every dish is at ${target}% or more.`}</span>
            <div className="hm"><span>{avg}%<small>Menu average</small></span><span>{below.length}<small>Below target</small></span><span>{gaps.length}<small>Allergen checks</small></span></div>
          </div>
          <div className="stk-cols">
            <section className="grp" aria-label="Dishes">
              <div className="hd"><h2>{below.length ? 'Below target' : 'Dishes'}</h2><span>Price · cost · GP</span></div>
              <div className="sub">
                {below.map(line)}
                {!showAll ? <button type="button" className="li" onClick={() => setShowAll(true)}><span className="tx"><span>{fine.length} dishes on target</span><small>{fine.slice(0, 3).map((d) => d.r.name).join(', ')} and more</small></span><span className="rt"><span className="stk-meta" style={{ color: 'var(--link)' }}>Show</span></span></button>
                  : fine.map(line)}
              </div>
            </section>
            {picked && (
              <section className="grp menu-panel" aria-label={picked.r.name}>
                <div className="hd"><h2>{picked.r.name}</h2><span className={picked.gp < target ? 't-warn' : ''}>{picked.gp.toFixed(1)}%</span></div>
                <p className="lead">Costs {formatPounds(picked.cost)} to make, sells for {formatPounds(picked.r.pricePence)}</p>
                <div className="sub">
                  {picked.r.lines.map((l) => { const it = data.items.find((i) => i.id === l.itemId); return <div className="li" key={l.itemId}><span className="tx"><span>{it?.name} · {l.shown}</span></span><span className="rt"><span className="amt">{formatPounds(Math.round(l.amount * (it?.costPence ?? 0)))}</span></span></div>; })}
                  {picked.r.extras.map((e) => <div className="li" key={e.label}><span className="tx"><span>{e.label}</span></span><span className="rt"><span className="amt">{formatPounds(e.costPence)}</span></span></div>)}
                </div>
                {picked.gp < target && (
                  <button type="button" className="btn b1" onClick={() => ops.setRecipePrice(picked.r.id, fix)}>Change price to {formatPounds(fix)} · {dishGp(fix, picked.cost).toFixed(1)}%</button>
                )}
              </section>
            )}
          </div>
          {gaps.length > 0 && (
            <section className="grp" aria-label="Allergen check">
              <div className="hd"><h2>Allergen check</h2><span>Recipe ingredients against the allergen record</span></div>
              <div className="sub">
                {gaps.map(({ r, gaps: g }) => <div className="li" key={r.id}><span className="tx"><span>{r.name}</span><small>{g.map((x) => `${name(x.itemId)} contains ${x.allergen.toLowerCase()}`).join('; ')}, but the allergen record doesn't list it</small></span>
                  <span className="rt"><Link className="chip stk-chip" to="/food-safety/allergens">Fix the record</Link></span></div>)}
              </div>
              <p className="lead">The allergen record stays the source of truth: a mismatch is flagged, never changed for you.</p>
            </section>
          )}
        </div>
      </main>
    </HeadOfficeShell>
  );
}
