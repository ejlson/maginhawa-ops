import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ANSWER_LABELS, ANSWER_TYPES, canFail, changeType, checkpointIssues, type AnswerValue, type Checkpoint } from '@maginhawa/core';
import { editPath, useListEditor } from '../lib/templates';
import { Answer } from '../components/Answer';
import { Foot, Icon, ICONS, Nav, Toggle } from '../components/ui';

/** Common limits to start from. Example values: each site checks its own. */
const TEMP_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Fridge · 8°C or below', max: 8 },
  { label: 'Freezer · −18°C or below', max: -18 },
  { label: 'Hot holding · 63°C or above', min: 63 },
];

const parseNum = (s: string): number | undefined => {
  const n = parseFloat(s.replace('−', '-').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

/** A number field that keeps what was typed ("-", "8.") while storing a number or nothing. */
function LimitInput({ label, value, onChange, unit }: { label: string; value: number | undefined; onChange: (n: number | undefined) => void; unit: string }) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const [last, setLast] = useState(value);
  if (value !== last) { setLast(value); if (parseNum(text) !== value) setText(value === undefined ? '' : String(value)); }
  return (
    <label className="fr"><span className="tx"><span>{label}</span><small>Leave blank for no limit</small></span>
      <input className="in" type="text" inputMode="decimal" aria-label={label} placeholder={unit || 'None'} value={text}
        onChange={(e) => { setText(e.target.value); onChange(parseNum(e.target.value)); }} />
    </label>
  );
}

/** Edits one check: the question, the kind of answer, its pass rule, and a preview of what staff see. */
export default function ChecklistCheck() {
  const navigate = useNavigate();
  const { id: rawId = '', check: rawCheck = '' } = useParams();
  const id = decodeURIComponent(rawId);
  const checkId = decodeURIComponent(rawCheck);
  const { template: t, status, editable, edit, businessDate } = useListEditor(id);
  const [preview, setPreview] = useState<AnswerValue>(null);
  const [removing, setRemoving] = useState(false);
  const index = t?.checkpoints.findIndex((c) => c.id === checkId) ?? -1;
  if (!t || index < 0 || !editable) return <Navigate to={editPath(id)} replace />;
  const c = t.checkpoints[index]!;
  const set = (change: Partial<Checkpoint>) => edit((d) => ({ ...d, checkpoints: d.checkpoints.map((x) => (x.id === checkId ? { ...x, ...change } : x)) }));
  const replace = (next: Checkpoint) => edit((d) => ({ ...d, checkpoints: d.checkpoints.map((x) => (x.id === checkId ? next : x)) }));
  const issues = checkpointIssues(c, index + 1);
  const sections = [...new Set(t.checkpoints.map((x) => x.section).filter(Boolean))] as string[];
  const options = c.options ?? [];
  const setOption = (i: number, v: string | null) => set({ options: v === null ? options.filter((_, j) => j !== i) : options.map((o, j) => (j === i ? v : o)) });

  return (
    <main className="page">
      <Nav back={editPath(id)} backLabel={t.title || 'Checklist'} title={`Check ${index + 1} of ${t.checkpoints.length}`} right={status === 'new' || status === 'draft' ? <span className="saved"><span className="dot warn" />Draft saved</span> : undefined} />
      <div className="body form">
        <div className="hero preview" aria-label="Preview">
          <span className="hl">Staff will see this · try it, nothing is saved</span>
          <div className="qrow">
            <Answer c={{ ...c, title: c.title || 'Your question' }} value={preview ?? undefined} set={setPreview} today={businessDate} disabled={false} />
          </div>
        </div>
        {issues.length > 0 && <ul className="issues">{issues.map((x) => <li key={x}><Icon d={ICONS.bang} size={16} />{x}</li>)}</ul>}

        <section className="grp">
          <label className="field"><span>Question</span>
            <input className="in" placeholder="e.g. Walk-in fridge" autoFocus={!c.title} value={c.title} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label className="field"><span>Help text <small>· optional</small></span>
            <input className="in" placeholder="e.g. Probe the middle" value={c.help ?? ''} onChange={(e) => set({ help: e.target.value })} />
          </label>
          <label className="field"><span>Heading <small>· optional, groups checks together</small></span>
            <input className="in" placeholder="e.g. Temperatures" list="sections" value={c.section ?? ''} onChange={(e) => set({ section: e.target.value })} />
            <datalist id="sections">{sections.map((x) => <option key={x} value={x} />)}</datalist>
          </label>
        </section>

        <section className="grp">
          <div className="gh"><h2>Kind of answer</h2></div>
          <div className="chips" role="radiogroup" aria-label="Answer type">
            {ANSWER_TYPES.map((type) => <button key={type} type="button" className="chip" role="radio" aria-checked={c.type === type} aria-pressed={c.type === type} onClick={() => { replace(changeType(c, type)); setPreview(null); }}>{ANSWER_LABELS[type]}</button>)}
          </div>

          {c.type === 'yesno' && (
            <div className="sub">
              <div className="sl"><span>Which answer is a fail?</span></div>
              <div className="chips" role="radiogroup" aria-label="Which answer is a fail?">
                {([['no', 'No'], ['yes', 'Yes'], [undefined, 'Neither']] as const).map(([v, l]) => <button key={l} type="button" className="chip" role="radio" aria-checked={c.failOn === v} aria-pressed={c.failOn === v} onClick={() => set({ failOn: v, ...(v ? {} : { faultOnFail: false }) })}>{l}</button>)}
              </div>
            </div>
          )}

          {(c.type === 'temp' || c.type === 'number') && (
            <div className="sub">
              <div className="sl"><span>Pass if between</span>{c.type === 'temp' && <span>Example values · check your own</span>}</div>
              {c.type === 'temp' && (
                <div className="chips" style={{ marginBottom: 8 }}>
                  {TEMP_PRESETS.map((p) => <button key={p.label} type="button" className="chip" aria-pressed={c.min === p.min && c.max === p.max} onClick={() => set({ min: p.min, max: p.max })}>{p.label}</button>)}
                </div>
              )}
              {c.type === 'number' && (
                <label className="fr"><span className="tx"><span>Unit</span><small>e.g. £, kg, pH</small></span>
                  <input className="in" aria-label="Unit" placeholder="None" value={c.unit ?? ''} onChange={(e) => set({ unit: e.target.value || undefined })} />
                </label>
              )}
              <LimitInput label="Lowest" unit={c.type === 'temp' ? '°C' : c.unit ?? ''} value={c.min} onChange={(min) => set({ min })} />
              <LimitInput label="Highest" unit={c.type === 'temp' ? '°C' : c.unit ?? ''} value={c.max} onChange={(max) => set({ max })} />
            </div>
          )}

          {c.type === 'choice' && (
            <div className="sub" style={{ gap: 10 }}>
              <div className="sl"><span>Options</span><span>{options.filter((o) => o.trim()).length}</span></div>
              {options.map((o, i) => (
                <div className="optrow" key={i}>
                  <input className="in" aria-label={`Option ${i + 1}`} placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOption(i, e.target.value)} />
                  <button type="button" className="mini" aria-label={`Remove option ${i + 1}`} disabled={options.length <= 2} onClick={() => setOption(i, null)}><Icon d={ICONS.x} size={16} /></button>
                </div>
              ))}
              <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={() => set({ options: [...options, ''] })}>+ Add option</button>
              <div className="fr"><span className="tx"><span>Can pick more than one</span></span><Toggle label="Can pick more than one" checked={Boolean(c.multi)} onChange={(multi) => set({ multi })} /></div>
            </div>
          )}

          {c.type === 'date' && (
            <div className="sub">
              <div className="fr"><span className="tx"><span>Fail if the date has passed</span><small>Good for use-by dates</small></span><Toggle label="Fail if the date has passed" checked={Boolean(c.failIfPast)} onChange={(failIfPast) => set({ failIfPast, ...(failIfPast ? {} : { faultOnFail: false }) })} /></div>
            </div>
          )}

          {(c.type === 'text' || c.type === 'photo' || c.type === 'sign') && <p className="typedesc">No pass or fail: staff just {c.type === 'text' ? 'write a note' : c.type === 'photo' ? 'take a photo' : 'sign'}.</p>}
        </section>

        <section className="grp">
          <div className="gh"><h2>Rules</h2></div>
          <div className="sub">
            <div className="fr"><span className="tx"><span>Must be answered</span><small>The list can't be finished without it</small></span><Toggle label="Must be answered" checked={c.required} onChange={(required) => set({ required })} /></div>
            {canFail(c) && <div className="fr"><span className="tx"><span>Report a fault if it fails</span><small>Offers a repair job, e.g. for a broken fridge</small></span><Toggle label="Report a fault if it fails" checked={Boolean(c.faultOnFail)} onChange={(faultOnFail) => set({ faultOnFail })} /></div>}
          </div>
        </section>

        <button type="button" className="linkbtn" style={{ color: 'var(--bad)', alignSelf: 'flex-start', minHeight: 44 }} onClick={() => {
          if (!removing) return setRemoving(true);
          navigate(editPath(id));
          edit((d) => ({ ...d, checkpoints: d.checkpoints.filter((x) => x.id !== checkId) }));
        }}>{removing ? 'Tap again to remove' : 'Remove this check'}</button>
      </div>
      <Foot>
        <button type="button" className="btn b1" onClick={() => navigate(editPath(id))}>Done</button>
      </Foot>
    </main>
  );
}
