import { useState } from 'react';
import { backToWorkAt, CERT_KINDS, certStatus, EXPIRY_WARN_DAYS, type CertState } from '@maginhawa/core';
import { shortDate, useFoodSafety } from '../lib/food-safety';
import { useChecklists } from '../lib/checklists';
import { now } from '../lib/clock';
import { ChipRadio, Foot, Nav } from '../components/ui';

const PILL: Record<CertState, string> = { ok: 'p-ok', expiring: 'p-warn', expired: 'p-bad', missing: 'p-bad' };
const ORDER: CertState[] = ['expired', 'missing', 'expiring', 'ok'];

/** Food hygiene certificates and who's off work under the 48-hour rule (HANDOFF.md §8a, item 9). Managers only: health data. */
export default function FsPeople() {
  const { site, addCertificate } = useFoodSafety();
  const { businessDate: today } = useChecklists();
  const at = now();
  const [adding, setAdding] = useState(false);
  const [person, setPerson] = useState(site.staff[0]?.name ?? '');
  const [kind, setKind] = useState<string>(CERT_KINDS[0]);
  const [expires, setExpires] = useState('');

  const rows = site.staff.map((s) => {
    const cert = site.certificates.filter((c) => c.person === s.name && c.kind.startsWith('Food hygiene')).sort((a, b) => b.expires.localeCompare(a.expires))[0];
    return { s, cert, status: certStatus(cert, today) };
  }).sort((a, b) => ORDER.indexOf(a.status.state) - ORDER.indexOf(b.status.state));
  const inDate = rows.filter((r) => r.status.state === 'ok' || r.status.state === 'expiring').length;
  const off = site.fitness.map((f) => ({ f, back: backToWorkAt(f, at) })).filter((x) => x.back);
  const allergenTrained = site.staff.filter((s) => site.certificates.some((c) => c.person === s.name && c.kind === 'Allergen awareness' && c.expires >= today)).length;
  const text = (r: (typeof rows)[number]) => {
    const { state, days } = r.status;
    if (state === 'missing') return 'No food hygiene certificate yet';
    if (state === 'expired') return `${r.cert!.kind} expired ${shortDate(r.cert!.expires, today)}`;
    return `${r.cert!.kind} · expires ${shortDate(r.cert!.expires, today)}${state === 'expiring' ? ` (${days} days)` : ''}`;
  };

  return (
    <main className="page">
      <Nav back="/food-safety" backLabel="Food safety" title="Training" right={<span className="muted" style={{ fontSize: 13 }}>Managers only</span>} />
      <div className="body form">
        <div className="hero">
          <span className="hl">Food hygiene certificate in date</span>
          <div className="big"><b>{inDate}</b><i>&nbsp;of {rows.length} staff</i></div>
          <div className="hm">
            <span>{rows.filter((r) => r.status.state === 'expiring').length}<small>Expire in {EXPIRY_WARN_DAYS} days</small></span>
            <span className={rows.length - inDate ? 'h-bad' : ''}>{rows.length - inDate}<small>Missing or expired</small></span>
            <span>{allergenTrained} of {rows.length}<small>Allergen training</small></span>
          </div>
        </div>

        <section className="grp">
          <div className="hd"><h2>Off work</h2><span>{off.length}</span></div>
          <div className="sub">
            {off.map(({ f, back }) => (
              <div className="li" key={f.person + f.at}>
                <span className="av bad">{f.person.split(' ').map((w) => w[0]).join('')}</span>
                <span className="tx"><span>{f.person}</span><small>Said yes to sickness or diarrhoea in the last 48 hours</small></span>
                <span className="pill p-bad">Back {back!.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' })} {back!.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}</span>
              </div>
            ))}
            {!off.length && <p className="muted">Everyone is fit to work.</p>}
          </div>
          <p className="note">Asked before a shift. They stay off until 48 hours after the symptoms stop. Only managers see the answers, and they're cleared after 6 months.</p>
        </section>

        <section className="grp">
          <div className="hd"><h2>Certificates</h2><span>{rows.length - inDate} need action</span></div>
          <div className="sub">
            {rows.map((r) => (
              <div className="li" key={r.s.name}>
                <span className={`av ${r.status.state === 'ok' ? '' : r.status.state === 'expiring' ? 'warn' : 'bad'}`}>{r.s.name.split(' ').map((w) => w[0]).join('')}</span>
                <span className="tx"><span>{r.s.name} · {r.s.job}</span><small>{text(r)}</small></span>
                <span className={`pill ${PILL[r.status.state]}`}>{r.status.state === 'ok' ? 'In date' : r.status.state === 'expiring' ? `${r.status.days} days` : r.status.state === 'expired' ? 'Expired' : 'Missing'}</span>
              </div>
            ))}
          </div>
        </section>

        {adding && (
          <section className="grp">
            <div className="gh"><h2>Add a certificate</h2></div>
            <div className="chips" role="radiogroup" aria-label="Person">{site.staff.map((s) => <ChipRadio key={s.name} checked={person === s.name} onClick={() => setPerson(s.name)}>{s.name}</ChipRadio>)}</div>
            <div className="chips" role="radiogroup" aria-label="Certificate">{CERT_KINDS.map((k) => <ChipRadio key={k} checked={kind === k} onClick={() => setKind(k)}>{k}</ChipRadio>)}</div>
            <div className="sub"><label className="fr"><span>Expires</span><input className="in wide-in" type="date" aria-label="Expires" value={expires} onChange={(e) => setExpires(e.target.value)} /></label></div>
          </section>
        )}
      </div>
      <Foot>
        {adding
          ? <button type="button" className="btn b1" disabled={!person || !expires} onClick={() => { addCertificate({ person, kind, expires }); setAdding(false); setExpires(''); }}>Save certificate</button>
          : <button type="button" className="btn b1" onClick={() => setAdding(true)}>Add a certificate</button>}
      </Foot>
    </main>
  );
}
