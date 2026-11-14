/**
 * Add to the handover (anyone, including staff): a note for tomorrow's opener. The closer sees the team's
 * notes in the end of day report's Handover section, and the opener reads them with the closer's.
 */
import { useState } from 'react';
import { recordedAs, useAuth } from '../lib/auth';
import { HANDOVER_CATS, useSite } from '../lib/site';
import { ChipRadio, Foot, Icon, Nav } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

const PLACEHOLDERS: Record<string, string> = {
  Stock: 'e.g. Low on coconut milk, order went in for Thursday',
  Maintenance: 'e.g. Walk-in door sticks, push it shut',
  Staff: 'e.g. Ana is in at 10 instead of 9',
  Bookings: 'e.g. Party of 12 at 19:00, set up the back room',
  Other: 'Anything the next person should know',
};

export default function HandoverAdd() {
  const { user } = useAuth();
  const { teamNotes, addTeamNote, removeTeamNote } = useSite();
  const [cat, setCat] = useState(HANDOVER_CATS[0]!);
  const [body, setBody] = useState('');
  const [added, setAdded] = useState(false);
  if (!user) return null;
  const me = recordedAs(user);
  const add = () => {
    if (!body.trim()) return;
    addTeamNote(cat, body.trim(), me);
    setBody('');
    setAdded(true);
  };

  return (
    <main className="page">
      <Nav back="/" backLabel="Home" title="Add to the handover" />
      <div className="body form">
        <div className="titleblock">
          <h1>Add to the handover</h1>
          <p className="lead">Tomorrow's opener reads it first thing, with tonight's closer's notes.</p>
        </div>
        <section className="grp">
          <div className="chips" role="radiogroup" aria-label="What it's about">
            {HANDOVER_CATS.map((c) => <ChipRadio key={c} checked={cat === c} onClick={() => setCat(c)}>{c}</ChipRadio>)}
          </div>
          <textarea className="ta" aria-label="Note" placeholder={PLACEHOLDERS[cat]} value={body} onChange={(e) => { setBody(e.target.value); setAdded(false); }} />
          {added && <p className="note t-ok" role="status" style={{ margin: 0 }}>Added. Add another, or go back home.</p>}
        </section>
        {teamNotes.length > 0 && (
          <section className="grp">
            <div className="hd"><h2>Tonight so far</h2><span>{teamNotes.length}</span></div>
            <div className="sub">
              {teamNotes.map((n) => (
                <div className="li note-li" key={n.id}>
                  <span className="av"><Icon d={ICONS.chat} size={17} /></span>
                  <span className="tx"><span>{n.body}</span><small>{n.category} · {n.by === me ? 'you' : n.by}</small></span>
                  {(n.by === me || user.role !== 'staff') && <button type="button" className="linkbtn" aria-label={`Remove note: ${n.body}`} onClick={() => removeTeamNote(n.id)}>Remove</button>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={!body.trim()} onClick={add}>Add to the handover</button>
      </Foot>
    </main>
  );
}
