import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { addOnFor, ANSWER_LABELS, ANSWER_TYPES, canAddChecks, latestVersion, moveCheckpointTo, newCheckpoint, nextDay, PHASE_LABELS, PHASES, recordIssues, recordStatus, ruleText, scheduleText, siteName as nameOfSite, SITES, STATUS_LABELS, uniqueId, type AnswerType, type Checkpoint } from '@maginhawa/core';
import { formatDay } from '../lib/draft';
import { checkPath, editPath, useListEditor } from '../lib/templates';
import { ANSWER_ICONS, ICONS, TYPE_HINTS } from '../components/ui-helpers';
import { ChipRadio, Foot, Icon, Nav, RowLink, Toggle } from '../components/ui';
import { ReorderList } from '../components/ReorderList';

const WINDOWS = [15, 30, 45, 60, 90, 120];

const siteName = (code?: string) => (code ? nameOfSite(code) : '');
const checkSub = (c: Checkpoint) => [ANSWER_LABELS[c.type], ruleText(c), c.required ? null : 'Optional', c.section].filter(Boolean).join(' · ');
const checkLead = (c: Checkpoint) => <span className="av"><Icon d={ANSWER_ICONS[c.type]} /></span>;

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
  // A site's own checks on a group list are edited here too, under the group list's name.
  const group = rec.extends ? store.recordFor(rec.extends) : undefined;
  const groupT = group ? latestVersion(group)?.template ?? null : null;
  if (rec.extends && !groupT) return <Navigate to="/checklists/edit" replace />;
  // For a manager on a group list: their site's own checks (null if none yet). Undefined elsewhere.
  const addOn = !rec.extends && rec.scope === 'group' && user.role === 'manager' ? addOnFor(store.records, rec.id, user.siteCode) ?? null : undefined;
  const siteAddOns = rec.scope === 'group' && user.role === 'headoffice' ? store.records.filter((r) => r.extends === rec.id) : [];

  const isNew = status === 'new';
  const hasDraft = isNew || status === 'draft';
  const issues = recordIssues(rec, t);
  const where = rec.extends ? `${siteName(rec.siteCode)} only · added to a group list` : rec.scope === 'group' ? 'Every site' : `${siteName(rec.siteCode)} only`;
  const title = groupT?.title ?? t.title;
  const n = t.checkpoints.length;
  const tomorrow = formatDay(nextDay(businessDate));
  const [statusText, statusCls] = !editable && status !== 'archived' ? ['Live', 'h-ok']
    : status === 'archived' && rec.extends ? ['Removed. Staff no longer see these checks', '']
    : status === 'archived' ? ['Stopped. Staff no longer see it', '']
    : status === 'starts-tomorrow' ? [rec.versions.length > 1 ? `Changes start ${tomorrow}` : `Starts ${tomorrow}`, 'h-ok']
    : status === 'live' ? ['Live', 'h-ok']
    : issues.length ? [`${issues.length} ${issues.length === 1 ? 'thing' : 'things'} to finish`, 'h-warn']
    : [`Ready to publish · starts ${tomorrow}`, 'h-ok'];

  const openAddOn = () => navigate(editPath(store.addChecks(rec.id, user.siteCode, user.name)));
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
      <Nav back={group ? editPath(group.id) : '/checklists/edit'} backLabel={group ? 'Group list' : 'Lists'} title={title || 'New checklist'}
        right={editable && hasDraft ? <span className="saved"><span className="dot warn" />Draft saved</span> : undefined} />
      <div className="body form">
        <div className="hero" role="status">
          <span className="hl">{where}{status === 'starts-tomorrow' && rec.versions.length > 1 ? ' · today runs the old version' : ''}</span>
          <label className="title-edit">
            <input className="title-in" aria-label="Name" placeholder="Name this list" disabled={!editable || Boolean(group)} autoFocus={isNew && !t.title}
              value={title} onChange={(e) => edit((d) => ({ ...d, title: e.target.value }))} />
            {editable && !group && <Icon d={ICONS.pen} size={16} />}
          </label>
          <div className="hero-row hero-foot">
            <span className={`hero-next ${statusCls}`}>{statusText}</span>
            <span className="hs-small">{group ? `${n} of your own` : `${n} ${n === 1 ? 'check' : 'checks'}`} · {scheduleText(groupT ?? t)}</span>
          </div>
        </div>

        {!editable && status !== 'archived' && (
          <div className="banner" role="note"><Icon d={ICONS.bang} size={16} /><span>{
            addOn !== undefined ? `Head office looks after this list. You can add checks of your own for ${siteName(user.siteCode)} at the end.`
            : rec.scope === 'group' ? 'Head office looks after this list. Ask them if something needs to change.' : 'You can see this list but not change it.'
          }</span></div>
        )}
        {editable && hasDraft && issues.length > 0 && (
          <ul className="issues" aria-label="Before you publish">{issues.map((x) => <li key={x}><Icon d={ICONS.bang} size={16} />{x}</li>)}</ul>
        )}

        {groupT && (
          <section className="grp quiet">
            <div className="hd"><h2>From head office</h2><span>{groupT.checkpoints.length}</span></div>
            <div className="sub">{groupT.checkpoints.map((c) => <RowLink key={c.id} lead={checkLead(c)} title={c.title} sub={checkSub(c)} />)}</div>
          </section>
        )}

        <section className="grp">
          <div className="hd">
            <h2>{group ? `${siteName(rec.siteCode)}'s own checks` : 'Checks'}</h2>
            {editable && n > 1 && !reorder && <button type="button" className="linkbtn" onClick={() => { setPicking(false); setReorder(true); }}>Reorder</button>}
          </div>
          <div className="sub">
            {group && !n && <p className="note" style={{ margin: 0 }}>Staff do these after head office's checks, at {siteName(rec.siteCode)} only.</p>}
            {reorder ? (
              <ReorderList onMove={(cid, to) => edit((d) => moveCheckpointTo(d, cid, to))}
                items={t.checkpoints.map((c, i) => ({
                  id: c.id, label: c.title || `check ${i + 1}`, sub: checkSub(c),
                  title: c.title || <span className="muted">Check {i + 1} · no question yet</span>,
                }))} />
            ) : t.checkpoints.map((c, i) => {
              const title = c.title || <span className="muted">Check {i + 1} · no question yet</span>;
              return <RowLink key={c.id} to={editable ? checkPath(id, c.id) : undefined} lead={checkLead(c)} title={title} sub={checkSub(c)} />;
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

        {addOn !== undefined && canAddChecks(user, rec) && (() => {
          const mine = addOn && (addOn.draft ?? latestVersion(addOn)?.template);
          const st = addOn && recordStatus(addOn, businessDate);
          const live = st && st !== 'archived' && mine ? mine.checkpoints : [];
          return (
            <section className="grp">
              <div className="hd"><h2>{siteName(user.siteCode)}'s own checks</h2>{st && st !== 'live' && <span className={`pill ${st === 'new' || st === 'draft' ? 'p-warn' : 'p-mut'}`}>{STATUS_LABELS[st]}</span>}</div>
              <div className="sub">
                {live.map((c) => <RowLink key={c.id} lead={checkLead(c)} title={c.title || <span className="muted">No question yet</span>} sub={checkSub(c)} />)}
                <RowLink onClick={openAddOn} lead={<span className="av dash"><Icon d={live.length ? ICONS.pen : ICONS.plus} /></span>}
                  title={<span style={{ color: 'var(--link)' }}>{live.length ? 'Change these checks' : `Add checks for ${siteName(user.siteCode)}`}</span>}
                  sub={live.length ? undefined : 'Staff do them after the checks above, at your site only'} />
              </div>
            </section>
          );
        })()}

        {siteAddOns.length > 0 && (
          <section className="grp">
            <div className="hd"><h2>Sites' own checks</h2><span>Added by managers</span></div>
            <div className="sub">
              {siteAddOns.map((r) => {
                const st = recordStatus(r, businessDate);
                const k = (r.draft ?? latestVersion(r)?.template)?.checkpoints.length ?? 0;
                return <RowLink key={r.id} to={editPath(r.id)} lead={<span className="av"><Icon d={ICONS.list} /></span>} title={siteName(r.siteCode)}
                  sub={`${k} ${k === 1 ? 'check' : 'checks'} at the end`} right={st === 'live' ? null : <span className={`pill ${st === 'new' || st === 'draft' ? 'p-warn' : 'p-mut'}`}>{STATUS_LABELS[st]}</span>} />;
              })}
            </div>
          </section>
        )}

        {group && groupT && <p className="note" style={{ margin: 0 }}>Runs with the group list: {groupT.who || 'staff'}, {scheduleText(groupT).toLowerCase()}. Head office sets who and when.</p>}

        {!group && <section className="grp">
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
              {PHASES.map((p) => <ChipRadio key={p} checked={t.phase === p} disabled={!editable} onClick={() => edit((d) => ({ ...d, phase: p }))}>{PHASE_LABELS[p]}</ChipRadio>)}
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
                {WINDOWS.map((m) => <ChipRadio key={m} checked={t.windowMinutes === m} disabled={!editable} onClick={() => edit((d) => ({ ...d, windowMinutes: m }))}>{m < 60 ? `${m} min` : `${m / 60} hr`}</ChipRadio>)}
              </div>
            </div>
          </>}
        </section>}

        {editable && !hasDraft && (
          <button type="button" className="linkbtn" style={{ color: 'var(--bad)', alignSelf: 'flex-start', minHeight: 44 }} onClick={() => {
            if (confirm !== 'stop') return setConfirm('stop');
            store.stop(id, businessDate);
            setConfirm(null);
          }}>{group ? (confirm === 'stop' ? 'Tap again to remove them from tomorrow' : `Remove ${siteName(rec.siteCode)}'s checks`)
            : confirm === 'stop' ? 'Tap again to stop it from tomorrow' : 'Stop using this list'}</button>
        )}
      </div>

      {/* While reordering, the one thing to do next is finish; publishing comes after. */}
      {reorder ? (
        <Foot>
          <button type="button" className="btn b1" onClick={() => setReorder(false)}>Finished editing</button>
        </Foot>
      ) : editable && hasDraft && (
        <Foot>
          <button type="button" className="btn b1" disabled={issues.length > 0} onClick={() => { store.publish(id, businessDate, user.name); setConfirm(null); }}>
            {issues.length ? `${issues.length} ${issues.length === 1 ? 'thing' : 'things'} to finish first` : 'Publish · starts tomorrow'}
          </button>
          <button type="button" className="btn b2" onClick={() => {
            if (confirm !== 'discard') return setConfirm('discard');
            store.discard(id);
            setConfirm(null);
            if (isNew) navigate(group ? editPath(group.id) : '/checklists/edit');
          }}>{confirm === 'discard' ? 'Tap again to confirm' : isNew ? 'Delete this draft' : 'Undo my changes'}</button>
        </Foot>
      )}
    </main>
  );
}
