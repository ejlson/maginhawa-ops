/**
 * Edit or add a recipe at a site (supervisors and up; each site has its own recipes,
 * docs/reports/per-site-recipes-and-items.md). Everything but the menu price, which stays with head office.
 * Allergens come from the allergen record: an ingredient that carries one the record doesn't list is flagged here.
 * Head office edits another site's recipe with ?site=CODE.
 */
import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { allergenGaps, dishCost, dishGp, formatPounds, SITES, type Recipe } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { useOps } from '../lib/ops';
import { useStock } from '../lib/stock';
import { Foot, Icon, MoneyInput, Nav } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

type Draft = Omit<Recipe, 'id'> & { id?: string };

/** Opens the editor afresh whenever the dish or the site changes, so one site's draft never lands on another's. */
export default function RecipeEdit() {
  const { id } = useParams();
  const [params] = useSearchParams();
  return <Editor key={`${params.get('site') ?? ''}|${id ?? 'new'}`} />;
}

function Editor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const ops = useOps();
  const stock = useStock();
  const navigate = useNavigate();
  const ho = user?.role === 'headoffice';
  // Head office can open any site's recipe; everyone else edits their own site's.
  const site = ho && SITES.some((s) => s.code === params.get('site')) ? params.get('site')! : ops.siteCode;
  const recipes = ops.recipesFor(site);
  const items = stock.itemsFor(site).filter((i) => i.active);
  const existing = id ? recipes.find((r) => r.id === id) : undefined;
  const [d, setD] = useState<Draft>(() => existing ? structuredClone(existing)
    : { name: '', section: recipes[0]?.section ?? 'Mains', pricePence: 0, lines: [], extras: [], steps: [{ text: '', tip: '' }], allergens: [], perDay: 0, siteCode: site });
  const [tried, setTried] = useState(false);
  // What's typed in each amount box, so a half-typed "0.00" isn't cleared (0.004 kg must not become 4).
  const [amtText, setAmtText] = useState<string[]>(() => (existing?.lines ?? []).map((l) => String(l.amount)));
  if (!user) return null;
  if (!can.editRecipes(user.role) || (id && !existing)) return <Navigate to="/recipes" replace />;

  const sections = [...new Set(recipes.map((r) => r.section))];
  const set = (change: Partial<Draft>) => setD((x) => ({ ...x, ...change }));
  const cost = dishCost(d, stock.itemsFor(site));
  const gaps = allergenGaps(d, stock.itemsFor(site));
  const itemName = (itemId: string) => items.find((i) => i.id === itemId)?.name ?? stock.itemsFor(site).find((i) => i.id === itemId)?.name ?? itemId;
  const problem = d.name.trim().length < 2 ? 'Give the dish a name'
    : !d.lines.length && !d.extras.length ? 'Add at least one ingredient'
    : d.lines.some((l) => !(l.amount > 0)) ? 'Each ingredient needs an amount'
    : !d.steps.some((s) => s.text.trim()) ? 'Add at least one step' : null;
  // Head office comes from Menu costing (any site) and goes back there; a site goes back to its recipe.
  const back = ho ? `/head-office/menu?site=${site}` : existing ? `/recipes/${existing.id}` : '/recipes';
  const siteName = SITES.find((s) => s.code === site)?.name ?? site;

  const save = () => {
    setTried(true);
    if (problem) return;
    // Only head office sets the price; anyone else keeps whatever it is now (it may have changed since this opened).
    const nowPrice = ops.recipesFor(site).find((r) => r.id === d.id)?.pricePence ?? 0;
    const clean: Draft = {
      ...d, name: d.name.trim(), section: d.section.trim() || 'Mains', siteCode: site,
      pricePence: ho ? d.pricePence : nowPrice,
      // An ingredient's allergen is never dropped: the dish's list gains anything its ingredients carry.
      allergens: [...new Set([...d.allergens, ...gaps.map((g) => g.allergen)])],
      steps: d.steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text.trim(), tip: s.tip.trim() })),
      extras: d.extras.filter((e) => e.label.trim()),
    };
    const saved = ops.saveRecipe(clean);
    navigate(ho ? `/head-office/menu?site=${site}` : `/recipes/${saved}`);
  };

  return (
    <main className="page">
      <Nav back={back} backLabel={ho ? 'Menu costing' : existing ? existing.name : 'Recipes'} title={existing ? 'Edit recipe' : 'New recipe'} />
      <div className="body rc-edit">
        <div className="titleblock"><h1>{existing ? 'Edit recipe' : 'New recipe'}</h1><p className="lead">{siteName}'s recipe. Other sites keep their own.</p></div>

        <section className="grp" aria-label="The dish">
          <div className="stk-form">
            <label>Name<input className="in wide" value={d.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={tried && d.name.trim().length < 2} /></label>
            <label>Menu section
              <input className="in wide" list="rc-sections" value={d.section} onChange={(e) => set({ section: e.target.value })} />
              <datalist id="rc-sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
            </label>
            <label>Plates on a usual day<input className="in wide" type="number" inputMode="numeric" min={0} value={d.perDay || ''} onChange={(e) => set({ perDay: Math.max(0, Math.round(Number(e.target.value) || 0)) })} /></label>
            {ho ? <label>Menu price, with VAT<MoneyInput label="Menu price, with VAT" value={d.pricePence || null} onChange={(p) => set({ pricePence: p ?? 0 })} /></label>
              : <p className="note" style={{ margin: 0, alignSelf: 'center' }}>Menu price {d.pricePence ? formatPounds(d.pricePence) : 'not set yet'} · set by head office</p>}
          </div>
        </section>

        <section className="grp" aria-label="Ingredients">
          <div className="hd"><h2>Ingredients</h2><span>For one plate · costs {formatPounds(cost)}{d.pricePence ? ` · GP ${dishGp(d.pricePence, cost).toFixed(1)}%` : ''}</span></div>
          <div className="sub">
            {d.lines.map((l, i) => {
              const it = stock.itemsFor(site).find((x) => x.id === l.itemId);
              return (
                <div className="li rc-line" key={i}>
                  <select className="in" aria-label={`Ingredient ${i + 1}`} value={l.itemId} onChange={(e) => set({ lines: d.lines.map((x, k) => (k === i ? { ...x, itemId: e.target.value } : x)) })}>
                    {!items.some((x) => x.id === l.itemId) && <option value={l.itemId}>{itemName(l.itemId)}</option>}
                    {items.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <label className="rc-amt"><span className="vh">Amount of {itemName(l.itemId)}, in {it?.unit ?? 'units'}</span>
                    <input className="in" type="text" inputMode="decimal" value={amtText[i] ?? ''} aria-invalid={tried && !(l.amount > 0)}
                      onChange={(e) => {
                        const t = e.target.value.replace(',', '.');
                        setAmtText((a) => { const n = a.slice(); n[i] = t; return n; });
                        const v = Number(t);
                        set({ lines: d.lines.map((x, k) => (k === i ? { ...x, amount: Number.isFinite(v) && v > 0 ? v : 0 } : x)) });
                      }} />
                    <small>{it?.unit ?? ''}</small>
                  </label>
                  <input className="in rc-shown" aria-label={`How the kitchen says it, for ${itemName(l.itemId)}`} placeholder="300 g" value={l.shown}
                    onChange={(e) => set({ lines: d.lines.map((x, k) => (k === i ? { ...x, shown: e.target.value } : x)) })} />
                  <button type="button" className="cz-x rc-x" aria-label={`Remove ${itemName(l.itemId)}`} onClick={() => { set({ lines: d.lines.filter((_, k) => k !== i) }); setAmtText((a) => a.filter((_, k) => k !== i)); }}><Icon d="M5 12h14" size={11} /></button>
                </div>
              );
            })}
          </div>
          {items.length > 0 && (
            <button type="button" className="chip add" onClick={() => { set({ lines: [...d.lines, { itemId: items[0]!.id, amount: 0, shown: '' }] }); setAmtText((a) => [...a, '']); }}><Icon d={ICONS.plus} size={14} />Add an ingredient</button>
          )}
          {gaps.length > 0 && (
            <div className="banner warn" role="note"><Icon d={ICONS.bang} size={16} />
              <span>{gaps.map((g) => `${itemName(g.itemId)} contains ${g.allergen.toLowerCase()}`).join('; ')}, but the dish's allergens don't list it. Saving adds it. Check the dish's record in Food safety › Allergens too.</span></div>
          )}
        </section>

        <p className="note" style={{ margin: 0 }}>Allergens: {[...new Set([...d.allergens, ...gaps.map((g) => g.allergen)])].join(', ').toLowerCase() || 'none listed'}</p>

        <section className="grp" aria-label="Extras">
          <div className="hd"><h2>Extras</h2><span>Small things costed as one figure</span></div>
          <div className="sub">
            {d.extras.map((e, i) => (
              <div className="li rc-line" key={i}>
                <input className="in wide" aria-label={`Extra ${i + 1}`} placeholder="Sauce and garnish" value={e.label} onChange={(ev) => set({ extras: d.extras.map((x, k) => (k === i ? { ...x, label: ev.target.value } : x)) })} />
                <MoneyInput label={`Cost of ${e.label || `extra ${i + 1}`}`} value={e.costPence || null} onChange={(p) => set({ extras: d.extras.map((x, k) => (k === i ? { ...x, costPence: p ?? 0 } : x)) })} />
                <button type="button" className="cz-x rc-x" aria-label={`Remove ${e.label || `extra ${i + 1}`}`} onClick={() => set({ extras: d.extras.filter((_, k) => k !== i) })}><Icon d="M5 12h14" size={11} /></button>
              </div>
            ))}
          </div>
          <button type="button" className="chip add" onClick={() => set({ extras: [...d.extras, { label: '', costPence: 0 }] })}><Icon d={ICONS.plus} size={14} />Add an extra</button>
        </section>

        <section className="grp" aria-label="Steps">
          <div className="hd"><h2>Steps</h2><span>One instruction each</span></div>
          {d.steps.map((s, i) => (
            <div className="rc-stepedit" key={i}>
              <span className="rc-n" aria-hidden="true">{i + 1}</span>
              <div className="rc-stepf">
                <textarea className="ta" rows={2} aria-label={`Step ${i + 1}`} value={s.text} onChange={(e) => set({ steps: d.steps.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} />
                <input className="in wide" aria-label={`Tip for step ${i + 1}`} placeholder="A tip (optional)" value={s.tip} onChange={(e) => set({ steps: d.steps.map((x, k) => (k === i ? { ...x, tip: e.target.value } : x)) })} />
              </div>
              <span className="rc-stepact">
                <button type="button" className="cz-arr" disabled={i === 0} aria-label={`Move step ${i + 1} up`} onClick={() => { const st = d.steps.slice(); [st[i - 1], st[i]] = [st[i]!, st[i - 1]!]; set({ steps: st }); }}><Icon d={ICONS.up} size={12} /></button>
                <button type="button" className="cz-arr" disabled={i === d.steps.length - 1} aria-label={`Move step ${i + 1} down`} onClick={() => { const st = d.steps.slice(); [st[i + 1], st[i]] = [st[i]!, st[i + 1]!]; set({ steps: st }); }}><Icon d={ICONS.down} size={12} /></button>
                <button type="button" className="cz-x rc-x" aria-label={`Remove step ${i + 1}`} onClick={() => set({ steps: d.steps.filter((_, k) => k !== i) })}><Icon d="M5 12h14" size={11} /></button>
              </span>
            </div>
          ))}
          <button type="button" className="chip add" onClick={() => set({ steps: [...d.steps, { text: '', tip: '' }] })}><Icon d={ICONS.plus} size={14} />Add a step</button>
        </section>
      </div>
      <Foot>
        <button type="button" className="btn b1" onClick={save}>{existing ? 'Save recipe' : 'Add recipe'}</button>
        <p className={`note${tried && problem ? ' t-warn' : ''}`} role="status">{tried && problem ? problem : `Saved for ${siteName} only.`}</p>
      </Foot>
    </main>
  );
}
