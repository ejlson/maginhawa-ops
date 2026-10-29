import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { ALLERGENS, allergenChange, changeText, currentVersion, hasRead, nextVersion, readCount, type Allergen } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { shortDate, useFoodSafety } from '../lib/food-safety';
import { useChecklists } from '../lib/checklists';
import { now } from '../lib/clock';
import { Foot, Icon, Nav, RowLink } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

/** One dish: its 14-allergen grid, every version kept, and "I've read the change". */
export default function FsDish() {
  const { dish: id = '' } = useParams();
  const { user } = useAuth();
  const { site, addDishVersion, markRead } = useFoodSafety();
  const { businessDate: today } = useChecklists();
  const dish = site.dishes.find((d) => d.id === id);
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<Allergen[]>([]);
  const [note, setNote] = useState('');
  if (!dish || !user) return <Navigate to="/food-safety/allergens" replace />;
  const v = currentVersion(dish)!;
  const people = site.staff.map((s) => s.name);
  const read = hasRead(dish, user.name);
  const edit = can.editAllergens(user.role);
  const next = editing ? nextVersion(dish, picked, note, user.name, now().toISOString()) : null;

  return (
    <main className="page">
      <Nav back="/food-safety/allergens" backLabel="Allergens" title={dish.name} right={edit && !editing ? <button type="button" className="linkbtn" onClick={() => { setPicked(v.allergens); setNote(''); setEditing(true); }}>Change</button> : undefined} />
      <div className="body form">
        <div className="hero">
          <span className="hl">{dish.name} · {dish.course}</span>
          <div className="big"><b>{v.allergens.length}</b><i>&nbsp;of 14 allergens</i></div>
          <div className="hm"><span>{shortDate(v.at, today)}<small>Last changed</small></span><span>{v.by}<small>Checked by</small></span><span>{readCount(dish, people)} of {people.length}<small>Staff have read</small></span></div>
        </div>

        {editing ? (
          <>
            <section className="grp">
              <div className="gh"><h2>Contains</h2><p>The old version is kept; staff are asked to read the change.</p></div>
              <div className="chips">{ALLERGENS.map((a) => <button key={a} type="button" className="chip" aria-pressed={picked.includes(a)} onClick={() => setPicked((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]))}>{a}</button>)}</div>
            </section>
            <section className="grp">
              <div className="gh"><h2>Why</h2></div>
              <textarea className="ta" aria-label="Why it changed" placeholder="e.g. New vinegar supplier" value={note} onChange={(e) => setNote(e.target.value)} />
              <p className="note">{changeText(allergenChange(v.allergens, picked))}</p>
            </section>
          </>
        ) : (
          <section className="grp">
            <div className="hd"><h2>The 14 allergens</h2><span>{v.allergens.length} contained</span></div>
            <div className="allergen-grid">
              {ALLERGENS.map((a) => <div className="fr" key={a}><span>{a}</span><span className={v.allergens.includes(a) ? 'warn' : 'muted'} style={{ fontWeight: 600, fontSize: 14 }}>{v.allergens.includes(a) ? 'Contains' : 'No'}</span></div>)}
            </div>
          </section>
        )}

        <section className="grp">
          <div className="hd"><h2>Changes</h2><span>Every version kept</span></div>
          <div className="sub">
            {[...dish.versions].reverse().map((x, i, all) => {
              const before = all[i + 1];
              return <RowLink key={x.version} lead={<span className={`av${before ? ' warn' : ''}`}>v{x.version}</span>} title={before ? changeText(allergenChange(before.allergens, x.allergens)) : 'Dish added'} sub={[x.note, x.by, shortDate(x.at, today)].filter(Boolean).join(' · ')} />;
            })}
          </div>
        </section>
        {!editing && <RowLink to="/food-safety/complaints/new?kind=Allergic%20reaction" lead={<span className="av bad"><Icon d={ICONS.bang} /></span>} title="Report an allergic reaction" sub="Or a near miss" />}
      </div>
      <Foot>
        {editing ? (
          <>
            <button type="button" className="btn b1" disabled={typeof next === 'string'} onClick={() => { if (next && typeof next !== 'string') { addDishVersion(dish.id, next); setEditing(false); } }}>Save version {v.version + 1}</button>
            <p className="note">{typeof next === 'string' ? next : 'Everyone is asked to read it.'} <button type="button" className="linkbtn" onClick={() => setEditing(false)}>Cancel</button></p>
          </>
        ) : read ? (
          <p className="note" role="status"><Icon d={ICONS.check} size={14} /> You've read version {v.version}.</p>
        ) : (
          <button type="button" className="btn b1" onClick={() => markRead(dish.id, user.name)}>I've read the change</button>
        )}
      </Foot>
    </main>
  );
}
