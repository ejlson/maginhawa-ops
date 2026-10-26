/** The EOD summary email finance receives. Pure function: the server decides how to send it. */
import { formatPounds } from './money';
import type { StoredReport } from './store';
import type { SiteSettings } from './settings';

export interface EmailMessage {
  subject: string;
  text: string;
}

export function eodSummaryEmail(r: StoredReport, settings: Pick<SiteSettings, 'siteName'>): EmailMessage {
  const o = r.official;
  const d = r.draft;
  const date = new Date(`${d.businessDate}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  if (!o) return { subject: `EOD · ${settings.siteName} · ${date}`, text: 'No figures.' };

  const lines = [
    `${settings.siteName} · ${date}`,
    `Submitted ${r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : ''} by ${r.submittedBy ?? 'unknown'}`,
    '',
    `Net sales: ${formatPounds(o.totalNet)}${o.netVsTarget !== null ? ` (${o.netVsTarget >= 0 ? '+' : '−'}${formatPounds(Math.abs(o.netVsTarget))} vs target)` : ''}`,
    `Covers: ${o.covers}`,
    `Net a head (dine-in): ${o.perHeadDineIn !== null ? formatPounds(o.perHeadDineIn) : '—'}`,
    `Wages: ${o.wagePct !== null ? `${o.wagePct}% (${o.wageRag})` : '—'}`,
    '',
  ];
  for (const k of ['lunch', 'dinner'] as const) {
    const s = o.sessions[k];
    if (!s.ran) { lines.push(`${k === 'lunch' ? 'Lunch' : 'Dinner'}: didn't run`); continue; }
    const cashText = s.cash.difference === null ? 'not counted' : s.cash.status === 'balanced' ? 'balanced' : `${formatPounds(Math.abs(s.cash.difference))} ${s.cash.status} · ${d.sessions[k].cash.reason ?? ''}`;
    lines.push(`${k === 'lunch' ? 'Lunch' : 'Dinner'}: ${formatPounds(s.net)} net · ${s.covers} covers · cash ${cashText}`);
  }
  for (const del of o.delivery) {
    lines.push(`${del.name}: ${del.traded ? `${formatPounds(del.gross)} gross · ${formatPounds(del.net)} estimated net${del.refundPending ? ' · refund pending' : ''}` : "didn't trade"}`);
  }
  const notes = r.issues.filter((i) => i.level === 'warn');
  if (notes.length) {
    lines.push('', 'To look at:');
    for (const i of notes) lines.push(`• ${i.title}`);
  }
  if (d.handover.length) {
    lines.push('', 'Handover:');
    for (const h of d.handover) lines.push(`• ${h.category}: ${h.body}`);
  }
  const subject = `EOD · ${settings.siteName} · ${date} · ${formatPounds(o.totalNet)} net${notes.length ? ` · ${notes.length} to look at` : ''}`;
  return { subject, text: lines.join('\n') };
}
