/**
 * Undo for each step, as in the prototype: every change is kept as a step that knows how to redo itself, so any
 * single step can be undone later (go back to before it, then replay the steps after it).
 * Steps must look things up by id and never hold on to objects.
 */
import { useCallback, useRef, useState } from 'react';
import { EditError } from '@maginhawa/core';
import type { Doc } from './model';

/** What a step changes: the draft, and where cards were moved by hand (a screen preference, not saved in the draft). */
export interface Snap { doc: Doc; pos: Record<string, { x: number; y: number }>; tidy: boolean }
export type Apply = (s: Snap) => Snap;
export interface Step { label: string; apply: Apply; before: Snap; at: number }
interface Redo extends Step { after: Snap }

export interface History {
  snap: Snap;
  steps: Step[];
  redoLabel: string | null;
  /** Runs an edit as a step. Returns an EditError's message if the engine refused it (nothing changes). */
  edit(label: string, apply: Apply): string | null;
  /** Changes made while typing: shown at once, kept as one step when typing stops (commit). */
  live(apply: Apply): void;
  commit(label: string, apply: Apply): void;
  undo(): string | null;
  redo(): string | null;
  /** Undoes one step from the middle and keeps the ones after it. Returns a message if a later step needs it. */
  undoStep(i: number): { ok: boolean; message: string };
  /** Starts again from this (after loading, reloading or discarding). History is cleared. */
  reset(s: Snap): void;
}

const same = (a: Snap, b: Snap) => JSON.stringify(a) === JSON.stringify(b);

export function useHistory(initial: () => Snap): History {
  const [, setTick] = useState(0);
  const st = useRef<{ snap: Snap; steps: Step[]; redo: Redo[]; typing: Snap | null } | null>(null);
  if (!st.current) st.current = { snap: initial(), steps: [], redo: [], typing: null };
  const s = st.current;
  const bump = useCallback(() => setTick((n) => n + 1), []);

  const push = (step: Step) => { s.steps.push(step); if (s.steps.length > 100) s.steps.shift(); s.redo = []; };

  const edit = useCallback((label: string, apply: Apply) => {
    let next: Snap;
    try { next = apply(s.snap); } catch (e) {
      if (e instanceof EditError) return e.message;
      throw e;
    }
    s.typing = null;
    push({ label, apply, before: s.snap, at: Date.now() });
    s.snap = next;
    bump();
    return null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const live = useCallback((apply: Apply) => {
    if (!s.typing) s.typing = s.snap;
    s.snap = apply(s.snap);
    bump();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback((label: string, apply: Apply) => {
    const before = s.typing ?? s.snap;
    s.typing = null;
    if (same(before, s.snap)) return;
    push({ label, apply, before, at: Date.now() });
    bump();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const undo = useCallback(() => {
    const step = s.steps.pop();
    if (!step) return null;
    s.redo.push({ ...step, after: s.snap });
    s.snap = step.before;
    s.typing = null;
    bump();
    return step.label;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const redo = useCallback(() => {
    const r = s.redo.pop();
    if (!r) return null;
    s.steps.push({ label: r.label, apply: r.apply, before: s.snap, at: r.at });
    s.snap = r.after;
    bump();
    return r.label;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const undoStep = useCallback((i: number) => {
    const target = s.steps[i];
    if (!target) return { ok: false, message: 'Nothing to undo' };
    if (i === s.steps.length - 1) { undo(); return { ok: true, message: `Undid: ${target.label}` }; }
    let cur = target.before;
    const kept = s.steps.slice(0, i);
    try {
      for (const later of s.steps.slice(i + 1)) { const b = cur; cur = later.apply(cur); kept.push({ ...later, before: b }); }
    } catch (e) {
      if (e instanceof EditError) return { ok: false, message: `Can’t undo “${target.label}” on its own: a later step needs it. ${e.message}` };
      throw e;
    }
    s.steps = kept;
    s.redo = [];
    s.snap = cur;
    s.typing = null;
    bump();
    return { ok: true, message: `Undid: ${target.label}` };
  }, [undo]); // eslint-disable-line react-hooks/exhaustive-deps

  // The callbacks above keep hold of this one object, so change it in place.
  const reset = useCallback((snap: Snap) => { Object.assign(s, { snap, steps: [], redo: [], typing: null }); bump(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { snap: s.snap, steps: s.steps, redoLabel: s.redo.at(-1)?.label ?? null, edit, live, commit, undo, redo, undoStep, reset };
}
