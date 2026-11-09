import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  addOnFor, archive, editableTemplate, moveRecord, moveRecordTo, recordStatus, tradingDate, EXAMPLE_TEMPLATES, newAddOn, newRecord, publish, seedRecords, uniqueId, type TemplateRecord,
} from '@maginhawa/core';
import { storage } from './storage';
import { now } from './clock';
import { settingsFor } from './draft';
import { type TemplatesValue, Ctx } from './templates';

const KEY = 'mgh.templates.v1';

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
    move: (id, by, sameGroup) => save((all) => moveRecord(all, id, by, sameGroup)),
    moveTo: (id, to, sameGroup) => save((all) => moveRecordTo(all, id, to, sameGroup)),
  }), [records, save, update]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
