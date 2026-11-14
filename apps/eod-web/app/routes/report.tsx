import { useState } from 'react';
import { useNavigate } from 'react-router';
import { REPAIR_PLACES, repairIssues, type RepairPlace } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { useSite } from '../lib/site';
import { ChipRadio, Foot, Icon, Nav, Toggle } from '../components/ui';
import { shrinkPhoto } from '../lib/photo';

const MAX_PHOTOS = 3;

/** Anyone can report something broken. It goes straight to the manager's home screen. */
export default function Report() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { report } = useSite();
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState<RepairPlace>('Kitchen');
  const [note, setNote] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const issues = repairIssues({ title });

  return (
    <main className="page">
      <Nav back="/" backLabel="Home" title="Report a problem" />
      <div className="body form">
        <div className="titleblock">
          <h1>What's wrong?</h1>
          <p className="lead">Your manager sees it straight away and arranges the repair.</p>
        </div>
        <section className="grp">
          <label className="field"><span>What's broken</span>
            <input className="in" autoFocus placeholder="e.g. Walk-in door doesn't close" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <div className="field"><span id="place">Where</span>
            <div className="chips" role="radiogroup" aria-labelledby="place">
              {REPAIR_PLACES.map((p) => <ChipRadio key={p} checked={place === p} onClick={() => setPlace(p)}>{p}</ChipRadio>)}
            </div>
          </div>
          <label className="field"><span>Anything else <small>· optional</small></span>
            <textarea className="ta" placeholder="What happened, what you've tried" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="field"><span>Photos <small>· optional, up to {MAX_PHOTOS}</small></span>
            <div className="photo-row">
              {photos.map((src, i) => (
                <span className="photo-thumb" key={i}>
                  <img src={src} alt={`Photo ${i + 1}`} />
                  <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos((p) => p.filter((_, n) => n !== i))}>×</button>
                </span>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className={`photo-add${adding ? ' busy' : ''}`}>
                  <Icon d="M2 6h3l1.5-2h5L13 6h3v9H2zM9 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" /><span>{adding ? 'Adding…' : 'Add photo'}</span>
                  {/* Visually hidden, not display:none, so it can be reached by keyboard. No capture: the library is allowed too. */}
                  <input type="file" accept="image/*" className="vh" aria-label="Add a photo" disabled={adding}
                    onChange={async (ev) => {
                      const f = ev.target.files?.[0]; ev.target.value = '';
                      if (!f) return;
                      setAdding(true); setPhotoError(null);
                      try { const src = await shrinkPhoto(f, 400, 0.6); setPhotos((p) => [...p, src].slice(0, MAX_PHOTOS)); }
                      catch { setPhotoError("That photo couldn't be opened. Try another, or take one with the camera."); }
                      finally { setAdding(false); }
                    }} />
                </label>
              )}
            </div>
            {photoError && <p className="note bad" role="alert" style={{ margin: 0 }}>{photoError}</p>}
          </div>
          <div className="fr"><span className="tx"><span>It's urgent</span><small>Unsafe, or we can't serve without it</small></span><Toggle label="It's urgent" checked={urgent} onChange={setUrgent} /></div>
        </section>
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={issues.length > 0 || adding} onClick={() => {
          report({ title: title.trim(), place, note: note.trim(), urgent, ...(photos.length ? { photos } : {}), reportedBy: user?.name ?? 'Staff' });
          navigate('/', { state: { reported: true } });
        }}>Send to the manager</button>
      </Foot>
    </main>
  );
}
