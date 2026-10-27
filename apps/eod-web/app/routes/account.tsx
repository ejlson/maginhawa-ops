import { useState } from 'react';
import { useNavigate } from 'react-router';
import { SITES } from '@maginhawa/core';
import { homeFor, recentPeople, ROLE_LABELS, useAuth } from '../lib/auth';
import { pins } from '../lib/pins';
import { Foot, Icon, ICONS, Nav, RowLink } from '../components/ui';
import { RolePicker } from '../components/RolePicker';

/** Who's signed in. Demo mode can switch role on the spot; connected mode takes roles from Microsoft sign-in. */
export default function Account() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [, refresh] = useState(0);
  if (!user) return null;
  // Managers reset a forgotten PIN; the person chooses a new one next time they pick up the iPad.
  const withPins = user.role === 'manager' || user.role === 'headoffice'
    ? recentPeople(user.siteCode).filter((p) => p.role === 'staff' && pins.has(user.siteCode, p.name))
    : [];
  const site = SITES.find((s) => s.code === user.siteCode)?.name ?? user.siteCode;
  const back = homeFor(user.role);

  return (
    <main className="page">
      <Nav back={back} backLabel={user.role === 'headoffice' ? 'All sites' : 'Home'} title="Account" />
      <div className="body">
        <div className="top">
          <div className="hero">
            <span className="hl">Signed in</span>
            <span className="hero-title">{user.name}</span>
            <div className="hero-row hero-foot"><span className="hs-small">{ROLE_LABELS[user.role]} · {site}</span></div>
          </div>
        </div>

        {withPins.length > 0 && (
          <section className="grp">
            <div className="gh"><h2>Staff PINs</h2><p>For the shared iPad. Reset one if someone forgets theirs.</p></div>
            <div className="sub">
              {withPins.map((p) => (
                <RowLink key={p.name} lead={<span className="av">{p.initials}</span>} title={p.name} sub="PIN set"
                  right={<button type="button" className="chip" onClick={() => {
                    if (confirm !== p.name) return setConfirm(p.name);
                    pins.reset(user.siteCode, p.name);
                    setConfirm(null);
                    refresh((n) => n + 1);
                  }}>{confirm === p.name ? 'Tap again' : 'Reset PIN'}</button>} />
              ))}
            </div>
          </section>
        )}
        <RolePicker />
      </div>
      <Foot>
        <button type="button" className="btn b2" style={{ color: 'var(--bad)' }} onClick={() => { signOut(); navigate('/sign-in'); }}>
          <Icon d={ICONS.out} size={17} />Sign out
        </button>
      </Foot>
    </main>
  );
}
