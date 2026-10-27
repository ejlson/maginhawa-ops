import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import {
  ANSWER_LABELS, ANSWER_TYPES, moveCheckpoint, newCheckpoint, nextDay, PHASE_LABELS, PHASES, ruleText, scheduleText, SITES,
  templateIssues, uniqueId, type AnswerType,
} from '@maginhawa/core';
import { formatDay } from '../lib/draft';
import { checkPath, useListEditor } from '../lib/templates';
import { ANSWER_ICONS, Foot, Icon, ICONS, Nav, RowLink, Toggle } from '../components/ui';

const TYPE_HINTS: Record<AnswerType, string> = {
  yesno: 'A quick tick, e.g. "Ice machine cleaned?"',
  temp: 'A °C reading with a pass range',
  number: 'Any amount with a unit: £, kg, pH, count',
  text: 'A short note or a longer comment',
  photo: 'Taken live with the camera',
  choice: 'One or several options you write',
  date: 'e.g. a use-by date',
  sign: 'Signed with a finger',
};

const WINDOWS = [15, 30, 45, 60, 90, 120];

/**
 * Builds or changes one checklist. Name at the top, the checks next, settings last.
 * Every change is saved as a draft; staff only see it once published.
 */
export default function ChecklistBuilder() {
  const navigate = useNavigate();
  const { id: raw = '' } = useParams();
  const id = decodeURIComponent(raw);
  const { rec, template: t, status, editable, edit, businessDate, user, store } = useListEditor(id);
  const [picking, setPicking] = useState(false);
  const [reorder, setReorder] = useState(false);
  const [newTime, setNewTime] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'discard' | 'stop' | null>(null);
  if (!rec || !t || !status || !user) return <Navigate to="/checklists/edit" replace />;

  const isNew = status === 'new';
  const hasDraft = isNew || status === 'draft';
  const issues = templateIssues(t);
  const where = rec.scope === 'group' ? 'Every site' : `${SITES.find((s) => s.code === rec.siteCode)?.name ?? rec.siteCode} only`;
  const n = t.checkpoints.length;
  const tomorrow = formatDay(nextDay(businessDate));
  const [statusText, statusCls] = !editable && status !== 'archived' ? ['Live', 'h-ok']
    : status === 'archived' ? ['Stopped. Staff no longer see it', '']
    : status === 'starts-tomorrow' ? [rec.versions.length > 1 ? `Changes start ${tomorrow}` : `Starts ${tomorrow}`, 'h-ok']
    : status === 'live' ? ['Live', 'h-ok']
    : issues.length ? [`${issues.length} ${issues.length === 1 ? 'thing' : 'things'} to finish`, 'h-warn']
    : [`Ready to publish · starts ${tomorrow}`, 'h-ok'];

  const addCheck = (type: AnswerType) => {
    const cid = uniqueId(type, t.checkpoints.map((c) => c.id));
    edit((d) => ({ ...d, checkpoints: [...d.checkpoints, newCheckpoint(type, cid)] }));
    setPicking(false);
    navigate(checkPath(id, cid));
  };
  /** Adds the picked time, if there is one, and closes the picker. */
  const addTime = () => {
    const x = newTime ?? '';
    if (/^\d{2}:\d{2}$/.test(x) && !t.times.includes(x)) edit((d) => ({ ...d, times: [...d.times, x].sort(), windowMinutes: d.windowMinutes || 60 }));
    setNewTime(null);
  };

  return (
    <main className="page">
      <Nav back="/checklists/edit" backLabel="Lists" title={t.title || 'New checklist'}
        right={editable && hasDraft ? <span className="saved"><span className="dot warn" />Draft saved</span> : undefined} />
      <div className="body form">
        <div className="hero" role="status">
          <span className="hl">{where}{status === 'starts-tomorrow' && rec.versions.length > 1 ? ' · today runs the old version' : ''}</span>
          <label className="title-edit">
            <input className="title-in" aria-label="Name" placeholder="Name this list" disabled={!editable} autoFocus={isNew && !t.title}
              value={t.title} onChange={(e) => edit((d) => ({ ...d, title: e.target.value }))} />
            {editable && <Icon d={ICONS.pen} size={16} />}
          </label>
          <div className="hero-row hero-foot">
            <span className={`hero-next ${statusCls}`}>{statusText}</span>
            <span className="hs-small">{n} {n === 1 ? 'check' : 'checks'} · {scheduleText(t)}</span>
          </div>
        </div>

        {!editable && status !== 'archived' && (
          <div className="banner" role="note"><Icon d={ICONS.bang} size={16} /><span>{rec.scope === 'group' ? 'Head office looks after this list. Ask them if something needs to change.' : 'You can see this list but not change it.'}</span></div>
        )}
        {editable && hasDraft && issues.length > 0 && (
          <ul className="issues" aria-label="Before you publish">{issues.map((x) => <li key={x}><Icon d={ICONS.bang} size={16} />{x}</li>)}</ul>
        )}

        <section className="grp">
          <div className="hd">
            <h2>Checks</h2>
            {editable && n > 1 && <button type="button" className="linkbtn" onClick={() => setReorder(!reorder)}>{reorder ? 'Done' : 'Reorder'}</button>}
          </div>
          <div className="sub">
            {t.checkpoints.map((c, i) => {
              const sub = [ANSWER_LABELS[c.type], ruleText(c), c.required ? null : 'Optional', c.section].filter(Boolean).join(' · ');
              const lead = <span className="av"><Icon d={ANSWER_ICONS[c.type]} /></span>;
              const title = c.title || <span className="muted">Check {i + 1} · no question yet</span>;
              if (reorder) {
                return (
                  <div className="li" key={c.id}>
                    {lead}<span className="tx"><span>{title}</span><small>{sub}</small></span>
                    <span className="rt">
                      <button type="button" className="mini" aria-label={`Move ${c.title || `check ${i + 1}`} up`} disabled={i === 0} onClick={() => edit((d) => moveCheckpoint(d, c.id, -1))}><Icon d={ICONS.up} size={16} /></button>
                      <button type="button" className="mini" aria-label={`Move ${c.title || `check ${i + 1}`} down`} disabled={i === n - 1} onClick={() => edit((d) => moveCheckpoint(d, c.id, 1))}><Icon d={ICONS.down} size={16} /></button>
                    </span>
                  </div>
                );
              }
              return <RowLink key={c.id} to={editable ? checkPath(id, c.id) : undefined} lead={lead} title={title} sub={sub} />;
            })}
            {editable && !reorder && !picking && (
              <RowLink onClick={() => setPicking(true)} lead={<span className="av dash"><Icon d={ICONS.plus} /></span>} title={<span style={{ color: 'var(--link)' }}>Add a check</span>} />
            )}
          </div>
          {picking && (
            <div className="panel" role="group" aria-label="What kind of answer?">
              <div className="hd"><h2 style={{ fontSize: 17 }}>What kind of answer?</h2><button type="button" className="linkbtn" onClick={() => setPicking(false)}>Cancel</button></div>
              <div className="sub">
                {ANSWER_TYPES.map((type) => (
                  <RowLink key={type} onClick={() => addCheck(type)} lead={<span className="av" style={{ background: 'var(--bg)' }}><Icon d={ANSWER_ICONS[type]} /></span>} title={ANSWER_LABELS[type]} sub={TYPE_HINTS[type]} />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="grp">
          <div className="gh"><h2>Who and when</h2></div>
          <label className="field"><span>Who does it</span>
            <input className="in" placeholder="e.g. Bar team" disabled={!editable} value={t.who} onChange={(e) => edit((d) => ({ ...d, who: e.target.value }))} />
          </label>
          {user.role === 'headoffice' && isNew && (
            <label className="field"><span>Which sites</span>
              <select className="in" value={rec.scope === 'group' ? '' : rec.siteCode}
                onChange={(e) => edit((d) => ({ ...d, scope: e.target.value ? 'site' : 'group', siteCode: e.target.value || undefined }))}>
                <option value="">Every site</option>
                {SITES.map((s) => <option key={s.code} value={s.code}>{s.name} only</option>)}
              </select>
            </label>
          )}
          <div className="field"><span id="phase">Part of the day</span>
            <div className="chips" role="radiogroup" aria-labelledby="phase">
              {PHASES.map((p) => <button key={p} type="button" className="chip" role="radio" aria-checked={t.phase === p} aria-pressed={t.phase === p} disabled={!editable} onClick={() => edit((d) => ({ ...d, phase: p }))}>{PHASE_LABELS[p]}</button>)}
            </div>
          </div>
          <div className="fr"><span className="tx"><span>Set times each day</span><small>Turn off for lists done when needed, like a delivery</small></span>
            <Toggle label="Set times each day" checked={t.times.length > 0} onChange={(v) => editable && edit((d) => ({ ...d, times: v ? ['09:00'] : [], windowMinutes: v ? 60 : 0 }))} />
          </div>
          {t.times.length > 0 && <>
            <div className="field"><span>Due at</span>
              <div className="chips">
                {t.times.map((x) => (
                  <button key={x} type="button" className="chip tm" disabled={!editable || t.times.length === 1} aria-label={`Remove ${x}`}
                    onClick={() => edit((d) => ({ ...d, times: d.times.filter((y) => y !== x) }))}>
                    {x}{editable && t.times.length > 1 && <Icon d={ICONS.x} size={14} />}
                  </button>
                ))}
                {editable && (newTime === null ? (
                  <button type="button" className="chip add" onClick={() => setNewTime('')}><Icon d={ICONS.plus} size={14} />Add time</button>
                ) : (
                  <span className="addrow">
                    <input className="in" type="time" aria-label="New time" autoFocus value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      onBlur={addTime}
                      onKeyDown={(e) => { if (e.key === 'Enter') addTime(); if (e.key === 'Escape') setNewTime(null); }} />
                    {newTime && <button type="button" className="chip" aria-pressed="true" onClick={addTime}>Add</button>}
                  </span>
                ))}
              </div>
            </div>
            <div className="field"><span id="window">Counts as missed after</span>
              <div className="chips" role="radiogroup" aria-labelledby="window">
                {WINDOWS.map((m) => <button key={m} type="button" className="chip" role="radio" aria-checked={t.windowMinutes === m} aria-pressed={t.windowMinutes === m} disabled={!editable} onClick={() => edit((d) => ({ ...d, windowMinutes: m }))}>{m < 60 ? `${m} min` : `${m / 60} hr`}</button>)}
              </div>
            </div>
          </>}
        </section>

        {editable && !hasDraft && (
          <button type="button" className="linkbtn" style={{ color: 'var(--bad)', alignSelf: 'flex-start', minHeight: 44 }} onClick={() => {
            if (confirm !== 'stop') return setConfirm('stop');
            store.stop(id, businessDate);
            setConfirm(null);
          }}>{confirm === 'stop' ? 'Tap again to stop it from tomorrow' : 'Stop using this list'}</button>
        )}
      </div>

      {editable && hasDraft && (
        <Foot>
          <button type="button" className="btn b1" disabled={issues.length > 0} onClick={() => { store.publish(id, businessDate, user.name); setConfirm(null); }}>
            {issues.length ? `${issues.length} ${issues.length === 1 ? 'thing' : 'things'} to finish first` : 'Publish · starts tomorrow'}
          </button>
          <button type="button" className="btn b2" onClick={() => {
            if (confirm !== 'discard') return setConfirm('discard');
            store.discard(id);
            setConfirm(null);
            if (isNew) navigate('/checklists/edit');
          }}>{confirm === 'discard' ? 'Tap again to confirm' : isNew ? 'Delete this draft' : 'Undo my changes'}</button>
        </Foot>
      )}
    </main>
  );
}
