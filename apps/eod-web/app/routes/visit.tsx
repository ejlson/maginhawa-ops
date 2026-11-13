/**
 * Log a contractor's visit (PM3): how it went and the certificate. Saving needs both. A failed visit
 * raises a repair and tells head office; a pass sets the next date.
 */
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { addMonths, type VisitResult } from '@maginhawa/core';
import { recordedAs, useAuth } from '../lib/auth';
import { useOps } from '../lib/ops';
import { useSite } from '../lib/site';
import { useChecklists } from '../lib/checklists';
import { dayText } from '../lib/stock-helpers';
import { Foot, Icon, Nav } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

const RESULTS: VisitResult[] = ['Passed', 'Passed with advice', 'Failed'];

export default function Visit() {
  const { schedule = '' } = useParams();
  const { user } = useAuth();
  const ops = useOps();
  const { report } = useSite();
  const { businessDate: today } = useChecklists();
  const navigate = useNavigate();
  const [result, setResult] = useState<VisitResult | ''>('');
  const [cert, setCert] = useState<string | null>(null);
  const s = ops.data.schedules.find((x) => x.id === schedule);
  if (!user || !s) return <Navigate to="/maintenance" replace />;
  const ready = !!result && !!cert;
  const next = addMonths(today, s.everyMonths);

  return (
    <main className="page">
      <Nav back="/maintenance" backLabel="Maintenance" title="Log a visit" />
      <div className="body">
        <div className="hero stk-hero">
          <span className="hl">Today · {new Date(`${today}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
          <span className="stk-title">{s.name}</span>
          <span className="stk-sub">{s.contractor}</span>
        </div>
        <div>
          <div className="lab">How did it go?</div>
          <div className="chips" role="radiogroup" aria-label="How did it go?">
            {RESULTS.map((r) => <button key={r} type="button" role="radio" aria-checked={r === result} className="chip" aria-pressed={r === result} onClick={() => setResult(r)}>{r}</button>)}
          </div>
          {result === 'Failed' && <div className="banner bad" style={{ marginTop: 12 }}><Icon d={ICONS.bang} size={16} /><span>A repair will be raised for the engineer's notes, and head office told.</span></div>}
        </div>
        <div>
          <div className="lab">Certificate</div>
          {cert ? (
            <div className="li"><span className="av"><Icon d={ICONS.list} /></span><span className="tx"><span>{cert}</span><small>Added just now</small></span><span className="rt"><button type="button" className="chip" onClick={() => setCert(null)}>Remove</button></span></div>
          ) : (
            <label className="visit-drop"><Icon d={ICONS.plus} size={18} />Photo or PDF of the certificate
              <input type="file" accept="image/*,application/pdf" aria-label="Photo or PDF of the certificate" onChange={(e) => setCert(e.target.files?.[0]?.name ?? null)} />
            </label>
          )}
        </div>
        {result && result !== 'Failed' && <p className="lead">Next due {dayText(next, today)} {next.slice(0, 4)} · reminder 30 days before</p>}
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={!ready} onClick={() => {
          const by = recordedAs(user);
          ops.logVisit({ scheduleId: s.id, result: result as VisitResult, certificate: cert, by });
          if (result === 'Failed') report({ title: `${s.name} failed`, place: 'Kitchen', note: `${s.contractor}: see the certificate`, urgent: true, reportedBy: by });
          navigate('/maintenance');
        }}>Save visit</button>
        <p className="note">{!result ? 'Pick how it went' : !cert ? 'Add the certificate: inspectors and the insurer ask for it' : 'Saved with the certificates'}</p>
      </Foot>
    </main>
  );
}
