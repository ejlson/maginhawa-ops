/**
 * The report builder's live version, for the managers' EOD.
 * Connected: asked from the server for the report's trading day (managers only ever get the live version).
 * Demo: today's rules, or a version saved on this device for trying a builder change out.
 */
import { useEffect, useState } from 'react';
import { seedDefinitionRecord, type DefinitionRecord, type DefinitionVersion } from '@maginhawa/core';
import { isConnected } from './config';
import { apiGet } from './sync';
import { storage } from './storage';

const DEMO_KEY = 'mgh.definitions';
const TODAYS_RULES = seedDefinitionRecord({ startsOn: '2000-01-01', by: 'Finance', at: '2000-01-01T00:00:00Z' });

/** Demo mode: the versions saved on this device, or today's rules. */
export function demoDefinitions(): DefinitionRecord {
  return storage.get<DefinitionRecord | null>(DEMO_KEY, null) ?? TODAYS_RULES;
}
/** Demo mode and tests: use these versions on this device. Null goes back to today's rules. */
export function setDemoDefinitions(record: DefinitionRecord | null) {
  if (record) storage.set(DEMO_KEY, record); else storage.remove(DEMO_KEY);
}

const asRecord = (v: DefinitionVersion | null): DefinitionRecord => ({ key: 'eod', versions: v ? [v] : [], draft: null, pending: null });

/** The versions for a trading day. Null while loading, or when the server can't be reached (today's rules apply). */
export function useLiveDefinitions(businessDate: string): DefinitionRecord | null {
  const [record, setRecord] = useState<DefinitionRecord | null>(() => (isConnected() ? null : demoDefinitions()));
  useEffect(() => {
    if (!isConnected()) { setRecord(demoDefinitions()); return; }
    let live = true;
    apiGet<{ version: DefinitionVersion | null }>(`report-definition?date=${businessDate}`)
      .then((r) => { if (live) setRecord(r ? asRecord(r.version) : null); })
      .catch(() => { if (live) setRecord(null); });
    return () => { live = false; };
  }, [businessDate]);
  return record;
}

/**
 * For head office's views of reports still in progress (submitted ones already carry their official figures).
 * Demo: the versions on this device. Connected: null until head office's views load versions, so they show today's rules.
 */
export const previewDefinitions = (): DefinitionRecord | null => (isConnected() ? null : demoDefinitions());
