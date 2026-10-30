import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { COMPLAINT_ACTIONS, COMPLAINT_KINDS, complaintProblem } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { useFoodSafety } from '../lib/food-safety';
import { now } from '../lib/clock';
import { ChipPicker, ChipRadio, Foot, Nav, Toggle } from '../components/ui';

/** Record a complaint with its evidence. The customer's contact is only kept if they say yes. */
export default function FsComplaintNew() {
  const navigate = useNavigate();
  const [q] = useSearchParams();
  const { user } = useAuth();
  const { addComplaint } = useFoodSafety();
  const [kind, setKind] = useState(q.get('kind') ?? '');
  const [dish, setDish] = useState('');
  const [batch, setBatch] = useState('');
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState(0);
  const [itemKept, setItemKept] = useState(false);
  const [actions, setActions] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [contact, setContact] = useState('');
  const problem = complaintProblem({ kind, details, actions, contactConsent: consent, customerContact: contact });

  return (
    <main className="page">
      <Nav back="/food-safety/complaints" backLabel="Cancel" title="New complaint" />
      <div className="body form">
        <section className="grp">
          <div className="gh"><h2>What happened</h2></div>
          <div className="chips" role="radiogroup" aria-label="What happened">
            {COMPLAINT_KINDS.map((k) => <ChipRadio key={k} checked={kind === k} onClick={() => setKind(k)}>{k}</ChipRadio>)}
          </div>
          <div className="sub">
            <label className="fr"><span>Dish</span><input className="in wide-in" aria-label="Dish" placeholder="e.g. Sinigang" value={dish} onChange={(e) => setDish(e.target.value)} /></label>
            <label className="fr"><span className="tx"><span>Batch</span><small>So the rest can be checked</small></span><input className="in wide-in" aria-label="Batch" placeholder="e.g. Pot 2" value={batch} onChange={(e) => setBatch(e.target.value)} /></label>
          </div>
          <textarea className="ta" aria-label="Details" placeholder="What did the customer say or find?" value={details} onChange={(e) => setDetails(e.target.value)} />
        </section>
        <section className="grp">
          <div className="gh"><h2>Evidence</h2></div>
          <div className="sub">
            <div className="fr"><span className="tx"><span>Photos</span><small>The item and the dish</small></span><span className="chips">{[0, 1, 2, 3].map((n) => <button key={n} type="button" className="chip" aria-pressed={photos === n} onClick={() => setPhotos(n)}>{n}</button>)}</span></div>
            <div className="fr"><span>Item kept, bagged and labelled</span><Toggle label="Item kept" checked={itemKept} onChange={setItemKept} /></div>
            <div className="fr"><span className="tx"><span>Customer is happy to be contacted</span><small>Only then do we keep their details</small></span><Toggle label="Customer agreed to be contacted" checked={consent} onChange={(v) => { setConsent(v); if (!v) setContact(''); }} /></div>
            {consent && <label className="fr"><span>Phone or email</span><input className="in wide-in" aria-label="Customer contact" value={contact} onChange={(e) => setContact(e.target.value)} /></label>}
          </div>
        </section>
        <section className="grp">
          <div className="gh"><h2>What we did</h2></div>
          <ChipPicker options={COMPLAINT_ACTIONS} picked={actions} onChange={setActions} />
        </section>
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={Boolean(problem)} onClick={() => {
          addComplaint({ at: now().toISOString(), kind, dish: dish.trim(), batch: batch.trim(), details: details.trim(), photos, itemKept, actions, customerContact: consent && contact.trim() ? contact.trim() : null, by: user?.name ?? 'Manager' });
          navigate('/food-safety/complaints');
        }}>Send to head office</button>
        {problem && <p className="note">{problem}</p>}
      </Foot>
    </main>
  );
}
