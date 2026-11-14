import { useState } from 'react';
import { reportedText } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { useSite } from '../lib/site';
import { now } from '../lib/clock';
import { Icon, Nav } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

/** Open repairs for the site. Supervisors and managers mark them fixed. */
export default function Repairs() {
  const { user } = useAuth();
  const { open, markFixed } = useSite();
  const [confirm, setConfirm] = useState<string | null>(null);
  const at = now();

  return (
    <main className="page">
      <Nav back="/" backLabel="Home" title="Repairs" />
      <div className="body">
        <div className="titleblock">
          <h1>Repairs</h1>
          <p className="lead">{open.length ? `${open.length} open. Mark one fixed once it's sorted.` : 'Nothing open. Good.'}</p>
        </div>
        {open.length > 0 && (
          <section className="grp">
            <div className="sub">
              {open.map((r) => (
                <div className="li" key={r.id}>
                  <span className={`av ${r.urgent ? 'bad' : 'warn'}`}><Icon d={ICONS.wrench} /></span>
                  <span className="tx">
                    <span>{r.title}</span>
                    <small>{[r.place, `${reportedText(r.reportedAt, at)} by ${r.reportedBy}`, r.note].filter(Boolean).join(' · ')}</small>
                    {r.photos?.length ? <span className="photo-row sm">{r.photos.map((src, i) => <img key={i} src={src} alt={`${r.title}, photo ${i + 1}`} />)}</span> : null}
                  </span>
                  <span className="rt">
                    {r.urgent && <span className="pill p-bad">Urgent</span>}
                    <button type="button" className="chip" onClick={() => {
                      if (confirm !== r.id) return setConfirm(r.id);
                      markFixed(r.id, user?.name ?? 'Manager');
                      setConfirm(null);
                    }}>{confirm === r.id ? 'Tap again' : 'Fixed'}</button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
