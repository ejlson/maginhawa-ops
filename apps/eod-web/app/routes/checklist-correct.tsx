import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { correctionProblem, type AnswerValue } from '@maginhawa/core';
import { runPath, useChecklists } from '../lib/checklists';
import { can, useAuth } from '../lib/auth';
import { Foot, Nav } from '../components/ui';
import { Answer } from '../components/Answer';

/**
 * Correct an answer on a finished checklist (HANDOFF.md §8a, item 1). The old answer, the reason,
 * who and the server's time are all kept, so the record still shows what was first written down.
 */
export default function ChecklistCorrect() {
  const navigate = useNavigate();
  const { key: raw = '', checkpoint = '' } = useParams();
  const key = decodeURIComponent(raw);
  const { user } = useAuth();
  const { templateFor, runFor, correct, businessDate } = useChecklists();
  const c = templateFor(key)?.checkpoints.find((x) => x.id === checkpoint);
  const run = runFor(key);
  const previous = run?.answers[checkpoint];
  const [value, setValue] = useState<AnswerValue>(null);
  const [reason, setReason] = useState('');
  if (!c || !run?.completedAt || previous === undefined || !user || !can.correctRecords(user.role)) return <Navigate to={runPath(key)} replace />;
  const problem = correctionProblem({ previous, value, reason });
  const shown = (v: AnswerValue | undefined) => (typeof v === 'number' ? `${String(v).replace('-', '−')}${c.type === 'temp' ? '°C' : ''}` : v === true ? 'Yes' : v === false ? 'No' : String(v ?? ''));

  return (
    <main className="page">
      <Nav back={runPath(key)} backLabel="Cancel" title="Correct an answer" />
      <div className="body form">
        <div className="hero">
          <span className="hl">{c.title} · answered by {run.answeredBy?.[checkpoint]?.by ?? 'someone'}</span>
          <div className="big"><b>{shown(previous)}</b></div>
          <span className="hs-small">This stays on the record. Your correction is added after it.</span>
        </div>
        <section className="grp">
          <div className="gh"><h2>The right answer</h2></div>
          <div className="sub"><Answer c={c} value={value ?? undefined} set={setValue} today={businessDate} disabled={false} /></div>
        </section>
        <section className="grp">
          <div className="gh"><h2>Why</h2><p>Head office and inspectors see this.</p></div>
          <textarea className="ta" aria-label="Why it needs correcting" placeholder="e.g. Typed the decimal in the wrong place" value={reason} onChange={(e) => setReason(e.target.value)} />
        </section>
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={Boolean(problem)} onClick={() => { correct(key, c.id, value, reason.trim()); navigate(runPath(key)); }}>Save correction</button>
        <p className="note">{problem ?? `Saved as ${user.name}, with the time it reaches the server.`}</p>
      </Foot>
    </main>
  );
}
