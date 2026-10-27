/**
 * Checklists on wide screens: today's lists stay on the left and the open one fills the right,
 * like Mail. J and K move through the lists; phones keep one screen per list.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router';
import { can, useAuth } from '../lib/auth';
import { formatDay } from '../lib/draft';
import { runPath, statusPill, useChecklists, isUrgent, type TaskView } from '../lib/checklists';
import { checklistIcon, RowLink, StatusIcon } from './ui';

export function TaskRow({ t }: { t: TaskView }) {
  const pill = statusPill(t);
  const pie = t.status === 'done' ? 'done' : t.status === 'failed' ? 'fail' : t.done > 0 ? 'started' : 'todo';
  const sub = t.status === 'done' || t.status === 'failed'
    ? `${t.run?.completedAt ? new Date(t.run.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''} · ${t.run?.completedBy ?? ''}${t.status === 'failed' ? ' · problem fixed' : ''}`
    : `${t.total} ${t.total === 1 ? 'check' : 'checks'} · ${t.template.who}`;
  return <RowLink to={runPath(t.key)} lead={<StatusIcon d={checklistIcon(t.template.id, t.template.phase)} status={pie} />} title={t.title} sub={sub} right={<span className={`pill ${pill.cls}`}>{pill.text}</span>} />;
}

/** Today's lists in the order people work through them. */
export function groupTasks(tasks: TaskView[]) {
  const open = tasks.filter((t) => !t.ready);
  const now = open.filter((t) => isUrgent(t.status));
  const missed = open.filter((t) => t.status === 'missed');
  const later = open.filter((t) => t.status === 'upcoming');
  const anytime = open.filter((t) => t.status === 'anytime');
  const ready = tasks.filter((t) => t.ready);
  const done = tasks.filter((t) => t.status === 'done' || t.status === 'failed');
  return { now, missed, later, anytime, ready, done, next: now[0] ?? later[0], order: [...now, ...missed, ...later, ...anytime, ...ready, ...done] };
}

/** The one Submit under all the lists. Lists save as you go; this locks every one that's ready. */
export function SubmitLists() {
  const { tasks, submitReady } = useChecklists();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const readyLists = tasks.filter((t) => t.ready);
  const ready = readyLists.length;
  const unfinished = tasks.filter((t) => !t.ready && !t.run?.completedAt && t.done > 0).length;
  const allDone = tasks.length > 0 && tasks.every((t) => t.run?.completedAt || t.status === 'anytime');
  const onSubmit = async () => {
    setBusy(true);
    const n = await submitReady();
    setBusy(false);
    setAsking(false);
    setSent(`${n} ${n === 1 ? 'checklist' : 'checklists'} submitted and locked.`);
  };

  // Always under the lists, so people know where it is; greyed out until a list is ready.
  return (
    <div className="submit-lists">
      <button type="button" className="btn b1" disabled={busy || !ready} onClick={() => { setSent(null); setAsking(true); }}>
        {allDone && !ready ? 'All submitted' : 'Submit all'}
      </button>
      {asking && ready > 0 && <SubmitConfirm lists={readyLists.map((t) => t.title)} unfinished={unfinished} busy={busy} onSubmit={onSubmit} onCancel={() => setAsking(false)} />}
      <p className="note" role="status">
        {ready > 0
          ? `Locks them. After that, a change needs a correction with a reason.${unfinished ? ` ${unfinished} not finished yet ${unfinished === 1 ? 'stays' : 'stay'} open.` : ''}`
          : sent ?? (allDone ? 'Everything is locked. A change needs a correction with a reason.' : 'Answer every check in a list, then submit it here.')}
      </p>
    </div>
  );
}

/**
 * Submitting locks food-safety records, so it's the one place we ask first
 * (HANDOFF.md §7: "Undo instead of confirm, except the final Submit"). Centred over a dimmed page;
 * Escape or a tap outside cancels.
 */
function SubmitConfirm({ lists, unfinished, busy, onSubmit, onCancel }: { lists: string[]; unfinished: number; busy: boolean; onSubmit: () => void; onCancel: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [busy, onCancel]);
  const n = lists.length;
  return createPortal(
    <div className="confirm-back" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="submit-confirm-title" aria-describedby="submit-confirm-body">
        <h2 id="submit-confirm-title">Submit {n === 1 ? 'this checklist' : `all ${n} checklists`}?</h2>
        <p id="submit-confirm-body" title={lists.join(', ')}>
          Once submitted, {n === 1 ? "it can't" : "they can't"} be edited. Any change after that needs a correction with a reason.
          {unfinished > 0 && ` ${unfinished} unfinished ${unfinished === 1 ? 'list stays' : 'lists stay'} open.`}
        </p>
        <div className="confirm-acts">
          <button type="button" className="confirm-btn" disabled={busy} onClick={onCancel}>Cancel</button>
          <button type="button" className="confirm-btn pri" disabled={busy} onClick={onSubmit} autoFocus>Submit</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The next list still to do after this one, for "finish and open the next". */
export function nextAfter(tasks: TaskView[], key: string): TaskView | undefined {
  const g = groupTasks(tasks);
  const open = [...g.now, ...g.missed, ...g.later].filter((t) => t.key !== key);
  return open[0];
}

export function SplitFrame({ selected, children }: { selected: string | null; children: ReactNode }) {
  const { tasks, businessDate } = useChecklists();
  const { user } = useAuth();
  const navigate = useNavigate();
  const g = groupTasks(tasks);
  const scheduled = tasks.filter((t) => t.status !== 'anytime');
  const late = tasks.filter((t) => t.status === 'late' || t.status === 'missed').length;

  // J and K move through the lists, unless someone is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      const k = e.key.toLowerCase();
      if (k !== 'j' && k !== 'k') return;
      const at = g.order.findIndex((t) => t.key === selected);
      const to = g.order[k === 'j' ? (at < 0 ? 0 : Math.min(g.order.length - 1, at + 1)) : Math.max(0, at - 1)];
      if (to && to.key !== selected) { e.preventDefault(); navigate(runPath(to.key)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [g.order, selected, navigate]);

  const group = (label: string, list: TaskView[], meta?: string) => list.length > 0 && (
    <div className="sub">
      <div className="sl"><span>{label}</span>{meta && <span>{meta}</span>}</div>
      {list.map((t) => <div key={t.key} className={t.key === selected ? 'sel' : undefined} aria-current={t.key === selected ? 'page' : undefined}><TaskRow t={t} /></div>)}
    </div>
  );

  return (
    <main className="page split-page">
      <aside className="split-list" aria-label="Today's checklists">
        <div className="split-hd">
          <span className="eyebrow">{formatDay(businessDate)}</span>
          {user && can.editChecklists(user.role) && <Link className="linkbtn" to="/checklists/edit">Edit lists</Link>}
        </div>
        <div className="titleblock" style={{ paddingBottom: 4 }}>
          <h1>Checklists</h1>
          <span className="eyebrow">{g.done.filter((t) => t.status !== 'anytime').length} of {scheduled.length} done{late ? ` · ${late} late or missed` : ''}</span>
        </div>
        {group('Now', g.now)}
        {group('Missed', g.missed, 'Still worth doing')}
        {group('Later today', g.later)}
        {group('When needed', g.anytime)}
        {group('Ready to submit', g.ready)}
        {group('Done', g.done)}
        <SubmitLists />
      </aside>
      <div className="split-main">{children}</div>
    </main>
  );
}
