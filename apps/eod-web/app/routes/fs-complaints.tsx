import { Link } from 'react-router';
import { isSerious } from '@maginhawa/core';
import { hm, shortDate, useFoodSafety } from '../lib/food-safety';
import { useChecklists } from '../lib/checklists';
import { Foot, Icon, ICONS, Nav } from '../components/ui';

/** Customer complaints about food (HANDOFF.md §8a, item 8). */
export default function FsComplaints() {
  const { site } = useFoodSafety();
  const { businessDate: today } = useChecklists();
  const list = [...site.complaints].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <main className="page">
      <Nav back="/food-safety" backLabel="Food safety" title="Complaints" />
      <div className="body">
        <div className="titleblock">
          <h1>Customer complaints</h1>
          <p className="lead">Foreign bodies, illness, allergic reactions or the wrong dish. Head office sees each one straight away.</p>
        </div>
        <section className="grp">
          <div className="sub">
            {list.map((c) => (
              <div className="li" key={c.id}>
                <span className={`av ${isSerious(c.kind) ? 'bad' : 'warn'}`}><Icon d={ICONS.chat} /></span>
                <span className="tx"><span>{c.kind} · {c.dish}</span><small>{shortDate(c.at, today)} {hm(c.at)} · {c.details}</small><small>{c.actions.join(', ')} · {c.by}</small></span>
              </div>
            ))}
            {!list.length && <p className="muted">No complaints recorded.</p>}
          </div>
        </section>
      </div>
      <Foot><Link className="btn b1" to="/food-safety/complaints/new">Record a complaint</Link></Foot>
    </main>
  );
}
