/**
 * The rest of a site's day around the checklists and the EOD: problems reported for repair,
 * last night's handover note and whether it has been read. Saved on this device in demo mode;
 * connected mode will use the Repairs list and the EOD handover in SharePoint behind the same hooks.
 */
import { createContext, useContext } from 'react';
import type { NoteItem, Repair, StoredReport } from '@maginhawa/core';

export interface SiteValue {
  repairs: Repair[];
  open: Repair[];
  report: (r: Omit<Repair, 'id' | 'siteCode' | 'reportedAt' | 'fixedAt' | 'fixedBy'>) => void;
  markFixed: (id: string, by: string) => void;
  /** Last night's close, if it was saved on this device. */
  lastNight: StoredReport | null;
  handover: NoteItem[];
  handoverBy: string | null;
  handoverRead: boolean;
  markHandoverRead: () => void;
}

export const Ctx = createContext<SiteValue | null>(null);

export function useSite(): SiteValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSite must be used inside SiteProvider');
  return v;
}
