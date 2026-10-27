import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { initialsOf, recentPeople, remember, useAuth } from '../lib/auth';
import { Foot, Nav, RowLink } from '../components/ui';
import { RolePicker } from '../components/RolePicker';

/**
 * Who's using the shared iPad. Every checklist answer is saved under this name, so the records show
 * who did each check. Connected mode will add each person's PIN from the staff list.
 */
export default function Switch() {
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  const [name, setName] = useState('');
  if (!user) return null;
  const people = recentPeople(user.siteCode).filter((p) => p.name !== user.name && p.role === 'staff');
  const become = (n: string) => {
    remember(user);
    signIn({ name: n, initials: initialsOf(n), role: 'staff', siteCode: user.siteCode });
    navigate('/');
  };

  return (
    <main className="page">
      <Nav back="/" backLabel="Home" title="Who's using it?" />
      <div className="body">
        <div className="titleblock">
          <h1>Who's using the iPad?</h1>
          <p className="lead">Checklists you do are saved under your name.</p>
        </div>
        <section className="grp">
          <div className="sub">
            <RowLink onClick={() => navigate('/')} lead={<span className="av ink">{user.initials}</span>} title={user.name} sub="Using it now" />
            {people.map((p) => <RowLink key={p.name} onClick={() => become(p.name)} lead={<span className="av">{p.initials}</span>} title={p.name} />)}
          </div>
        </section>
        <section className="grp">
          <label className="field"><span>Someone else</span>
            <input className="in" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) become(name.trim()); }} />
          </label>
        </section>
        <RolePicker />
        <Link className="linkbtn" style={{ alignSelf: 'flex-start', minHeight: 44, display: 'flex', alignItems: 'center' }} to="/account">Sign out</Link>
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={!name.trim()} onClick={() => become(name.trim())}>{name.trim() ? `I'm ${name.trim()}` : 'Type your name'}</button>
      </Foot>
    </main>
  );
}
