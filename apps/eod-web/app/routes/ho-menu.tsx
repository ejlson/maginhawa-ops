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
import { Chevron, Icon } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

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

  // RC2's table: Dish · Price · Cost · GP · why. A row is a button that opens the dish on the right.
  const line = (d: (typeof dishes)[number]) => (
    <button type="button" key={d.r.id} className={`menu-tr${picked?.r.id === d.r.id ? ' on' : ''}`} onClick={() => setSel(d.r.id)} aria-pressed={picked?.r.id === d.r.id}
      aria-label={`${d.r.name}: price ${formatPounds(d.r.pricePence)}, cost ${formatPounds(d.cost)}, GP ${d.gp.toFixed(1)}%${why(d) ? `, ${why(d)}` : ''}`}>
      <span className="menu-dish">{d.r.name}</span>
      <span>{formatPounds(d.r.pricePence)}</span>
      <span>{formatPounds(d.cost)}</span>
      <b className={d.gp < target ? 't-warn' : ''}>{d.gp.toFixed(1)}%</b>
      <span className="menu-why">{why(d) || (d.gp < target ? '' : 'On target')}</span>
    </button>
  );
  const reasons = below.map(why).filter(Boolean);
  const topReason = reasons.length ? Object.entries(reasons.reduce<Record<string, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]! : null;
  // ", because pork went up." for one dish; ", all because …" or ", 2 of them because …" for more.
  const reasonText = !topReason ? '.' : `, ${below.length === 1 ? '' : topReason[1] === below.length ? 'all ' : `${topReason[1]} of them `}because ${topReason[0].charAt(0).toLowerCase() + topReason[0].slice(1)}.`;

  return (
    <HeadOfficeShell>
      <main className="page wide">
        <header className="nav" style={{ paddingLeft: 24 }}><span className="title">Menu costing</span><WhoMenu /></header>
        <div className="body">
          <div className="titleblock"><span className="eyebrow">Food menu · target GP {target}%</span><h1>Menu costing</h1></div>
          <div className="hero ho-group">
            <span className="hl">Today's prices</span>
            <span className="ho-sentence">{below.length ? `${below.length} dish${below.length > 1 ? 'es are' : ' is'} below ${target}%` : `Every dish is at ${target}% or more.`}{below.length ? reasonText : ''}</span>
            <div className="hm one"><span>{avg}%<small>Menu average</small></span></div>
          </div>
          <div className="stk-cols">
            <section className="grp" aria-label="Dishes">
              <div className="hd"><h2>{below.length ? 'Below target' : 'Dishes'}</h2><span>Price includes VAT</span></div>
              <div className="sub menu-table">
                {(below.length > 0 || showAll) && <div className="menu-th" aria-hidden="true"><span>Dish</span><span>Price</span><span>Cost</span><span>GP</span><span /></div>}
                {below.map(line)}
                {showAll && fine.map(line)}
              </div>
              {!showAll && fine.length > 0 && (
                <div className="sub">
                  <button type="button" className="li" onClick={() => setShowAll(true)}>
                    <span className="av ok"><Icon d={ICONS.check} /></span>
                    <span className="tx"><span>{fine.length} dishes on target</span><small>{fine.slice(0, 3).map((d) => d.r.name).join(', ')} and more</small></span>
                    <span className="rt"><span className="stk-meta" style={{ color: 'var(--link)' }}>Show</span><Chevron /></span>
                  </button>
                </div>
              )}
            </section>
            {picked && (
              <section className="menu-panel" aria-label={picked.r.name}>
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
                {gaps.map(({ r, gaps: g }) => <div className="li" key={r.id}><span className="av warn"><Icon d={ICONS.bang} /></span><span className="tx"><span>{r.name}</span><small>{g.map((x) => `${name(x.itemId)} contains ${x.allergen.toLowerCase()}`).join('; ')}, but the allergen record doesn't list it</small></span>
                  <span className="rt"><Link className="btn b1 btn-sm" to={`/food-safety/allergens/${r.id}`}>Fix the record</Link></span></div>)}
              </div>
              <p className="lead">The allergen record stays the source of truth: a mismatch is flagged, never changed for you.</p>
            </section>
          )}
        </div>
      </main>
    </HeadOfficeShell>
  );
}
