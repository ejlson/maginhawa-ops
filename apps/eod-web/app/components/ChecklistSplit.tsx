/**
 * Checklists on wide screens: today's lists stay on the left and the open one fills the right,
 * like Mail. J and K move through the lists; phones keep one screen per list.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { can, useAuth } from '../lib/auth';
import { formatDay } from '../lib/draft';
import { ConfirmDialog } from './ConfirmDialog';
import { checksText, doneAt, isDone, isOverdue, isScheduled, runPath, statusPill, taskPie, useChecklists, type TaskView } from '../lib/checklists';
import type { FinishOutcome } from '@maginhawa/core';
import { checklistIcon } from './ui-helpers';
import { RowLink, StatusIcon } from './ui';
import { groupTasks } from './checklist-split-helpers';

export function TaskRow({ t }: { t: TaskView }) {
  const pill = statusPill(t);
  const sub = isDone(t)
    ? `${doneAt(t)} · ${t.run?.completedBy ?? ''}${t.status === 'failed' ? ' · problem fixed' : ''}`
    : checksText(t);
  return <RowLink to={runPath(t.key)} lead={<StatusIcon d={checklistIcon(t.template.id, t.template.phase)} status={taskPie(t)} />} title={t.title} sub={sub} right={<span className={`pill ${pill.cls}`}>{pill.text}</span>} />;
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
    const results = await submitReady();
    setBusy(false);
    setAsking(false);
    setSent(submitSummary(results));
  };

  // Always under the lists, so people know where it is; greyed out until a list is ready.
  return (
    <div className="submit-lists">
      <button type="button" className="btn b1" disabled={busy || !ready} onClick={() => { setSent(null); setAsking(true); }}>
        {allDone && !ready ? 'All submitted' : 'Submit all'}
      </button>
      {asking && ready > 0 && (
        <ConfirmDialog title={`Submit ${ready === 1 ? 'this checklist' : `all ${ready} checklists`}?`} busy={busy} onConfirm={onSubmit} onCancel={() => setAsking(false)}>
          <p title={readyLists.map((t) => t.title).join(', ')}>
            Once submitted, {ready === 1 ? "it can't" : "they can't"} be edited. Any change after that needs a correction with a reason.
            {unfinished > 0 && ` ${unfinished} unfinished ${unfinished === 1 ? 'list stays' : 'lists stay'} open.`}
          </p>
        </ConfirmDialog>
      )}
      <p className="note" role="status">
        {ready > 0
          ? `Locks them. After that, a change needs a correction with a reason.${unfinished ? ` ${unfinished} not finished yet ${unfinished === 1 ? 'stays' : 'stay'} open.` : ''}`
          : sent ?? (allDone ? 'Everything is locked. A change needs a correction with a reason.' : 'Answer every check in a list, then submit it here.')}
      </p>
    </div>
  );
}

/** "2 checklists submitted and locked. Close: items were just answered on another device…" */
function submitSummary(results: { title: string; outcome: FinishOutcome }[]) {
  const locked = results.filter((r) => !r.outcome.stale && !r.outcome.already && !r.outcome.queued).length;
  const parts = [`${locked} ${locked === 1 ? 'checklist' : 'checklists'} submitted and locked.`];
  for (const r of results) if (r.outcome.stale || r.outcome.already || r.outcome.queued) parts.push(`${r.title}: ${r.outcome.message}`);
  return parts.join(' ');
}

export function SplitFrame({ selected, children }: { selected: string | null; children: ReactNode }) {
  const { tasks, businessDate } = useChecklists();
  const { user } = useAuth();
  const navigate = useNavigate();
  const g = groupTasks(tasks);
  const scheduled = tasks.filter(isScheduled);
  const late = tasks.filter(isOverdue).length;

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
      <aside className="split-list" aria-label="Checklists to do today">
        <div className="split-hd">
          <span className="eyebrow">{formatDay(businessDate)}</span>
          {user && can.editChecklists(user.role) && <Link className="linkbtn" to="/checklists/edit">Edit lists</Link>}
        </div>
        <div className="titleblock" style={{ paddingBottom: 4 }}>
          <h1>Checklists</h1>
          <span className="eyebrow">{g.done.filter(isScheduled).length} of {scheduled.length} done{late ? ` · ${late} late or missed` : ''}</span>
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
