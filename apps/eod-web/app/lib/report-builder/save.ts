/**
 * Loading and saving the report builder's record: the draft saves itself a moment after each change (PUT with
 * If-Match), and Send / Approve / Reject / Withdraw / Discard / Roll back go through the same backend.
 * When someone else saved first, the conflict is kept so the screen can show their change and offer a reload.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { editableDefinition, latestDefinition, type DefinitionRecord } from '@maginhawa/core';
import { autosaveDelayMs, DefinitionConflict, DefinitionRefused, definitionBackend, type DefinitionAction, type DefinitionView } from './backend';
import type { Doc } from './model';

export type SaveState = 'saved' | 'waiting' | 'saving' | 'failed';

/** What the builder opens: the change waiting for approval, the draft, or the newest version. */
export const docOf = (rec: DefinitionRecord): Doc => structuredClone(editableDefinition(rec));
/** The newest approved version, which a draft is compared with. */
export const baseOf = (rec: DefinitionRecord): Doc | null => {
  const v = latestDefinition(rec);
  return v ? structuredClone({ definition: v.definition, testDays: v.testDays }) : null;
};
const key = (d: Doc) => JSON.stringify(d);

export function useDefinitionSave(user: { name: string; siteCode: string }) {
  const backend = useRef(definitionBackend(() => user.name, user.siteCode)).current;
  const [view, setView] = useState<DefinitionView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Goes up each time the screen should start again from the record (load, reload, discard, approve…). */
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<SaveState>('saved');
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DefinitionView | null>(null);

  const r = useRef({ view: null as DefinitionView | null, saved: '', pending: null as Doc | null, timer: 0 as ReturnType<typeof setTimeout> | 0, busy: null as Promise<void> | null, conflict: false });

  const show = useCallback((v: DefinitionView, restart: boolean) => {
    r.current.view = v;
    setView(v);
    if (restart) { r.current.saved = key(docOf(v.record)); setGeneration((g) => g + 1); }
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      show(await backend.load(), true);
      r.current.conflict = false;
      setConflict(null); setState('saved'); setError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'The report builder couldn’t load.');
    }
  }, [backend, show]);
  useEffect(() => { void load(); }, [load]);

  const caught = (e: unknown) => {
    if (e instanceof DefinitionConflict) {
      r.current.conflict = true;
      setConflict(e.current);
      setState('failed');
      setError(e.message);
      return e.message;
    }
    const msg = e instanceof Error ? e.message : 'That didn’t work. Try again.';
    if (!(e instanceof DefinitionRefused)) { setState('failed'); setError(msg); }
    return msg;
  };

  /** Saves whatever is waiting, now. */
  const flush = useCallback(async (): Promise<boolean> => {
    const c = r.current;
    if (c.timer) { clearTimeout(c.timer); c.timer = 0; }
    if (c.busy) await c.busy;
    const doc = c.pending;
    if (!doc || c.conflict || !c.view) return !c.conflict;
    c.pending = null;
    if (key(doc) === c.saved) { setState('saved'); return true; }
    setState('saving');
    let ok = true;
    c.busy = backend.saveDraft(doc, c.view.etag).then((v) => {
      c.saved = key(doc);
      show(v, false);
      if (!c.pending) { setState('saved'); setError(null); }
    }, (e) => { ok = false; caught(e); c.pending = c.pending ?? doc; }).finally(() => { c.busy = null; });
    await c.busy;
    return ok;
  }, [backend, show]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The screen calls this after every change; the draft saves a moment after the last one. */
  const changed = useCallback((doc: Doc) => {
    const c = r.current;
    if (c.conflict || key(doc) === c.saved && !c.pending) return;
    c.pending = doc;
    setState('waiting');
    if (c.timer) clearTimeout(c.timer);
    c.timer = setTimeout(() => { c.timer = 0; void flush(); }, autosaveDelayMs());
  }, [flush]);

  // Leaving the screen saves what's waiting.
  useEffect(() => () => { if (r.current.pending) void flush(); }, [flush]);

  /** Send, approve and the rest. Saves first. Returns a message to show when it didn't happen. */
  const act = useCallback(async (body: DefinitionAction): Promise<string | null> => {
    if (!(await flush())) return error ?? 'Save the draft first.';
    const c = r.current;
    if (!c.view) return 'Still loading.';
    try {
      show(await backend.act(body, c.view.etag), true);
      setState('saved'); setError(null);
      return null;
    } catch (e) {
      return caught(e);
    }
  }, [backend, flush, show, error]); // eslint-disable-line react-hooks/exhaustive-deps

  /** After a conflict: take the other person's version. */
  const reload = useCallback(() => {
    const c = r.current;
    if (c.timer) clearTimeout(c.timer);
    Object.assign(c, { pending: null, timer: 0, conflict: false });
    if (conflict) { show(conflict, true); setConflict(null); setState('saved'); setError(null); } else void load();
  }, [conflict, load, show]);

  return { view, loadError, generation, state, error, conflict, changed, flush, act, reload, retry: load };
}
export type DefinitionSave = ReturnType<typeof useDefinitionSave>;
