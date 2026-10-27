import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { checkPin, lockedFor, makePinRecord, PIN_LENGTH, pinIssues } from '@maginhawa/core';
import { initialsOf, recentPeople, remember, useAuth } from '../lib/auth';
import { pins } from '../lib/pins';
import { now } from '../lib/clock';
import { Foot, Nav, RowLink } from '../components/ui';
import { RolePicker } from '../components/RolePicker';

type Step =
  | { kind: 'pick' }
  | { kind: 'enter'; name: string }
  | { kind: 'create'; name: string; first: string | null };

/** Four big dots over a hidden number field: the iPad's number pad opens, and four digits submit. */
function PinField({ label, onDone, message, bad }: { label: string; onDone: (pin: string) => void; message?: string; bad?: boolean }) {
  const [pin, setPin] = useState('');
  return (
    <label className="pinfield">
      <span className="pinlabel">{label}</span>
      <span className={`pindots${bad ? ' bad' : ''}`} aria-hidden="true">
        {Array.from({ length: PIN_LENGTH }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}
      </span>
      <input className="pinin" type="password" inputMode="numeric" autoComplete="off" autoFocus maxLength={PIN_LENGTH} aria-label={label} value={pin}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
          setPin(v);
          if (v.length === PIN_LENGTH) { onDone(v); setPin(''); }
        }} />
      <span className={`pinmsg${bad ? ' bad' : ''}`} role={bad ? 'alert' : undefined}>{message ?? ''}</span>
    </label>
  );
}

/**
 * Who's using the shared iPad. Each person proves it's them with a 4-digit PIN, so every checklist
 * is saved under the person who did it. First time on this iPad, they choose one.
 */
export default function Switch() {
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  const [name, setName] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  if (!user) return null;
  const site = user.siteCode;
  const people = recentPeople(site).filter((p) => p.name !== user.name && p.role === 'staff');

  const become = (n: string) => {
    remember(user);
    signIn({ name: n, initials: initialsOf(n), role: 'staff', siteCode: site });
    navigate('/');
  };
  const start = (n: string) => {
    setMsg(null);
    setStep(pins.has(site, n) ? { kind: 'enter', name: n } : { kind: 'create', name: n, first: null });
  };

  const enter = async (n: string, pin: string) => {
    const out = await checkPin(pins.get(site, n)!, pin, now());
    pins.set(site, n, out.record);
    if (out.ok) become(n);
    else setMsg({ text: out.message, bad: true });
  };
  const create = async (n: string, first: string | null, pin: string) => {
    if (first === null) {
      const issues = pinIssues(pin);
      if (issues.length) return setMsg({ text: issues[0]!, bad: true });
      setMsg(null);
      return setStep({ kind: 'create', name: n, first: pin });
    }
    if (pin !== first) {
      setMsg({ text: "Those didn't match. Choose your PIN again.", bad: true });
      return setStep({ kind: 'create', name: n, first: null });
    }
    pins.set(site, n, await makePinRecord(pin));
    become(n);
  };

  if (step.kind !== 'pick') {
    const n = step.name;
    const locked = step.kind === 'enter' ? lockedFor(pins.get(site, n)!, now()) : 0;
    return (
      <main className="page">
        <Nav back="/" backLabel="Home" title="Who's using it?" />
        <div className="body" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 32 }}>
          <span className="av ink" style={{ width: 64, height: 64, borderRadius: 32, fontSize: 22 }}>{initialsOf(n)}</span>
          <div className="titleblock" style={{ alignItems: 'center' }}>
            <h1>{step.kind === 'enter' ? `Hi ${n}` : step.first === null ? 'Choose a PIN' : 'Type it again'}</h1>
            <p className="lead">{step.kind === 'enter' ? 'Type your PIN to carry on.' : `${PIN_LENGTH} numbers only you know. You'll use it each time you pick up the iPad.`}</p>
          </div>
          {locked
            ? <p className="pinmsg bad" role="alert">Too many wrong tries. Try again in {locked} min, or ask your manager.</p>
            : <PinField key={`${step.kind}-${step.kind === 'create' ? step.first ?? '' : ''}`} label={step.kind === 'enter' ? 'Your PIN' : step.first === null ? 'New PIN' : 'New PIN again'}
                onDone={(p) => (step.kind === 'enter' ? enter(n, p) : create(n, step.first, p))} message={msg?.text} bad={msg?.bad} />}
          {step.kind === 'enter' && <p className="note" style={{ margin: 0 }}>Forgotten it? Your manager can reset it.</p>}
          <button type="button" className="linkbtn" style={{ minHeight: 44 }} onClick={() => { setMsg(null); setStep({ kind: 'pick' }); }}>Not {n}?</button>
        </div>
      </main>
    );
  }

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
            {people.map((p) => <RowLink key={p.name} onClick={() => start(p.name)} lead={<span className="av">{p.initials}</span>} title={p.name} sub={pins.has(site, p.name) ? undefined : 'No PIN yet'} />)}
          </div>
        </section>
        <section className="grp">
          <label className="field"><span>Someone else</span>
            <input className="in" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) start(name.trim()); }} />
          </label>
        </section>
        <RolePicker />
        <Link className="linkbtn" style={{ alignSelf: 'flex-start', minHeight: 44, display: 'flex', alignItems: 'center' }} to="/account">Sign out</Link>
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={!name.trim()} onClick={() => start(name.trim())}>{name.trim() ? `I'm ${name.trim()}` : 'Type your name'}</button>
      </Foot>
    </main>
  );
}
