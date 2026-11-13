/**
 * Report an accident (HS3): four short steps anyone can do straight after. The manager is asked a week
 * later how the person is; more than 7 days off means an HSE report within 15 days (RIDDOR).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { ACCIDENT_WHAT, ACCIDENT_WHERE, ACCIDENT_WHO, FIRST_AID } from '@maginhawa/core';
import { recordedAs, useAuth } from '../lib/auth';
import { useOps } from '../lib/ops';
import { useChecklists } from '../lib/checklists';
import { now } from '../lib/clock';
import { Foot, Icon, Nav } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

type Who = (typeof ACCIDENT_WHO)[number];
type What = (typeof ACCIDENT_WHAT)[number];
type Where = (typeof ACCIDENT_WHERE)[number];
type Aid = (typeof FIRST_AID)[number];

function Chips<T extends string>({ label, options, value, onPick }: { label: string; options: readonly T[]; value: T | ''; onPick: (v: T) => void }) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => <button key={o} type="button" role="radio" aria-checked={o === value} className="chip" aria-pressed={o === value} onClick={() => onPick(o)}>{o}</button>)}
    </div>
  );
}

export default function SafetyAccident() {
  const { user } = useAuth();
  const ops = useOps();
  const { businessDate } = useChecklists();
  const [step, setStep] = useState(0);
  const [who, setWho] = useState<Who | ''>('');
  const [name, setName] = useState('');
  const [what, setWhat] = useState<What | ''>('');
  const [detail, setDetail] = useState('');
  const [injury, setInjury] = useState<Where | ''>('');
  const [aid, setAid] = useState<Aid | ''>('');
  const [sent, setSent] = useState(false);
  if (!user) return null;
  const ok = [!!who && name.trim().length > 1, !!what && detail.trim().length > 2, !!injury && !!aid, true][step]!;
  const label = ['Next', 'Next', 'Check it', 'Send to manager'][step]!;

  return (
    <main className="page">
      <Nav back="/safety" backLabel="Health and safety" title={`Report an accident · ${step + 1} of 4`} />
      <div className="body stk-body">
        <div className="stk-segs">{[0, 1, 2, 3].map((k) => <span key={k} className={k <= step ? 'on' : ''} />)}</div>
        {step === 0 && <div className="sf-q"><p className="sf-question">Who was hurt?</p><Chips label="Who" options={ACCIDENT_WHO} value={who} onPick={setWho} />
          <input className="in wide sf-in" aria-label="Their name" placeholder="Their name" value={name} onChange={(e) => setName(e.target.value)} /></div>}
        {step === 1 && <div className="sf-q"><p className="sf-question">What happened?</p><Chips label="What happened" options={ACCIDENT_WHAT} value={what} onPick={setWhat} />
          <input className="in wide sf-in" aria-label="Where, and a few words" placeholder="Where, and a few words" value={detail} onChange={(e) => setDetail(e.target.value)} /></div>}
        {step === 2 && <div className="sf-q"><p className="sf-question">Where is the injury?</p><Chips label="Injury" options={ACCIDENT_WHERE} value={injury} onPick={setInjury} />
          <p className="sf-question sm">First aid given?</p><Chips label="First aid" options={FIRST_AID} value={aid} onPick={setAid} /></div>}
        {step === 3 && (
          <>
            <div className="hero stk-hero" role="status">
              <span className="hl">Accident · today</span>
              <span className="stk-title">{what} · {String(injury).toLowerCase()}</span>
              <span className="stk-sub">{name} ({String(who).toLowerCase()}) · {detail} · first aid: {String(aid).toLowerCase()}</span>
            </div>
            <div className="banner"><Icon d={ICONS.bang} size={16} /><span>If they're off work or can't do their normal job for <b>more than 7 days</b>, it must be reported to the HSE within 15 days. Your manager is asked to check in a week.</span></div>
          </>
        )}
      </div>
      <Foot>
        {sent ? (
          <><Link className="btn b1" to="/safety">Done</Link><p className="note t-ok">Sent to your manager. Only managers see personal details.</p></>
        ) : (
          <>
            <button type="button" className="btn b1" disabled={!ok} onClick={() => {
              if (step < 3) return setStep(step + 1);
              ops.addAccident({ businessDate, at: now().toISOString(), who: who as Who, name: name.trim(), what: what as What, detail: detail.trim(), injury: injury as Where, firstAid: aid as Aid, reportedBy: recordedAs(user) });
              setSent(true);
            }}>{label}</button>
            {step > 0 && <button type="button" className="stk-link center" onClick={() => setStep(step - 1)}>Back</button>}
          </>
        )}
      </Foot>
    </main>
  );
}
