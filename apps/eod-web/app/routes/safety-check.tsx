/**
 * A health and safety check, one yes / no question at a time (HS2). Any "No" raises an urgent repair and
 * tells head office. The record keeps who, when and every answer.
 */
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { callPointFor, SAFETY_CHECKS, type SafetyCheckKind } from '@maginhawa/core';
import { recordedAs, useAuth } from '../lib/auth';
import { useOps } from '../lib/ops';
import { useSite } from '../lib/site';
import { useChecklists } from '../lib/checklists';
import { now } from '../lib/clock';
import { hm } from '../lib/food-safety';
import { Foot, Icon, Nav } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

const QUESTIONS: Record<SafetyCheckKind, { q: string; hint: string }[]> = {
  'fire-alarm': [
    { q: 'Did the alarm sound everywhere, including the bar and the office?', hint: 'Ask someone at the far end of the building.' },
    { q: 'Did the panel show the right zone?', hint: 'The panel is by the front door.' },
  ],
  'emergency-lights': [{ q: 'Did every emergency light come on with the test switch?', hint: 'Walk the route to every exit.' }],
  extinguishers: [{ q: 'Is every extinguisher in place, pin in, gauge in the green?', hint: 'Including the kitchen fire blanket.' }],
  'first-aid': [{ q: 'Is the first aid kit stocked, with everything in date?', hint: 'Blue plasters, burns gel, gloves.' }],
};

export default function SafetyCheck() {
  const { kind = '' } = useParams();
  const { user } = useAuth();
  const ops = useOps();
  const { report } = useSite();
  const { businessDate } = useChecklists();
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  if (!user || !(kind in SAFETY_CHECKS)) return <Navigate to="/safety" replace />;
  const k = kind as SafetyCheckKind;
  const info = SAFETY_CHECKS[k];
  const qs = QUESTIONS[k];
  const point = k === 'fire-alarm' ? callPointFor(ops.data.callPoints[user.siteCode] ?? [], businessDate) : '';
  const i = answers.length;
  const done = i >= qs.length;
  const failed = answers.includes(false);

  const answer = (yes: boolean) => {
    const next = [...answers, yes];
    setAnswers(next);
    if (next.length < qs.length) return;
    const by = recordedAs(user);
    ops.addSafetyCheck({ kind: k, businessDate, at: now().toISOString(), by, ...(point ? { callPoint: point } : {}), answers: qs.map((x, n) => ({ q: x.q, yes: next[n]! })) });
    if (next.includes(false)) report({ title: `${info.title} failed`, place: 'Other', note: qs.filter((_, n) => !next[n]).map((x) => x.q).join(' '), urgent: true, reportedBy: by });
    setSavedAt(now().toISOString());
  };

  return (
    <main className="page">
      <Nav back="/safety" backLabel="Health and safety" title={`${info.title}${done ? '' : ` · ${i + 1} of ${qs.length}`}`} />
      <div className="body stk-body">
        <div className="hero stk-hero stk-item">
          <span className="hl">{k === 'fire-alarm' ? 'This week' : info.every === 'week' ? 'Weekly' : 'Monthly'}</span>
          <span className="stk-title">{k === 'fire-alarm' ? `Call point ${point.split(',')[0]}` : info.title}</span>
          {k === 'fire-alarm' && <span className="stk-sub">{point.split(', ').slice(1).join(', ')}. Use the test key.</span>}
        </div>
        {!done ? (
          <div className="sf-q">
            <p className="sf-question">{qs[i]!.q}</p>
            <div className="sf-yn">
              <button type="button" className="sf-btn" onClick={() => answer(true)}>Yes</button>
              <button type="button" className="sf-btn" onClick={() => answer(false)}>No</button>
            </div>
            <p className="lead">{qs[i]!.hint}</p>
          </div>
        ) : (
          <section className="grp" aria-label="Logged">
            <div className="hd"><h2>Logged</h2><span>{savedAt ? hm(savedAt) : ''} · {recordedAs(user)}</span></div>
            <div className="sub">
              {qs.map((x, n) => <div className="li" key={x.q}><span className="tx"><span>{x.q}</span><small className={answers[n] ? 't-ok' : 't-bad'}>{answers[n] ? 'Yes' : 'No'}</small></span></div>)}
            </div>
            {failed && <div className="banner bad" role="alert"><Icon d={ICONS.bang} size={16} /><span>Urgent repair raised and head office told. Call your fire or safety contractor today.</span></div>}
          </section>
        )}
      </div>
      {done && <Foot><Link className="btn b1" to="/safety">Done</Link></Foot>}
    </main>
  );
}
