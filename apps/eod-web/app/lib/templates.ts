/**
 * The checklist definitions: drafts and published versions, saved on this device.
 * Connected mode will read and write the ChecklistTemplates and Checkpoints lists in SharePoint
 * through the functions, behind the same useTemplates() hook.
 */
import { createContext, useContext } from 'react';
import { canEditList, editableTemplate, recordStatus, tradingDate, publish, type ChecklistTemplate, type TemplateRecord } from '@maginhawa/core';
import { now } from './clock';
import { useAuth } from './auth';
import { settingsFor } from './draft';

export interface TemplatesValue {
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
  /** Moves a list up or down among the lists it's shown with. Takes effect straight away. */
  move: (id: string, by: -1 | 1, sameGroup: (r: TemplateRecord) => boolean) => void;
}

export const Ctx = createContext<TemplatesValue | null>(null);

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
