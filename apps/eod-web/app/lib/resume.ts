/**
 * "Pick up where you left off". Managers get pulled away mid-section (the safe, a guest, a delivery),
 * so each device remembers the last EOD field typed in and the hub offers to reopen it.
 * Kept on this device only: it is about this person's place, not the shared report.
 */
import { useCallback, useEffect, type FocusEvent } from 'react';
import { useLocation } from 'react-router';
import type { SectionKey } from '@maginhawa/core';
import { storage } from './storage';
import { now } from './clock';

export interface ResumePlace {
  section: SectionKey;
  /** The field's accessible name, e.g. "Gross sales". Also how the field is found again. */
  field: string;
  /** When it was last touched (ms). */
  at: number;
}

/** How long someone must have been away before the hub offers to take them back. */
export const AWAY_MS = 2 * 60_000;

const key = (siteCode: string, businessDate: string) => `maginhawa.resume.${siteCode}.${businessDate}`;

export function readResume(siteCode: string, businessDate: string): ResumePlace | null {
  return storage.get<ResumePlace | null>(key(siteCode, businessDate), null);
}

/** Put on a section's wrapper: remembers each field the person moves into. */
export function useTrackPlace(siteCode: string, businessDate: string, section: SectionKey) {
  return useCallback((e: FocusEvent<HTMLElement>) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    const field = el.getAttribute('aria-label') ?? el.labels?.[0]?.textContent?.trim();
    if (field) storage.set(key(siteCode, businessDate), { section, field, at: now().getTime() } satisfies ResumePlace);
  }, [siteCode, businessDate, section]);
}

/** The link that reopens a section at a field. */
export const resumePath = (p: ResumePlace) => `/close/${p.section}?at=${encodeURIComponent(p.field)}`;

/** On a section screen opened from that link: scroll the field into view and put the cursor in it. */
export function useRestorePlace() {
  const { search } = useLocation();
  useEffect(() => {
    const field = new URLSearchParams(search).get('at');
    if (!field) return;
    const frame = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`main [aria-label="${CSS.escape(field)}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'center' });
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [search]);
}
