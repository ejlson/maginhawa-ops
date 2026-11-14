/**
 * The rest of a site's day around the checklists and the EOD: problems reported for repair,
 * last night's handover note and whether it has been read, and handover notes anyone on the team adds. Saved on this device in demo mode;
 * connected mode will use the Repairs list and the EOD handover in SharePoint behind the same hooks.
 */
import { createContext, useContext } from 'react';
import type { NoteItem, Repair, StoredReport } from '@maginhawa/core';

/** A handover note from anyone on the team, for tomorrow's opener. */
export interface TeamNote { id: string; category: string; body: string; by: string; at: string }

/** What to hand over: the same categories as the EOD's Handover section. */
export const HANDOVER_CATS = ['Stock', 'Maintenance', 'Staff', 'Bookings', 'Other'];

export interface SiteValue {
  repairs: Repair[];
  open: Repair[];
  report: (r: Omit<Repair, 'id' | 'siteCode' | 'reportedAt' | 'fixedAt' | 'fixedBy'>) => void;
  markFixed: (id: string, by: string) => void;
  /** Last night's close, if it was saved on this device. */
  lastNight: StoredReport | null;
  /** Last night's handover: the closer's notes, then any the team added. */
  handover: NoteItem[];
  handoverBy: string | null;
  /** Notes the team has added to tonight's handover (anyone can; the closer sees them). */
  teamNotes: TeamNote[];
  addTeamNote: (category: string, body: string, by: string) => void;
  removeTeamNote: (id: string) => void;
  handoverRead: boolean;
  markHandoverRead: () => void;
}

export const Ctx = createContext<SiteValue | null>(null);

export function useSite(): SiteValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSite must be used inside SiteProvider');
  return v;
}
