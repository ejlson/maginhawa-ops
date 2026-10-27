import { useNavigate } from 'react-router';
import { canCreateList, canEditList, editableTemplate, recordStatus, scheduleText, SITES, STATUS_LABELS, type TemplateRecord } from '@maginhawa/core';
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
  const { records, create } = useTemplates();
  if (!user) return null;
  const isHo = user.role === 'headoffice';

  const visible = records.filter((r) => isHo || r.scope === 'group' || r.siteCode === user.siteCode);
  const stopped = visible.filter((r) => recordStatus(r, businessDate) === 'archived');
  const current = visible.filter((r) => !stopped.includes(r));
  const group = current.filter((r) => r.scope === 'group');
  const sites = SITES.map((s) => ({ ...s, lists: current.filter((r) => r.scope === 'site' && r.siteCode === s.code) })).filter((s) => s.lists.length || (!isHo && s.code === user.siteCode));
  const mine = current.filter((r) => canEditList(user, r));
  const unpublished = mine.filter((r) => ['new', 'draft'].includes(recordStatus(r, businessDate))).length;
  const tomorrow = mine.filter((r) => recordStatus(r, businessDate) === 'starts-tomorrow').length;

  const row = (r: TemplateRecord) => {
    const t = editableTemplate(r)!;
    const status = recordStatus(r, businessDate);
    const pill = status === 'live' ? null : <span className={`pill ${status === 'new' || status === 'draft' ? 'p-warn' : 'p-mut'}`}>{STATUS_LABELS[status]}</span>;
    const n = t.checkpoints.length;
    const sub = [scheduleText(t), `${n} ${n === 1 ? 'check' : 'checks'}`, canEditList(user, r) ? null : 'Head office'].filter(Boolean).join(' · ');
    return <RowLink key={r.id} to={editPath(r.id)} lead={<span className="av"><Icon d={ICONS.list} /></span>} title={t.title || 'Untitled checklist'} sub={sub} right={pill} />;
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

        {!isHo && sites.map((s) => (
          <section className="grp" key={s.code}>
            <div className="hd"><h2>{s.name} lists</h2><span>Made by managers</span></div>
            <div className="sub">
              {s.lists.map(row)}
              {!s.lists.length && <p className="note" style={{ margin: 0 }}>No lists of your own yet. Make one for anything the group lists don't cover, like bar opening or a brunch set-up.</p>}
            </div>
          </section>
        ))}

        <section className="grp">
          <div className="hd"><h2>Group lists</h2><span>Every site</span></div>
          {!isHo && <p className="note" style={{ margin: 0 }}>Head office looks after these. You can see them but not change them.</p>}
          <div className="sub">{group.map(row)}</div>
        </section>

        {isHo && sites.length > 0 && (
          <section className="grp">
            <div className="hd"><h2>Site lists</h2><span>Made by managers</span></div>
            {sites.map((s) => <div className="sub" key={s.code}><div className="sl"><span>{s.name}</span></div>{s.lists.map(row)}</div>)}
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
