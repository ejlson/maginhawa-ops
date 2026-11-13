/**
 * A recipe in the kitchen (RC1): first everything to get ready for one plate, then one instruction per
 * screen in large type. Allergens from the allergen record. No prices.
 */
import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { useOps } from '../lib/ops';
import { useStock } from '../lib/stock';
import { Foot, Nav } from '../components/ui';

export default function RecipePage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { data } = useOps();
  const { item } = useStock();
  const [i, setI] = useState(0);
  const r = data.recipes.find((x) => x.id === id);
  if (!user || !r) return <Navigate to="/recipes" replace />;
  const total = r.steps.length + 1;
  const last = i === total - 1;
  const step = i > 0 ? r.steps[i - 1] : null;

  return (
    <main className="page">
      <Nav back="/recipes" backLabel="Recipes" title={`${r.name} · ${i + 1} of ${total}`} />
      <div className="body stk-body">
        <div className="stk-segs">{Array.from({ length: total }, (_, k) => <span key={k} className={k <= i ? 'on' : ''} />)}</div>
        <div className="hero stk-hero stk-item">
          <span className="hl">{i === 0 ? 'First, get these ready' : `Step ${i} of ${r.steps.length}`}</span>
          <span className="stk-title">{i === 0 ? 'For one plate' : r.name}</span>
          {r.allergens.length > 0 && <span className="rc-allergens">Contains: {r.allergens.join(', ').toLowerCase()}</span>}
        </div>
        {i === 0 ? (
          <section className="grp" aria-label="For one plate">
            <div className="sub">
              {r.lines.map((l) => <div className="li" key={l.itemId}><span className="tx"><span>{item(l.itemId)?.name.replace(/ \d.*$/, '')}</span></span><span className="rt"><b className="amt">{l.shown}</b></span></div>)}
              {r.extras.map((e) => <div className="li" key={e.label}><span className="tx"><span>{e.label}</span></span></div>)}
            </div>
          </section>
        ) : (
          <div className="rc-step">
            <p>{step!.text}</p>
            {step!.tip && <span className="banner">{step!.tip}</span>}
          </div>
        )}
      </div>
      <Foot>
        <button type="button" className="btn b1" onClick={() => setI(last ? 0 : i + 1)}>{i === 0 ? 'Got everything · start' : last ? 'Done · next plate' : 'Next'}</button>
        {i > 0 && <button type="button" className="stk-link center" onClick={() => setI(i - 1)}>Back</button>}
      </Foot>
    </main>
  );
}
