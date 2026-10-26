import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { evaluate, FIX_ACTIONS, ruleText, validFix } from '@maginhawa/core';
import { runPath, useChecklists } from '../lib/checklists';
import { now } from '../lib/clock';
import { Foot, Nav, Toggle } from '../components/ui';

/** Fix a failed check: what was done, any food thrown away, when to re-check, and a fault report. */
export default function ChecklistFix() {
  const navigate = useNavigate();
  const { key: raw = '', checkpoint = '' } = useParams();
  const key = decodeURIComponent(raw);
  const { templateFor, runFor, fix, businessDate } = useChecklists();
  const c = templateFor(key)?.checkpoints.find((x) => x.id === checkpoint);
  const value = runFor(key)?.answers[checkpoint];
  const [actions, setActions] = useState<string[]>([]);
  const [food, setFood] = useState(false);
  const [note, setNote] = useState('');
  const [mins, setMins] = useState(30);
  const [fault, setFault] = useState(Boolean(c?.faultOnFail));
  if (!c) return <Navigate to={runPath(key)} replace />;
  const e = evaluate(c, value, businessDate);
  const dueAt = new Date(now().getTime() + mins * 60_000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const ok = validFix({ actions, recheckInMinutes: mins });

  return (
    <main className="page">
      <Nav back={runPath(key)} backLabel="Back" title="Fix a failed check" />
      <div className="body">
        <div className="hero">
          <span className="hl">{c.title}</span>
          <div className="big"><b className="h-bad">{typeof value === 'number' ? String(value).replace('-', '−') : e.reason}</b>{c.type === 'temp' && <i>°C</i>}</div>
          <span className="hs-small">{ruleText(c) ? `Should be ${ruleText(c).toLowerCase()}.` : e.reason}</span>
        </div>
        <section className="grp">
          <div className="gh"><h2>What did you do?</h2><p>Pick everything that applies.</p></div>
          <div className="chips">
            {FIX_ACTIONS.map((a) => (
              <button key={a} type="button" className="chip" aria-pressed={actions.includes(a)} onClick={() => setActions((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]))}>{a}</button>
            ))}
          </div>
          <textarea className="ta" aria-label="Anything else" placeholder="Anything else? e.g. door was propped open during delivery" value={note} onChange={(ev) => setNote(ev.target.value)} />
        </section>
        <section className="grp">
          <div className="gh"><h2>Food</h2></div>
          <div className="sub">
            <div className="fr"><span className="tx"><span>Did any food go in the bin?</span><small>Follow your safe method</small></span><Toggle label="Food went in the bin" checked={food} onChange={setFood} /></div>
          </div>
        </section>
        <section className="grp">
          <div className="gh"><h2>Re-check</h2><p>It appears in today's checklists when it's due.</p></div>
          <div className="sub">
            <div className="fr"><span>Check again in</span>
              <span className="chips" role="radiogroup" aria-label="Re-check in">
                {[15, 30, 60].map((m) => <button key={m} type="button" className="chip" aria-pressed={mins === m} onClick={() => setMins(m)}>{m} min</button>)}
              </span>
            </div>
            <div className="fr"><span className="muted">Due</span><span style={{ fontWeight: 600 }}>{dueAt}</span></div>
          </div>
        </section>
        {c.faultOnFail && (
          <section className="grp">
            <div className="gh"><h2>Repair</h2></div>
            <div className="sub"><div className="fr"><span className="tx"><span>Report a fault</span><small>Head office sees it straight away</small></span><Toggle label="Report a fault" checked={fault} onChange={setFault} /></div></div>
          </section>
        )}
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={!ok} onClick={() => { fix(key, c.id, { actions, foodDisposed: food, note, recheckInMinutes: mins, reportFault: fault }); navigate(runPath(key)); }}>Save and set re-check</button>
        <p className="note">{ok ? 'Your manager sees this straight away.' : 'Pick at least one thing you did.'}</p>
      </Foot>
    </main>
  );
}
