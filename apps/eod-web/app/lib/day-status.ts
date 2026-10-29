/** How head office words a checklist's or an EOD's state, in lists and on day pages. */
import { clockTime, computeDayWith, formatPounds, type SiteSettings, type StoredReport, type TaskStatus } from '@maginhawa/core';
import { previewDefinitions } from './definition';

const STATUS: Record<TaskStatus, { text: string; cls: string }> = {
  done: { text: 'Done', cls: 'p-ok' }, failed: { text: 'Done with a fix', cls: 'p-warn' }, missed: { text: 'Missed', cls: 'p-bad' },
  late: { text: 'Late', cls: 'p-bad' }, due: { text: 'Due now', cls: 'p-warn' }, upcoming: { text: 'Coming up', cls: 'p-mut' }, anytime: { text: 'When needed', cls: 'p-mut' },
};
export const taskStatusPill = (s: TaskStatus) => STATUS[s];

export function eodPill(r: StoredReport): { text: string; cls: string } {
  if (r.status === 'approved') return { text: 'Approved', cls: 'p-ok' };
  if (r.status === 'draft') return { text: 'Not sent', cls: 'p-warn' };
  const warn = r.issues.filter((i) => i.level === 'warn').length;
  return warn ? { text: `${warn} to check`, cls: 'p-warn' } : { text: 'Submitted', cls: 'p-ok' };
}
export const eodStatusText = (r: StoredReport) => (r.submittedAt ? `Sent ${clockTime(r.submittedAt)}${r.submittedBy ? ` by ${r.submittedBy}` : ''}` : 'In progress');
export function eodSubText(r: StoredReport, settings: SiteSettings) {
  const o = r.official ?? computeDayWith(r.draft, settings, undefined, previewDefinitions());
  const cashDiff = (o.sessions.lunch.cash.difference ?? 0) + (o.sessions.dinner.cash.difference ?? 0);
  return [`${o.covers} covers`, o.wagePct !== null ? `wages ${o.wagePct}%` : null, cashDiff ? `${formatPounds(Math.abs(cashDiff))} ${cashDiff < 0 ? 'short' : 'over'}` : 'cash balanced'].filter(Boolean).join(' · ');
}
