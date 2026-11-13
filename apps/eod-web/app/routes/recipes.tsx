/** Recipes for the kitchen: every dish by menu section. No prices here. */
import { useAuth } from '../lib/auth';
import { useOps } from '../lib/ops';
import { Icon, Nav, RowLink } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

export default function Recipes() {
  const { user } = useAuth();
  const { data } = useOps();
  if (!user) return null;
  const sections = [...new Set(data.recipes.map((r) => r.section))];
  return (
    <main className="page">
      <Nav back="/more" backLabel="More" title="Recipes" />
      <div className="body">
        <div className="titleblock"><h1>Recipes</h1><p className="lead">Get everything ready, then one step at a time.</p></div>
        {sections.map((s) => (
          <section className="grp" key={s} aria-label={s}>
            <div className="hd"><h2>{s}</h2></div>
            <div className="sub">
              {data.recipes.filter((r) => r.section === s).map((r) => <RowLink key={r.id} to={`/recipes/${r.id}`} lead={<span className="av"><Icon d={ICONS.list} /></span>}
                title={r.name} sub={r.allergens.length ? `Contains: ${r.allergens.join(', ').toLowerCase()}` : 'No listed allergens'} />)}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
