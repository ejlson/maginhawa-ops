/** Small words for the date line and the Up next pill. No React, so anything can import it. */

/** Service in words for the date line: "dinner service" from 17:00, "lunch service" from 11:00. */
export function service(d: Date, timeZone = 'Europe/London'): string {
  const h = Number(d.toLocaleString('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }));
  return h >= 17 && h < 24 ? ' · dinner service' : h >= 11 && h < 15 ? ' · lunch service' : '';
}

/** Where a section's figures come from, for the Up next pill. */
export function sectionHint(k: string): string {
  return k === 'lunch' || k === 'dinner' ? 'from the till report' : k === 'wages' ? 'from the rota' : k === 'delivery' ? 'from the apps' : k === 'tips' ? 'card, cash, tronc' : k === 'handover' ? 'notes for tomorrow' : 'a few taps';
}
