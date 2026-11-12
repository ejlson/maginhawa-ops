import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { homeFor, initialsOf, ROLE_ENTRIES, useAuth, type Role } from '../lib/auth';
import { isConnected, isSharedDev, usesEmailSignIn } from '../lib/config';
import { askForCode, checkCode, userFrom } from '../lib/session';
import { ChipRadio, Icon, SiteOptions } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

export default function SignIn() {
  return usesEmailSignIn() ? <EmailSignIn /> : <DemoSignIn />;
}

/** Demo mode: pick a name, site and role on this device. */
function DemoSignIn() {
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
              : 'Demo mode. Reports stay on this device. Email sign-in replaces this screen once the server is connected.'}</span>
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
                <SiteOptions />
              </select>
            </label>
          </div>
          <div className="chips" role="radiogroup" aria-label="Role">
            {ROLE_ENTRIES.map(([r, label]) => (
              <ChipRadio key={r} checked={role === r} onClick={() => setRole(r)}>{label}</ChipRadio>
            ))}
          </div>
        </section>

        <button className="btn b1" type="submit"><Icon d={ICONS.out} size={18} />Continue</button>
      </form>
    </main>
  );
}

function Hero() {
  return (
    <div className="hero">
      <div className="av" style={{ width: 44, height: 44, borderRadius: 12, background: '#f5f5f7', color: '#1d1d1f', fontWeight: 700 }}>M</div>
      <div className="titleblock">
        <h1>Close the day</h1>
        <span className="hl">End-of-day reports and checklists for the Maginhawa restaurants.</span>
      </div>
      <div className="hs-small" style={{ paddingTop: 14, borderTop: '.5px solid var(--heroline)' }}>Sign in with a code sent to your email</div>
    </div>
  );
}

/**
 * Email sign-in: type your email, then the 6-digit code sent to it. Any email works if it is on
 * the team list (People). The screen never says whether an email is on the list.
 */
function EmailSignIn() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<{ challenge: string; minutes: number } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Type your email address.');
    setBusy(true);
    setError(null);
    const r = await askForCode(email.trim());
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSent(r.value);
    setCode('');
  };

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sent || busy) return;
    if (!/^\d{6}$/.test(code.trim())) return setError('Type the 6-digit code from the email.');
    setBusy(true);
    setError(null);
    const r = await checkCode(sent.challenge, code.trim());
    setBusy(false);
    if (!r.ok) {
      if (r.code === 'locked' || r.code === 'expired' || r.code === 'used') setSent(null);
      return setError(r.error);
    }
    const u = userFrom(r.value.me);
    signIn(u);
    navigate(homeFor(u.role));
  };

  return (
    <main className="page">
      {!sent ? (
        <form className="body" style={{ paddingTop: 56, gap: 32 }} onSubmit={send} noValidate>
          <Hero />
          {isSharedDev() && (
            <div className="banner" role="note">
              <Icon d={ICONS.bang} size={16} />
              <span>Practice mode. Any email works and signs in as head office. The code is printed in the terminal running the test server, not emailed.</span>
            </div>
          )}
          <section className="grp">
            <div className="gh"><h2>Sign in</h2></div>
            <div className="sub">
              <label className="fr">
                <span>Email</span>
                <input className="in" style={{ width: 230, textAlign: 'right' }} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
                  value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="you@example.com" aria-describedby="sign-in-help" />
              </label>
            </div>
            <p id="sign-in-help" className="note" style={{ margin: '8px 4px 0' }}>Use the email your manager added for you. We’ll send you a 6-digit code.</p>
          </section>
          {error && <p className="note" role="alert" style={{ color: 'var(--bad)', margin: 0 }}>{error}</p>}
          <button className="btn b1" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
        </form>
      ) : (
        <form className="body" style={{ paddingTop: 56, gap: 32 }} onSubmit={check} noValidate>
          <Hero />
          <section className="grp">
            <div className="gh"><h2>Check your email</h2></div>
            <p className="note" style={{ margin: '0 4px 12px' }}>If <strong>{email.trim()}</strong> is on the team, a code is on its way. It lasts {sent.minutes} minutes. Check your junk folder too.</p>
            <div className="sub">
              <label className="fr">
                <span>Code</span>
                <input className="in" style={{ width: 160, textAlign: 'center', letterSpacing: '0.3em', fontVariantNumeric: 'tabular-nums' }} inputMode="numeric" autoComplete="one-time-code"
                  maxLength={6} pattern="[0-9]*" autoFocus value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }} placeholder="123456" aria-label="6-digit code" />
              </label>
            </div>
          </section>
          {error && <p className="note" role="alert" style={{ color: 'var(--bad)', margin: 0 }}>{error}</p>}
          <button className="btn b1" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <button type="button" className="linkbtn" style={{ minHeight: 44 }} onClick={() => { setSent(null); setError(null); }}>Use a different email</button>
            <button type="button" className="linkbtn" style={{ minHeight: 44 }} onClick={() => void send()} disabled={busy}>Send a new code</button>
          </div>
        </form>
      )}
    </main>
  );
}
