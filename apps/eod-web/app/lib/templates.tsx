/**
 * The checklist definitions: drafts and published versions, saved on this device.
 * Connected mode will read and write the ChecklistTemplates and Checkpoints lists in SharePoint
 * through the functions, behind the same useTemplates() hook.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  addOnFor, archive, canEditList, editableTemplate, recordStatus, tradingDate, EXAMPLE_TEMPLATES, newAddOn, newRecord, publish, seedRecords, uniqueId,
  type ChecklistTemplate, type TemplateRecord,
} from '@maginhawa/core';
import { storage } from './storage';
import { now } from './clock';
import { useAuth } from './auth';
import { settingsFor } from './draft';

const KEY = 'mgh.templates.v1';

interface TemplatesValue {
  records: TemplateRecord[];
  recordFor: (id: string) => TemplateRecord | undefined;
  /** Starts a new list and returns its id. */
  create: (o: { scope: 'group' | 'site'; siteCode?: string; by: string }) => string;
  /** Opens one site's own checks on a group list, starting them if needed, and returns their id. */
  addChecks: (groupId: string, siteCode: string, by: string) => string;
  /** Saves changes to the draft, starting one from the live version if needed. */
  edit: (id: string, change: (t: ChecklistTemplate) => ChecklistTemplate) => void;
  publish: (id: string, today: string, by: string) => void;
  /** Throws away unpublished changes. A list that was never published is removed. */
  discard: (id: string) => void;
  stop: (id: string, today: string) => void;
}

const Ctx = createContext<TemplatesValue | null>(null);

export function TemplatesProvider({ children, initial }: { children: ReactNode; initial?: TemplateRecord[] }) {
  const [records, setRecords] = useState<TemplateRecord[]>(() => initial ?? storage.get(KEY, seedRecords(EXAMPLE_TEMPLATES)));

  const save = useCallback((change: (r: TemplateRecord[]) => TemplateRecord[]) => {
    setRecords((prev) => {
      const next = change(prev);
      storage.set(KEY, next);
      return next;
    });
  }, []);

  const update = useCallback((id: string, change: (r: TemplateRecord) => TemplateRecord | null) => {
    save((all) => all.flatMap((r) => (r.id === id ? [change(r)].filter((x): x is TemplateRecord => x !== null) : [r])));
  }, [save]);

  const value = useMemo<TemplatesValue>(() => ({
    records,
    recordFor: (id) => records.find((r) => r.id === id),
    create: (o) => {
      const id = uniqueId(`list-${Date.now().toString(36)}`, records.map((r) => r.id));
      save((all) => [...all, newRecord({ id, ...o })]);
      return id;
    },
    addChecks: (groupId, siteCode, by) => {
      const found = addOnFor(records, groupId, siteCode);
      // Checks that were removed start again from an empty draft; nothing runs until it is published.
      if (found && recordStatus(found, tradingDate(now(), settingsFor(siteCode))) === 'archived') {
        update(found.id, (r) => ({ ...r, draft: { ...editableTemplate(r)!, checkpoints: [] } }));
      }
      if (found) return found.id;
      const group = records.find((r) => r.id === groupId);
      if (!group) throw new Error(`No list ${groupId}`);
      const rec = newAddOn(group, { siteCode, by });
      save((all) => [...all, rec]);
      return rec.id;
    },
    edit: (id, change) => update(id, (r) => {
      const draft = change(structuredClone(editableTemplate(r)!));
      // Where a list applies is only chosen before it is first published.
      return r.versions.length ? { ...r, draft: { ...draft, scope: r.scope, siteCode: r.siteCode } } : { ...r, draft, scope: draft.scope, siteCode: draft.siteCode };
    }),
    publish: (id, today, by) => update(id, (r) => publish(r, { today, by, at: now().toISOString() })),
    discard: (id) => update(id, (r) => (r.versions.length ? { ...r, draft: null } : null)),
    stop: (id, today) => update(id, (r) => archive(r, today)),
  }), [records, save, update]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTemplates(): TemplatesValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTemplates must be used inside TemplatesProvider');
  return v;
}

export const editPath = (id: string) => `/checklists/edit/${encodeURIComponent(id)}`;
export const checkPath = (id: string, checkId: string) => `${editPath(id)}/check/${encodeURIComponent(checkId)}`;

/** One list in the builder: what to show, and whether this person may change it. */
export function useListEditor(id: string) {
  const { user } = useAuth();
  const businessDate = user ? tradingDate(now(), settingsFor(user.siteCode)) : '';
  const store = useTemplates();
  const rec = store.recordFor(id);
  const template = rec ? editableTemplate(rec) : null;
  const status = rec ? recordStatus(rec, businessDate) : null;
  const editable = Boolean(rec && user && canEditList(user, rec) && status !== 'archived');
  const edit = (change: (t: ChecklistTemplate) => ChecklistTemplate) => { if (editable) store.edit(id, change); };
  return { rec, template, status, editable, edit, businessDate, user, store };
}
