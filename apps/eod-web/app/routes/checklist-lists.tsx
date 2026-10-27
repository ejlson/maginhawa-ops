import { useState } from 'react';
import { useNavigate } from 'react-router';
import { addOnFor, canCreateList, canEditList, editableTemplate, recordStatus, scheduleText, SITES, STATUS_LABELS, type TemplateRecord } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { useChecklists } from '../lib/checklists';
import { editPath, useTemplates } from '../lib/templates';
import { Foot, Icon, ICONS, Nav, RowLink } from '../components/ui';

const siteName = (code?: string) => SITES.find((s) => s.code === code)?.name ?? code ?? '';

/** Every checklist this person can see, and which of them they can change. */
export default function ChecklistLists() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { businessDate } = useChecklists();
  const { records, create, move } = useTemplates();
  // The section being put in order, if any: 'group' or a site code.
  const [ordering, setOrdering] = useState<string | null>(null);
  if (!user) return null;
  const isHo = user.role === 'headoffice';

  // A site's own checks on a group list show on that list's row, not as a list of their own.
  const lists = records.filter((r) => !r.extends);
  const addOns = records.filter((r) => r.extends && (isHo || r.siteCode === user.siteCode));
  const visible = lists.filter((r) => isHo || r.scope === 'group' || r.siteCode === user.siteCode);
  const stopped = visible.filter((r) => recordStatus(r, businessDate) === 'archived');
  const current = visible.filter((r) => !stopped.includes(r));
  const group = current.filter((r) => r.scope === 'group');
  const sites = SITES.map((s) => ({ ...s, lists: current.filter((r) => r.scope === 'site' && r.siteCode === s.code) })).filter((s) => s.lists.length || (!isHo && s.code === user.siteCode));
  const mine = current.filter((r) => canEditList(user, r));
  const changeable = [...mine, ...addOns.filter((r) => canEditList(user, r))];
  const unpublished = changeable.filter((r) => ['new', 'draft'].includes(recordStatus(r, businessDate))).length;
  const tomorrow = changeable.filter((r) => recordStatus(r, businessDate) === 'starts-tomorrow').length;

  /** What a group list's row says about sites' own checks on it. */
  const extraText = (r: TemplateRecord) => {
    if (r.scope !== 'group') return null;
    if (isHo) {
      const n = addOns.filter((a) => a.extends === r.id && recordStatus(a, businessDate) !== 'archived').length;
      return n ? `+ checks at ${n} ${n === 1 ? 'site' : 'sites'}` : null;
    }
    const a = addOnFor(addOns, r.id, user.siteCode);
    const st = a && recordStatus(a, businessDate);
    if (!a || st === 'archived') return null;
    const k = editableTemplate(a)!.checkpoints.length;
    const label = st === 'new' || st === 'draft' ? ', not published' : st === 'starts-tomorrow' ? ', from tomorrow' : '';
    return `+ ${k} of yours${label}`;
  };

  const row = (r: TemplateRecord) => {
    const t = editableTemplate(r)!;
    const status = recordStatus(r, businessDate);
    const pill = status === 'live' ? null : <span className={`pill ${status === 'new' || status === 'draft' ? 'p-warn' : 'p-mut'}`}>{STATUS_LABELS[status]}</span>;
    const n = t.checkpoints.length;
    const sub = [scheduleText(t), `${n} ${n === 1 ? 'check' : 'checks'}`, extraText(r), canEditList(user, r) ? null : 'Head office'].filter(Boolean).join(' · ');
    return <RowLink key={r.id} to={editPath(r.id)} lead={<span className="av"><Icon d={ICONS.list} /></span>} title={t.title || 'Untitled checklist'} sub={sub} right={pill} />;
  };

  /** Up and down buttons in place of the link while a section is being put in order. */
  const orderRow = (r: TemplateRecord, i: number, list: TemplateRecord[], sameGroup: (x: TemplateRecord) => boolean) => {
    const t = editableTemplate(r)!;
    const name = t.title || 'Untitled checklist';
    return (
      <div className="li order-row" key={r.id}>
        <span className="av"><Icon d={ICONS.list} /></span>
        <span className="tx"><span>{name}</span><small>{scheduleText(t)}</small></span>
        <span className="rt">
          <button type="button" className="mini" aria-label={`Move ${name} up`} disabled={i === 0} onClick={() => move(r.id, -1, sameGroup)}><Icon d={ICONS.up} size={16} /></button>
          <button type="button" className="mini" aria-label={`Move ${name} down`} disabled={i === list.length - 1} onClick={() => move(r.id, 1, sameGroup)}><Icon d={ICONS.down} size={16} /></button>
        </span>
      </div>
    );
  };
  const live = (r: TemplateRecord) => !r.extends && recordStatus(r, businessDate) !== 'archived';
  const inGroup = (r: TemplateRecord) => live(r) && r.scope === 'group';
  const inSite = (code: string) => (r: TemplateRecord) => live(r) && r.scope === 'site' && r.siteCode === code;
  /** A section's rows, and its Reorder / Done link when this person can change every list in it. */
  const section = (key: string, list: TemplateRecord[], sameGroup: (r: TemplateRecord) => boolean) => {
    const can = list.length > 1 && list.every((r) => canEditList(user, r));
    const on = ordering === key && can;
    return {
      rows: on ? list.map((r, i) => orderRow(r, i, list, sameGroup)) : list.map(row),
      toggle: can ? <button type="button" className="linkbtn" onClick={() => setOrdering(on ? null : key)}>{on ? 'Done' : 'Reorder'}</button> : null,
      note: on ? <p className="note" style={{ margin: 0 }}>Lists due at the same time, and lists done when needed, show in this order on the Checklists screen.</p> : null,
    };
  };

  const startNew = () => {
    const id = create(isHo ? { scope: 'group', by: user.name } : { scope: 'site', siteCode: user.siteCode, by: user.name });
    navigate(editPath(id));
  };

  return (
    <main className="page">
      <Nav back={isHo ? '/head-office' : '/checklists'} backLabel={isHo ? 'All sites' : 'Checklists'} title="Edit checklists" />
      <div className="body">
        <div className="top">
          <div className="titleblock">
            <span className="eyebrow">{isHo ? 'All sites' : siteName(user.siteCode)}</span>
            <h1>Edit checklists</h1>
            <p className="lead">Changes start the next trading day, so a list never changes partway through a shift.</p>
          </div>
          <div className="hero" role="status">
            <span className="hl">{isHo ? 'Lists you can change' : `Lists you can change at ${siteName(user.siteCode)}`}</span>
            <div className="big"><b>{mine.length}</b><i>&nbsp;{mine.length === 1 ? 'list' : 'lists'}</i></div>
            <div className="hm">
              <span className={unpublished ? 'h-warn' : ''}>{unpublished}<small>Not published</small></span>
              <span>{tomorrow}<small>Start tomorrow</small></span>
              <span>{group.length}<small>Group lists</small></span>
            </div>
          </div>
        </div>

        {!isHo && sites.map((s) => { const sec = section(s.code, s.lists, inSite(s.code)); return (
          <section className="grp" key={s.code}>
            <div className="hd"><h2>{s.name} lists</h2>{sec.toggle ?? <span>Made by managers</span>}</div>
            {sec.note}
            <div className="sub">
              {sec.rows}
              {!s.lists.length && <p className="note" style={{ margin: 0 }}>No lists of your own yet. Make one for anything the group lists don't cover, like bar opening or a brunch set-up.</p>}
            </div>
          </section>
        ); })}

        {(() => { const sec = section('group', group, inGroup); return (
          <section className="grp">
            <div className="hd"><h2>Group lists</h2>{sec.toggle ?? <span>Every site</span>}</div>
            {!isHo && <p className="note" style={{ margin: 0 }}>Head office looks after these. Open one to add checks of your own for {siteName(user.siteCode)}.</p>}
            {sec.note}
            <div className="sub">{sec.rows}</div>
          </section>
        ); })()}

        {isHo && sites.length > 0 && (
          <section className="grp">
            <div className="hd"><h2>Site lists</h2><span>Made by managers</span></div>
            {sites.map((s) => { const sec = section(s.code, s.lists, inSite(s.code)); return (
              <div className="sub" key={s.code}><div className="sl"><span>{s.name}</span>{sec.toggle}</div>{sec.note}{sec.rows}</div>
            ); })}
          </section>
        )}

        {stopped.length > 0 && (
          <section className="grp quiet">
            <div className="hd"><h2>Stopped</h2><span>{stopped.length}</span></div>
            <div className="sub">{stopped.map(row)}</div>
          </section>
        )}
      </div>
      {(canCreateList(user, 'site') || canCreateList(user, 'group')) && (
        <Foot><button type="button" className="btn b1" onClick={startNew}><Icon d={ICONS.plus} />New checklist</button></Foot>
      )}
    </main>
  );
}
