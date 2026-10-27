import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ALLERGENS, currentVersion, hasRead, nextVersion, readCount, type Allergen } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { useFoodSafety } from '../lib/food-safety';
import { now } from '../lib/clock';
import { Foot, Nav, RowLink } from '../components/ui';

/** Every dish with its allergens (HANDOFF.md §8a, item 4). Managers add dishes; everyone reads. */
export default function FsAllergens() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { site, addDish } = useFoodSafety();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [course, setCourse] = useState('Mains');
  const [picked, setPicked] = useState<Allergen[]>([]);
  const people = site.staff.map((s) => s.name);
  const courses = [...new Set(site.dishes.map((d) => d.course))];
  const edit = Boolean(user && can.editAllergens(user.role));

  if (adding) {
    const v = nextVersion({ versions: [] }, picked, '', user?.name ?? 'Manager', now().toISOString());
    return (
      <main className="page">
        <Nav back="/food-safety/allergens" backLabel="Cancel" title="New dish" />
        <div className="body form">
          <section className="grp">
            <div className="sub">
              <label className="fr"><span>Dish</span><input className="in" style={{ width: 200, textAlign: 'left' }} aria-label="Dish name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kare-kare" /></label>
              <label className="fr"><span>Course</span><input className="in" style={{ width: 200, textAlign: 'left' }} aria-label="Course" value={course} onChange={(e) => setCourse(e.target.value)} /></label>
            </div>
          </section>
          <section className="grp">
            <div className="gh"><h2>Which of the 14 does it contain?</h2><p>Check every ingredient's label, including sauces and oils.</p></div>
            <div className="chips">{ALLERGENS.map((a) => <button key={a} type="button" className="chip" aria-pressed={picked.includes(a)} onClick={() => setPicked((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]))}>{a}</button>)}</div>
          </section>
        </div>
        <Foot>
          <button type="button" className="btn b1" disabled={!name.trim() || typeof v === 'string'} onClick={() => { if (typeof v !== 'string') navigate(`/food-safety/allergens/${addDish({ name: name.trim(), course: course.trim() || 'Mains' }, v)}`); }}>
            {picked.length ? `Add dish · ${picked.length} allergen${picked.length > 1 ? 's' : ''}` : 'Add dish · none of the 14'}
          </button>
        </Foot>
      </main>
    );
  }

  return (
    <main className="page">
      <Nav back="/food-safety" backLabel="Food safety" title="Allergens" right={edit ? <button type="button" className="linkbtn" onClick={() => setAdding(true)}>Add dish</button> : undefined} />
      <div className="body">
        <div className="titleblock">
          <h1>Allergens</h1>
          <p className="lead">The 14 allergens in every dish. Always check here before answering a customer.</p>
        </div>
        {courses.map((c) => (
          <section className="grp" key={c}>
            <div className="hd"><h2>{c}</h2></div>
            <div className="sub">
              {site.dishes.filter((d) => d.course === c).map((d) => {
                const v = currentVersion(d);
                const unread = user && !hasRead(d, user.name);
                return (
                  <RowLink key={d.id} to={`/food-safety/allergens/${d.id}`} lead={<span className={`av${unread ? ' warn' : ''}`}>{v?.allergens.length ?? 0}</span>}
                    title={d.name} sub={v?.allergens.length ? v.allergens.join(', ') : 'None of the 14'}
                    right={unread ? <span className="pill p-warn">Changed</span> : edit ? <span className="muted">{readCount(d, people)} of {people.length} read</span> : undefined} />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
