import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { SITES } from '@maginhawa/core';
import { homeFor, initialsOf, ROLE_LABELS, useAuth, type Role } from '../lib/auth';
import { isConnected, isSharedDev } from '../lib/config';
import { Icon } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

export default function SignIn() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [siteCode, setSiteCode] = useState('BUN');
  const [role, setRole] = useState<Role>('manager');

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim() || 'Manager';
    signIn({ name: n, initials: initialsOf(n), role, siteCode });
    navigate(homeFor(role));
  };

  return (
    <main className="page">
      <form className="body" style={{ paddingTop: 56, gap: 32 }} onSubmit={go}>
        <div className="hero">
          <div className="av" style={{ width: 44, height: 44, borderRadius: 12, background: '#f5f5f7', color: '#1d1d1f', fontWeight: 700 }}>M</div>
          <div className="titleblock">
            <h1>Close the day</h1>
            <span className="hl">End-of-day reports for the Maginhawa restaurants.</span>
          </div>
          <div className="hs-small" style={{ paddingTop: 14, borderTop: '.5px solid var(--heroline)' }}>9 sites · works offline · saves as you go</div>
        </div>

        {!isConnected() && (
          <div className="banner" role="note">
            <Icon d={ICONS.bang} size={16} />
            <span>{isSharedDev()
              ? 'Shared test mode. Reports and checklists are kept on the laptop running the test server, so every device on this Wi‑Fi sees the same site. Examples only, not real figures.'
              : 'Demo mode. Reports stay on this device. Microsoft sign-in replaces this screen once Entra ID is connected.'}</span>
          </div>
        )}

        <section className="grp">
          <div className="gh"><h2>Who's closing?</h2></div>
          <div className="sub">
            <label className="fr">
              <span>Your name</span>
              <input className="in" style={{ width: 200, textAlign: 'right' }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jo" autoComplete="name" />
            </label>
            <label className="fr">
              <span>Site</span>
              <select className="in" style={{ width: 200 }} value={siteCode} onChange={(e) => setSiteCode(e.target.value)} aria-label="Site">
                {SITES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </label>
          </div>
          <div className="chips" role="radiogroup" aria-label="Role">
            {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => (
              <button key={r} type="button" role="radio" aria-checked={role === r} aria-pressed={role === r} className="chip" onClick={() => setRole(r)}>{label}</button>
            ))}
          </div>
        </section>

        <button className="btn b1" type="submit"><Icon d={ICONS.out} size={18} />Continue</button>
      </form>
    </main>
  );
}
