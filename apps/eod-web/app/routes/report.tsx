import { useState } from 'react';
import { useNavigate } from 'react-router';
import { REPAIR_PLACES, repairIssues, type RepairPlace } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { useSite } from '../lib/site';
import { Foot, Nav, Toggle } from '../components/ui';

/** Anyone can report something broken. It goes straight to the manager's home screen. */
export default function Report() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { report } = useSite();
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState<RepairPlace>('Kitchen');
  const [note, setNote] = useState('');
  const [urgent, setUrgent] = useState(false);
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
              {REPAIR_PLACES.map((p) => <button key={p} type="button" className="chip" role="radio" aria-checked={place === p} aria-pressed={place === p} onClick={() => setPlace(p)}>{p}</button>)}
            </div>
          </div>
          <label className="field"><span>Anything else <small>· optional</small></span>
            <textarea className="ta" placeholder="What happened, what you've tried" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="fr"><span className="tx"><span>It's urgent</span><small>Unsafe, or we can't serve without it</small></span><Toggle label="It's urgent" checked={urgent} onChange={setUrgent} /></div>
        </section>
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={issues.length > 0} onClick={() => {
          report({ title: title.trim(), place, note: note.trim(), urgent, reportedBy: user?.name ?? 'Staff' });
          navigate('/', { state: { reported: true } });
        }}>Send to the manager</button>
      </Foot>
    </main>
  );
}
