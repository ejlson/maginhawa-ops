/**
 * The report builder's workspace, ported from the approved prototype (design/report-builder/src/app.js):
 * a full-screen map with a layers panel and a review panel, a pop-up editor, list and pipeline views,
 * and undo for each step. Every change goes through the engine in packages/core.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { latestDefinition, nextDay } from '@maginhawa/core';
import type { User } from '../../lib/auth';
import { formatDay } from '../../lib/draft';
import { CLUSTERS, changes } from '../../lib/report-builder/model';
import { baseOf, type DefinitionSave } from '../../lib/report-builder/save';
import { MapView } from './MapView';
import { ListView } from './ListView';
import { Pipeline } from './Pipeline';
import { Layers } from './Layers';
import { Editor } from './Editor';
import { ReviewPanel } from './ReviewPanel';
import { ActionDialog } from './ActionDialog';
import { type Toast, STATUS_LABEL, useWorkspace, WsContext, useWs } from './workspace-helpers';

export function Workspace({ save, user, notice, onNotice }: { save: DefinitionSave; user: User; notice: string | null; onNotice: (msg: string) => void }) {
  const ws = useWorkspace(save, user, onNotice);
  useEffect(() => { if (notice) ws.toast(notice); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { view, rec, C, T, R, locked } = ws;
  const pass = T.filter((t) => t.pass).length, errs = Object.keys(R.errs).length;
  const ready = C.length > 0 && pass === T.length && errs === 0;
  const pending = rec.pending;
  const latest = latestDefinition(rec);
  const draftLabel = pending ? `v${(latest?.version ?? 0) + 1} waiting` : C.length || rec.draft ? `v${(latest?.version ?? 0) + 1} draft` : `v${latest?.version ?? 1}`;
  const status = view.status;
  const statusPill = status === 'waiting' ? 'warn' : status === 'draft' ? 'plain' : 'ok';
  const statusText = STATUS_LABEL[status];
  const statusTip = status === 'starts-tomorrow' ? `Managers use it from ${formatDay(nextDay(view.today))}` : undefined;

  /* ---------- keys ---------- */
  const wsRef = useRef(ws);
  wsRef.current = ws;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const w = wsRef.current;
      const t = e.target as HTMLElement | null;
      const typing = !!t?.closest?.('input,textarea,select,[contenteditable]');
      if (e.key === 'Escape') {
        if (w.dialog) { w.setDialog(null); return; }
        if (w.modal && w.sel) { e.preventDefault(); w.setModal(false); return; }
        if (!typing && (w.sel || w.selField)) { w.open(null); return; }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.getElementById('find')?.focus(); return; }
      if (e.key === '/' && !typing) { e.preventDefault(); document.getElementById('find')?.focus(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) w.redo(); else w.undo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); w.redo(); return; }
      if (typing || w.dialog || (w.modal && w.sel)) return;
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const add = ({ i: 'input', s: 'section', c: 'calc', k: 'check', t: 'setting' } as Record<string, string>)[e.key.toLowerCase()];
        if (add) { e.preventDefault(); w.addByKey(add); return; }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (w.selField) { e.preventDefault(); w.deleteFig(w.selField); }
        else if (w.sel && w.bx.some((b) => b.id === w.sel && b.kind !== 'output')) { e.preventDefault(); w.deleteFig(w.sel); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const saveText = save.state === 'saving' || save.state === 'waiting' ? 'Saving…' : save.state === 'failed' ? 'Not saved' : pending ? '' : rec.draft ? 'Draft saved' : 'Saved';
  const mine = pending?.by === user.name;

  return (
    <WsContext.Provider value={ws}>
      <div className="rb">
        <section className="builder full" aria-label="Report builder">
          <div className="bar">
            <div className="fb-title">
              <Link className="fb-mark" to="/head-office" aria-label="Back to head office">M</Link>
              <b>EOD report</b><span className="pill plain">{draftLabel}</span>
            </div>
            <div className="bar-mid">
              <span className={`pill ${statusPill}`} role="status" aria-label={`Status: ${statusText}`} title={statusTip}>{statusText}</span>
              <span className={`savestate${save.state === 'failed' ? ' bad' : ''}`} aria-live="polite">{saveText}</span>
            </div>
            <div className="bar-acts">
              <button type="button" className="lnk small" aria-pressed={ws.showLayers} onClick={() => ws.setShowLayers(!ws.showLayers)}>Layers</button>
              <button type="button" className="lnk small" aria-pressed={ws.showPanel} onClick={() => ws.setShowPanel(!ws.showPanel)}>Review</button>
              <span className={`fb-only pill ${pass === T.length && !errs ? 'ok' : 'bad'}`} id="fbTests">Tests {pass}/{T.length}</span>
              {/* Changes sent for approval before publishing replaced it: anyone in head office, including the sender, can approve. */}
              {pending && mine && <button type="button" className="btn sm ghost" onClick={() => ws.setDialog('withdraw')}>Withdraw</button>}
              {pending && !mine && <button type="button" className="danger" onClick={() => ws.setDialog('reject')}>Turn down</button>}
              {pending && <button type="button" className="btn sm" onClick={() => ws.setDialog('approve')}>Approve</button>}
              {!pending && <button type="button" className="btn sm" disabled={!ready || save.state === 'failed'} onClick={() => ws.setDialog('publish')}>Publish</button>}
            </div>
          </div>

          <Banners />

          <div className={`frame ws${ws.showLayers ? '' : ' no-layers'}${ws.showPanel ? '' : ' no-panel'}`} id="frame">
            {ws.showLayers && <Layers />}
            <div id="main">
              <Toolbar />
              <div className="stage">
                {ws.vw === 'map' ? <MapView /> : ws.vw === 'list' ? <ListView /> : <Pipeline draftLabel={draftLabel} />}
              </div>
            </div>
            {ws.showPanel && <ReviewPanel draftLabel={draftLabel} ready={ready} />}
          </div>
          {ws.modal && ws.sel && <Editor />}
          {ws.dialog && <ActionDialog kind={ws.dialog} />}
        </section>
        {ws.toastState && <ToastView t={ws.toastState} />}
      </div>
    </WsContext.Provider>
  );
}

function Banners() {
  const ws = useWs();
  const { rec, save, user } = ws;
  const c = save.conflict;
  const theirs = c ? (c.record.pending ?? c.record.draft) : null;
  const theirChanges = c && theirs ? changes(baseOf(c.record), { definition: theirs.definition, testDays: theirs.testDays }) : [];
  const latestTheirs = c ? latestDefinition(c.record) : null;
  return (
    <>
      {save.state === 'failed' && (
        <div className="banner bad" role="alert">
          <div className="t">
            <b>{c || save.error?.startsWith('Someone else') ? 'Someone else changed the report while you were working' : 'Your last change isn’t saved'}</b>
            {c && theirs && <small>{theirs.by} {c.record.pending ? 'sent a change for approval' : 'saved a draft'}{'updatedAt' in theirs ? ` at ${new Date(theirs.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}.</small>}
            {c && !theirs && latestTheirs && <small>v{latestTheirs.version} was approved by {latestTheirs.approvedBy}: {latestTheirs.summary}</small>}
            {!c && <small>{save.error}</small>}
            {theirChanges.length > 0 && <ul aria-label="Their changes">{theirChanges.slice(0, 6).map((x, i) => <li key={i}>{x.t}{x.s ? `: ${x.s}` : ''}</li>)}{theirChanges.length > 6 && <li>and {theirChanges.length - 6} more</li>}</ul>}
          </div>
          {c || save.error?.startsWith('Someone else')
            ? <button type="button" className="btn sm" onClick={save.reload}>Reload their version</button>
            : <button type="button" className="btn sm" onClick={() => void save.flush()}>Try again</button>}
        </div>
      )}
      {rec.rejected && !rec.pending && (
        <div className="banner warn" role="note"><div className="t"><b>{rec.rejected.by} turned this change down</b><small>{rec.rejected.reason}</small></div></div>
      )}
      {rec.pending && (
        <div className="banner" role="note">
          <div className="t">
            <b>{rec.pending.by === user.name ? 'Sent for approval' : `${rec.pending.by} sent this for approval`}</b>
            <small>“{rec.pending.summary}”. {rec.pending.by === user.name ? 'Approve it to publish, or withdraw it to keep editing.' : 'Check the changes and tests, then approve it or turn it down.'}</small>
          </div>
        </div>
      )}
    </>
  );
}

function Toolbar() {
  const ws = useWs();
  const n = ws.sel ? ws.secs.find((s) => s.id === ws.sel)?.title ?? ws.bx.find((b) => b.id === ws.sel) : null;
  const name = typeof n === 'string' ? n : n ? (n.kind === 'output' ? n.act.title : n.fig.name) : null;
  const allIds = [...ws.secs.map((s) => s.id), ...CLUSTERS.map((c) => c.id)];
  return (
    <div className="tool">
      <div className="tabs sm" role="group" aria-label="View">
        {(['map', 'list', 'pipe'] as const).map((v) => (
          <button key={v} type="button" aria-selected={ws.vw === v} onClick={() => ws.setVw(v)}>{v === 'map' ? 'Map' : v === 'list' ? 'List' : 'Pipeline'}</button>
        ))}
      </div>
      <span className="cap small grow">{name && <>Following <b style={{ color: 'var(--text)' }}>{name}</b> · <button type="button" className="lnk small" onClick={() => ws.open(null)}>Clear</button></>}</span>
      {ws.vw === 'map' && <button type="button" className="lnk small" onClick={() => { ws.setCollapsed(ws.collapsed.size ? new Set() : new Set(allIds)); }}>{ws.collapsed.size ? 'Expand all' : 'Collapse all'}</button>}
      <button type="button" className="lnk small" disabled={!ws.h.steps.length} onClick={ws.undo}>Undo</button>
      <button type="button" className="lnk small" disabled={!ws.h.redoLabel} onClick={ws.redo}>Redo</button>
      {ws.vw === 'map' && <button type="button" className="lnk small" disabled={ws.h.snap.tidy} onClick={() => ws.edit('Tidied up the map', (s) => ({ ...s, tidy: true, pos: {} }), undefined, true)}>Tidy up</button>}
    </div>
  );
}

function ToastView({ t }: { t: Toast }) {
  const ws = useWs();
  return (
    <div className={`toast${t.bad ? ' bad' : ''}`} role="status" aria-live="polite">
      <span>{t.msg}</span>
      {t.undo && <button type="button" className="lnk" onClick={ws.undo}>Undo</button>}
      {t.redo && <button type="button" className="lnk" onClick={ws.redo}>Redo</button>}
    </div>
  );
}

/** A small pop-up card over the darkened screen: the editor and the approval dialogs use it. */
export function Popup({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = ref.current?.querySelector<HTMLElement>('input:not([type=checkbox]),select,textarea,button:not(.mclose)');
    if (f && !document.querySelector('.rb .inl')) f.focus();
  }, []);
  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} ref={ref}>
        <button type="button" className="mclose" aria-label="Close" onClick={onClose}>×</button>
        <div className="panel-sec">{children}</div>
      </div>
    </div>
  );
}
