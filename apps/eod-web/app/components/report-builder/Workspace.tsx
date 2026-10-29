/**
 * The report builder's workspace, ported from the approved prototype (design/report-builder/src/app.js):
 * a full-screen map with a layers panel and a review panel, a pop-up editor, list and pipeline views,
 * and undo for each step. Every change goes through the engine in packages/core.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  SETTINGS_GROUP, addFigure, addGroup, connect, definitionGroups, deleteFigure, deleteGroup, disconnect, latestDefinition, nextDay,
  renameFigure, renameGroup, uniqueName, updateFigure,
  type Figure, type FigureType, type ReportDefinition, type TestDay,
} from '@maginhawa/core';
import type { User } from '../../lib/auth';
import { formatDay } from '../../lib/draft';
import { loadLayout, saveLayout } from '../../lib/report-builder/backend';
import { useHistory, type Apply, type History, type Snap } from '../../lib/report-builder/history';
import {
  CLUSTERS, boxes, changes, clusterOf, compute, graph, newId, sections, testDay, testResults, trace,
  type Box, type Change, type Computed, type Doc, type Graph, type Section, type ShownResult,
} from '../../lib/report-builder/model';
import { baseOf, docOf, type DefinitionSave } from '../../lib/report-builder/save';
import { MapView } from './MapView';
import { ListView } from './ListView';
import { Pipeline } from './Pipeline';
import { Layers } from './Layers';
import { Editor } from './Editor';
import { ReviewPanel } from './ReviewPanel';
import { ActionDialog, type DialogKind } from './ActionDialog';

export type View = 'map' | 'list' | 'pipe';
export interface Toast { msg: string; bad?: boolean; undo?: boolean; redo?: boolean }

const onDef = (fn: (d: ReportDefinition) => ReportDefinition): Apply => (s) => ({ ...s, doc: { ...s.doc, definition: fn(s.doc.definition) } });
const onDay = (fn: (d: TestDay) => TestDay): Apply => (s) => ({ ...s, doc: { ...s.doc, testDays: [fn(testDay(s.doc)), ...s.doc.testDays.slice(1)] } });
const both = (a: Apply, b: Apply): Apply => (s) => b(a(s));
const setValue = (id: string, v: number | undefined): Apply => onDay((d) => {
  const values = { ...d.values };
  if (v === undefined) delete values[id]; else values[id] = v;
  return { ...d, values };
});

export const STATUS_LABEL = { live: 'Live', draft: 'Draft', waiting: 'Waiting for approval', 'starts-tomorrow': 'Starts tomorrow' } as const;

function useWorkspace(save: DefinitionSave, user: User, onNotice: (msg: string) => void) {
  const view = save.view!;
  const rec = view.record;
  const saved = loadLayout();
  const h = useHistory(() => ({ doc: docOf(rec), pos: saved?.pos ?? {}, tidy: saved?.tidy ?? true }));
  const doc = h.snap.doc, def = doc.definition;
  const base = useMemo(() => baseOf(rec), [rec]);
  const baseIds = useMemo(() => new Set([...(base?.definition.figures.map((f) => f.id) ?? []), ...(base ? definitionGroups(base.definition).map((g) => g.id) : [])]), [base]);
  const R = useMemo(() => compute(doc), [doc]);
  const G = useMemo(() => graph(def), [def]);
  const T = useMemo(() => testResults(doc), [doc]);
  const C = useMemo(() => changes(base, doc), [base, doc]);
  const secs = useMemo(() => sections(def), [def]);
  const bx = useMemo(() => boxes(def), [def]);

  // Who may change what: nothing while a change waits for approval.
  const pending = rec.pending;
  const locked = pending ? (pending.by === user.name ? 'This change is waiting for approval. Withdraw it to keep editing.' : `${pending.by}’s change is waiting for your approval. Approve or turn it down first.`) : null;

  /* ---------- screen state ---------- */
  const [vw, setVw] = useState<View>('map');
  const [sel, setSelState] = useState<string | null>(null);
  const [selField, setSelField] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [inline, setInline] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set([...secs.map((s) => s.id), ...CLUSTERS.map((c) => c.id)]));
  // The side panels start open on a wide screen; after that, this device remembers.
  const wideNow = typeof window === 'undefined' || window.innerWidth >= 1100;
  const [showLayers, setShowLayers] = useState(() => saved?.layers ?? wideNow);
  const [showPanel, setShowPanel] = useState(() => saved?.panel ?? wideNow);
  useEffect(() => { saveLayout({ layers: showLayers, panel: showPanel }); }, [showLayers, showPanel]);
  const [flash, setFlash] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [toastState, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((msg: string, o: Omit<Toast, 'msg'> = {}) => {
    setToast({ msg, ...o });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), o.bad ? 6000 : 5000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const open = (id: string | null, field: string | null = null, popup = true) => { setSelState(id); setSelField(field); if (id) setModal(popup); else setModal(false); };
  const reveal = (id: string) => {
    const b = bx.find((x) => x.id === id);
    setCollapsed((c) => { const n = new Set(c); n.delete(b ? clusterOf(b) : id); return n; });
  };

  // The draft saves itself a moment after each change; the card layout stays on this device.
  useEffect(() => { save.changed(doc); }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { saveLayout({ pos: h.snap.pos, tidy: h.snap.tidy }); }, [h.snap.pos, h.snap.tidy]);

  /* ---------- edits ---------- */
  /** Runs an edit through the engine. False (with the engine's message) when it was refused. */
  const edit = (label: string, apply: Apply, after?: () => void, quiet = false) => {
    if (locked) { toast(locked, { bad: true }); return false; }
    const err = h.edit(label, apply);
    if (err) { toast(err, { bad: true }); return false; }
    after?.();
    if (!quiet) toast(label, { undo: true });
    return true;
  };
  const live = (apply: Apply) => { if (!locked) h.live(apply); };
  const commit = (label: string, apply: Apply) => { if (!locked) h.commit(label, apply); };
  const sectionOf = (id: string) => secs.find((s) => s.id === id);
  const fieldById = (id: string) => def.figures.find((f) => f.id === id && (f.kind === 'input' || f.kind === 'setting'));

  const firstInputGroup = () => (sel && sectionOf(sel)?.kind === 'input' ? sel : secs.find((s) => s.kind === 'input')?.id ?? 'lunch');
  const addInput = (groupId?: string) => {
    const gid = groupId ?? firstInputGroup(), g = sectionOf(gid), isSet = gid === SETTINGS_GROUP, id = newId('in');
    return edit(isSet ? 'Added a setting' : `Added an input to ${g?.title ?? 'the report'}`,
      both(onDef((d) => addFigure(d, { id, name: uniqueName(d, isSet ? 'New setting' : 'New input'), kind: isSet ? 'setting' : 'input', type: isSet ? 'percent' : 'money', group: gid, required: !isSet })), setValue(id, 0)),
      () => { setSelState(gid); setSelField(id); setInline(id); setCollapsed((c) => { const n = new Set(c); n.delete(gid); return n; }); });
  };
  const addSection = () => {
    const gid = newId('sec'), id = newId('in');
    const taken = new Set(secs.map((s) => s.title.toLowerCase()));
    let title = 'New section', i = 2;
    while (taken.has(title.toLowerCase())) title = `New section ${i++}`;
    return edit('Added a section',
      both(onDef((d) => addFigure(addGroup(d, { id: gid, title }), { id, name: uniqueName(d, 'New input'), kind: 'input', type: 'money', group: gid, required: true })), setValue(id, 0)),
      () => { setSelState(gid); setSelField(null); setInline(`node:${gid}`); });
  };
  const addCalc = (kind: 'calc' | 'check') => {
    const id = newId(kind === 'check' ? 'chk' : 'calc');
    return edit(kind === 'check' ? 'Added a check' : 'Added a calculation',
      onDef((d) => addFigure(d, { id, name: uniqueName(d, kind === 'check' ? 'New check' : 'New calculation'), kind, type: kind === 'check' ? 'yesno' : 'money', formula: '' })),
      () => { setSelState(id); setSelField(null); setInline(`node:${id}`); setCollapsed((c) => { const n = new Set(c); n.delete(kind === 'check' ? 'c-checks' : 'c-totals'); return n; }); });
  };
  const addByKey = (a: string) => { if (a === 'input') addInput(); else if (a === 'section') addSection(); else if (a === 'setting') addInput(SETTINGS_GROUP); else addCalc(a === 'check' ? 'check' : 'calc'); };
  const renameFig = (id: string, oldName: string, name: string) => edit(`Renamed ${oldName} to ${name.trim()}`, onDef((d) => renameFigure(d, id, name)));
  const renameSection = (gid: string, title: string) => edit(`Renamed the section to ${title.trim()}`, onDef((d) => renameGroup(d, gid, title)));
  const deleteFig = (id: string) => {
    const f = def.figures.find((x) => x.id === id);
    if (!f) return false;
    const isField = f.kind === 'input' || f.kind === 'setting';
    return edit(`Deleted ${f.name}`, both(onDef((d) => deleteFigure(d, id)), setValue(id, undefined)), () => {
      if (isField) setSelField(null); else { setSelState(null); setModal(false); }
    });
  };
  const deleteSection = (gid: string) => {
    const g = sectionOf(gid);
    return edit(`Deleted the ${g?.title ?? ''} section`, onDef((d) => deleteGroup(d, gid)), () => { setSelState(null); setSelField(null); setModal(false); });
  };
  const nameOfBox = (id: string) => { const b = bx.find((x) => x.id === id); return b ? (b.kind === 'output' ? b.act.title : b.fig.name) : id; };
  const connectTo = (src: string, targetId: string) => {
    reveal(targetId);
    const b = bx.find((x) => x.id === targetId);
    return edit(`Connected ${src} to ${nameOfBox(targetId)}`, onDef((d) => connect(d, src, targetId)), () => { if (b && b.kind !== 'output') { setSelState(targetId); setSelField(null); } });
  };
  const disconnectFrom = (src: string, targetId: string) => edit(`Removed the link from ${src} to ${nameOfBox(targetId)}`, onDef((d) => disconnect(d, src, targetId)));
  const setType = (f: Figure, t: FigureType) => edit(`Changed ${f.name} to ${t === 'money' ? 'Money (£)' : t === 'percent' ? 'Percent (%)' : 'Number'}`, onDef((d) => updateFigure(d, f.id, { type: t })));
  const updateExpected = (t: ShownResult) => edit(`Updated the expected ${t.name}`, onDay((d) => ({ ...d, expect: { ...d.expect, [t.id]: t.got! } })));
  const dropTest = (t: ShownResult) => edit('Removed a test', onDay((d) => { const expect = { ...d.expect }; delete expect[t.id]; return { ...d, expect }; }));
  const undoAll = () => base && edit('Undid all changes', (s) => ({ ...s, doc: structuredClone(base) }), () => { setSelState(null); setSelField(null); setModal(false); });

  const undo = () => { const l = h.undo(); toast(l ? `Undid: ${l}` : 'Nothing to undo', l ? { redo: true } : {}); };
  const redo = () => { const l = h.redo(); toast(l ? `Redid: ${l}` : 'Nothing to redo', l ? { undo: true } : {}); };
  const undoStep = (i: number) => { const r = h.undoStep(i); toast(r.message, r.ok ? {} : { bad: true }); };

  // Close the pop-up when its figure goes (deleted, or undone).
  useEffect(() => {
    if (sel && !secs.some((s) => s.id === sel) && !bx.some((b) => b.id === sel)) { setSelState(null); setModal(false); }
    if (selField && !fieldById(selField)) setSelField(null);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    user, view, rec, h, doc, def, base, baseIds, R, G, T, C, secs, bx, locked, save,
    vw, setVw, sel, selField, open, setSelState, setSelField, modal, setModal, inline, setInline, collapsed, setCollapsed, reveal,
    showLayers, setShowLayers, showPanel, setShowPanel, flash, setFlash, dialog, setDialog, toast, toastState, setToast,
    edit, live, commit, onDef, onDay, setValue, addInput, addSection, addCalc, addByKey, renameFig, renameSection, deleteFig, deleteSection,
    connectTo, disconnectFrom, setType, updateExpected, dropTest, undoAll, undo, redo, undoStep, sectionOf, fieldById,
    /** A message to show once the screen has started again from the record (after send, approve…). */
    notice: onNotice,
  };
}

export type Ws = ReturnType<typeof useWorkspace>;
const WsContext = createContext<Ws | null>(null);
export function useWs(): Ws {
  const v = useContext(WsContext);
  if (!v) throw new Error('useWs must be used inside the report builder');
  return v;
}
export type { Box, Change, Computed, Doc, Graph, History, Section, Snap };

/** The selection and everything that feeds it or it feeds, for "following" a figure. */
export const focusOf = (ws: Ws): Set<string> | null => (ws.sel && ws.sel in ws.G.up ? trace(ws.sel, ws.G) : null);

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
              {pending && mine && <button type="button" className="btn sm ghost" onClick={() => ws.setDialog('withdraw')}>Withdraw</button>}
              {pending && !mine && <>
                <button type="button" className="danger" onClick={() => ws.setDialog('reject')}>Turn down</button>
                <button type="button" className="btn sm" onClick={() => ws.setDialog('approve')}>Approve</button>
              </>}
              {!pending && <button type="button" className="btn sm" disabled={!ready || save.state === 'failed'} onClick={() => ws.setDialog('submit')}>Send for approval</button>}
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
            <small>“{rec.pending.summary}”. {rec.pending.by === user.name ? 'Someone else in head office needs to approve it. You can’t change it while it waits.' : 'Check the changes and tests, then approve it or turn it down.'}</small>
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
