import { useState } from 'react';
import { backToWorkAt, EXCLUSION_HOURS } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { useFoodSafety } from '../lib/food-safety';
import { now } from '../lib/clock';
import { Foot, Icon, ICONS, Nav, Toggle } from '../components/ui';

/** The question before a shift (HANDOFF.md §8a, item 9). Only managers see the answers. */
export default function FsFit() {
  const { user } = useAuth();
  const { addFitness } = useFoodSafety();
  const [ill, setIll] = useState<boolean | null>(null);
  const [stillIll, setStillIll] = useState(false);
  const [stopped, setStopped] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const at = now();

  const save = () => {
    if (ill === null || !user) return;
    const stoppedAt = ill && !stillIll && stopped ? new Date(stopped).toISOString() : null;
    const a = { person: user.name, at: at.toISOString(), ill, stoppedAt };
    addFitness(a);
    const back = backToWorkAt(a, at);
    setResult(back
      ? `Please don't work today. You can come back from ${back.toLocaleString('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}. Your manager has been told.`
      : "Thanks. You're fit to work.");
  };

  return (
    <main className="page">
      <Nav back="/food-safety" backLabel="Food safety" title="Fit to work" />
      <div className="body form">
        <div className="titleblock">
          <h1>Before your shift</h1>
          <p className="lead">Only your manager sees this answer.</p>
        </div>
        {result ? (
          <div className="banner" role="status"><Icon d={ill ? ICONS.bang : ICONS.check} size={16} /><span>{result}</span></div>
        ) : (
          <section className="grp">
            <div className="gh"><h2>In the last {EXCLUSION_HOURS} hours, have you been sick or had diarrhoea?</h2></div>
            <div className="chips" role="radiogroup" aria-label="Sick or diarrhoea">
              <button type="button" role="radio" className="chip" aria-checked={ill === false} aria-pressed={ill === false} onClick={() => setIll(false)}>No</button>
              <button type="button" role="radio" className="chip" aria-checked={ill === true} aria-pressed={ill === true} onClick={() => setIll(true)}>Yes</button>
            </div>
            {ill && (
              <div className="sub">
                <div className="fr"><span>I still have symptoms</span><Toggle label="Still have symptoms" checked={stillIll} onChange={setStillIll} /></div>
                {!stillIll && <label className="fr"><span>They stopped at</span><input className="in wide-in" type="datetime-local" aria-label="Symptoms stopped at" value={stopped} onChange={(e) => setStopped(e.target.value)} /></label>}
              </div>
            )}
          </section>
        )}
      </div>
      {!result && <Foot><button type="button" className="btn b1" disabled={ill === null || (ill && !stillIll && !stopped)} onClick={save}>Send</button></Foot>}
    </main>
  );
}
