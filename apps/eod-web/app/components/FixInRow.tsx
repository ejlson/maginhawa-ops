/**
 * Deal with a failed check right where it failed: one question, four likely answers, the re-check
 * already set, and a fault report one switch away. Replaces the separate Fix page for the list.
 */
import { useState } from 'react';
import { FIX_ACTIONS, validFix, type Checkpoint } from '@maginhawa/core';
import { useChecklists } from '../lib/checklists';
import { useAuth } from '../lib/auth';
import { useSite } from '../lib/site';
import { timeHM } from '../lib/draft';
import { now } from '../lib/clock';
import { Icon, Toggle } from './ui';
import { ICONS, toggled } from './ui-helpers';
import { fixChoices } from './checklist-run-helpers';

const RECHECK = [15, 30, 60];
const BIN = 'Threw the food away';

export function FixInRow({ runKey, c, reason }: { runKey: string; c: Checkpoint; reason: string }) {
  const { fix } = useChecklists();
  const { user } = useAuth();
  const { report } = useSite();
  const [actions, setActions] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const [mins, setMins] = useState(30);
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState('');
  const [fault, setFault] = useState(Boolean(c.faultOnFail));
  const shown = more ? [...FIX_ACTIONS] : fixChoices(c, FIX_ACTIONS);
  const ok = validFix({ actions, recheckInMinutes: mins });
  const dueAt = timeHM(new Date(now().getTime() + mins * 60_000));

  const save = () => {
    // "Threw the food away" is the food question: no separate switch to forget.
    fix(runKey, c.id, { actions, foodDisposed: actions.includes(BIN), note: note.trim(), recheckInMinutes: mins, reportFault: fault });
    // A fault becomes a repair job the manager sees on their home screen.
    if (fault) report({ title: `${c.title}: ${reason.toLowerCase()}`, place: 'Kitchen', note: [actions.join(', '), note.trim()].filter(Boolean).join('. '), urgent: false, reportedBy: user?.name ?? 'Staff', from: { runKey, checkpointId: c.id } });
  };

  return (
    <div className="fixrow" role="group" aria-label={`Fix ${c.title}`}>
      <p className="fixrow-q"><b>{reason}</b><span>What did you do?</span></p>
      <div className="fixrow-tiles">
        {shown.map((a) => (
          <button key={a} type="button" className="fixtile" aria-pressed={actions.includes(a)} onClick={() => setActions((x) => toggled(x, a))}>
            {actions.includes(a) && <Icon d={ICONS.check} size={14} />}<span>{a}</span>
          </button>
        ))}
      </div>
      {!more && FIX_ACTIONS.length > shown.length && <button type="button" className="fixrow-link" onClick={() => setMore(true)}>More options</button>}
      <input className="in wide fixrow-note" aria-label="Anything else" placeholder="Anything else? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

      <div className="fixrow-line">
        <span><Icon d={ICONS.clock} size={16} />Check again at {dueAt}</span>
        {!changing && <button type="button" className="fixrow-link" onClick={() => setChanging(true)}>Change</button>}
      </div>
      {changing && (
        <div className="chips" role="radiogroup" aria-label="Re-check in">
          {RECHECK.map((m) => <button key={m} type="button" className="chip" aria-pressed={mins === m} onClick={() => { setMins(m); setChanging(false); }}>{m} min</button>)}
        </div>
      )}
      {c.faultOnFail && (
        <div className="fixrow-line">
          <span><Icon d={ICONS.wrench} size={16} />Report a fault to Repairs</span>
          <Toggle label="Report a fault" checked={fault} onChange={setFault} />
        </div>
      )}
      <button type="button" className="btn b1 fixrow-save" disabled={!ok} onClick={save}>{ok ? 'Save what you did' : 'Pick what you did'}</button>
    </div>
  );
}
