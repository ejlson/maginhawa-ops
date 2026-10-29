import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  SETTINGS_GROUP, addFigure, addGroup, connect, definitionGroups, deleteFigure, deleteGroup, disconnect, renameFigure, renameGroup, uniqueName, updateFigure, type Figure, type FigureType, type ReportDefinition, type TestDay,
} from '@maginhawa/core';
import type { User } from '../../lib/auth';
import { loadLayout, saveLayout } from '../../lib/report-builder/backend';
import { useHistory, type Apply, type History, type Snap } from '../../lib/report-builder/history';
import {
  CLUSTERS, boxes, changes, clusterOf, compute, graph, newId, sections, testDay, testResults, trace, type Box, type Change, type Computed, type Doc, type Graph, type Section, type ShownResult,
} from '../../lib/report-builder/model';
import { baseOf, docOf, type DefinitionSave } from '../../lib/report-builder/save';
import type { DialogKind } from './ActionDialog';

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

export function useWorkspace(save: DefinitionSave, user: User, onNotice: (msg: string) => void) {
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
export const WsContext = createContext<Ws | null>(null);
export function useWs(): Ws {
  const v = useContext(WsContext);
  if (!v) throw new Error('useWs must be used inside the report builder');
  return v;
}
export type { Box, Change, Computed, Doc, Graph, History, Section, Snap };

/** The selection and everything that feeds it or it feeds, for "following" a figure. */
export const focusOf = (ws: Ws): Set<string> | null => (ws.sel && ws.sel in ws.G.up ? trace(ws.sel, ws.G) : null);
