/** Recipes for the kitchen: this site's dishes by menu section. No prices here. Supervisors and up add and edit. */
import { Link } from 'react-router';
import { can, useAuth } from '../lib/auth';
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
        <div className="titleblock">
          <div className="more-hd"><h1>Recipes</h1>{can.editRecipes(user.role) && <Link className="chip" to="/recipes/new">New recipe</Link>}</div>
          <p className="lead">Get everything ready, then one step at a time.</p>
        </div>
        {data.recipes.length === 0 && <p className="lead">No recipes here yet.</p>}
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
