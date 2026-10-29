import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { canManagePeople, personProblem, rolesGivenBy, siteName, usesPin, type PersonRole } from '@maginhawa/core';
import { homeFor, ROLE_LABELS, useAuth } from '../lib/auth';
import { people } from '../lib/people';
import { Foot, Icon, ICONS, Nav } from '../components/ui';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { ROLE_DOES } from './people';

/** Add someone to a site: name, role, and how they'll sign in. */
/** Head office gets its own sidebar around the screen; everyone else is already inside the site's. */
export default function PeopleNew() {
  const { user } = useAuth();
  return user?.role === 'headoffice' ? <HeadOfficeShell><PeopleNewScreen /></HeadOfficeShell> : <PeopleNewScreen />;
}

function PeopleNewScreen() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [name, setName] = useState('');
  const [role, setRole] = useState<PersonRole>('staff');
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  if (!user) return null;
  if (!canManagePeople(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  const siteCode = user.role === 'headoffice' ? params.get('site') ?? user.siteCode : user.siteCode;
  const site = siteName(siteCode);
  const list = `/people${user.role === 'headoffice' ? `?site=${siteCode}` : ''}`;
  const pin = usesPin(role);
  const problem = personProblem({ name, role, email: pin ? null : email, siteCode }, people.all(), user.role);
  const n = name.trim();

  if (added) {
    return (
      <main className="page">
        <Nav back={list} backLabel="People" title="Added" />
        <div className="body" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 56 }}>
          <span className="av ok" style={{ width: 72, height: 72, borderRadius: 36 }}><Icon d={ICONS.check} size={30} /></span>
          <div className="titleblock" style={{ alignItems: 'center' }}>
            <h1>{added} is added</h1>
            <p className="lead">{pin ? 'Their name is on the iPad now. The first time they tap it, they choose a PIN.' : `They can sign in with their work account and see everything at ${site}.`}</p>
          </div>
        </div>
        <Foot>
          <Link className="btn b1" to={list}>Done</Link>
          <button type="button" className="linkbtn" style={{ minHeight: 44, alignSelf: 'center' }} onClick={() => { setAdded(null); setName(''); setEmail(''); setRole('staff'); setTried(false); }}>Add someone else</button>
        </Foot>
      </main>
    );
  }

  const add = () => {
    setTried(true);
    if (problem) return;
    people.add({ name: n, role, siteCode, email: pin ? null : email, addedBy: user.name });
    setAdded(n);
  };

  return (
    <main className="page">
      <Nav back={list} backLabel="People" title="Add a person" />
      <form className="body form" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <div className="titleblock">
          <span className="eyebrow">{site}</span>
          <h1>Add a person</h1>
        </div>
        <label className="field"><span>Name</span>
          <input className="in" autoFocus autoComplete="off" placeholder="First name, as the team knows them" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <section className="grp" role="radiogroup" aria-label="Role">
          <div className="sl"><span>Role</span></div>
          {(['staff', 'supervisor', 'manager', 'headoffice'] as PersonRole[]).map((r) => (
            <button key={r} type="button" className="role-opt" role="radio" aria-checked={role === r} disabled={!rolesGivenBy(user.role).includes(r)} onClick={() => setRole(r)}>
              <span className={`ring${role === r ? ' on' : ''}`}>{role === r && <Icon d={ICONS.check} size={13} />}</span>
              <span className="tx"><span>{ROLE_LABELS[r]}</span><small>{ROLE_DOES[r]}</small></span>
            </button>
          ))}
        </section>

        <section className="grp">
          <div className="sl"><span>Signing in</span></div>
          <div className="li" style={{ cursor: 'default' }}>
            <span className="av"><Icon d={pin ? ICONS.lock : ICONS.out} size={17} /></span>
            {pin
              ? <span className="tx"><span>A PIN on the iPad</span><small>They tap their name and choose a 4-digit PIN the first time. Nobody else needs to know it.</small></span>
              : <span className="tx"><span>Their Microsoft work account</span><small>{ROLE_LABELS[role]}s sign in with their own account, on any device.</small></span>}
          </div>
          {!pin && (
            <label className="field"><span>Work email</span>
              <input className="in" type="email" autoComplete="off" placeholder="name@[your work domain]" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          )}
        </section>
      </form>
      <Foot>
        <button type="button" className="btn b1" disabled={!n} onClick={add}>{n ? `Add ${n}` : 'Add person'}</button>
        <p className="note" role={tried && problem ? 'alert' : undefined} style={tried && problem ? { color: 'var(--bad)' } : undefined}>
          {tried && problem ? problem : !n ? 'Type their name to add them.' : pin ? `${n} shows up on the iPad straight away.` : `${n} signs in with their work account.`}
        </p>
      </Foot>
    </main>
  );
}
