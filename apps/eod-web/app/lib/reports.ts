/**
 * The rows finance searches. Demo mode turns the example trading history into reports, adding made-up
 * managers and notes, and treats anything older than eight weeks as imported from the old workbook.
 * Once connected, this reads TradingDays (app and imported rows) from SharePoint (not built yet).
 */
import { useMemo } from 'react';
import { addDays, type ReportRow } from '@maginhawa/core';
import { useTradingHistory } from './history';

const MANAGERS: Record<string, string[]> = {
  BIN: ['Tom', 'Lea'], GUA: ['Marco', 'Jo'], BEL: ['Sam', 'Nina'], RAM: ['Chris', 'Ivy'], HOO: ['Dan', 'Mei'],
  BUN: ['Ana', 'Raf'], CAF: ['Bea'], MKT: ['Priya', 'Joel'], MCT: ['Kit', 'Lou'],
};

const NOTES: { note: string; discounts?: string[]; voids?: string[] }[] = [
  { note: 'Deliveroo refund for a missing side. Finance to follow up.' },
  { note: 'Agency chef covered dinner, two kitchen staff off sick.' },
  { note: 'Freezer door seal reported to maintenance.' },
  { note: 'Large birthday booking with 15% off agreed by ops.', discounts: ['Manager discount 15%'] },
  { note: 'Quiet, rain all day. Sent one FOH home early.' },
  { note: 'Uber Eats tablet offline for an hour. Refund pending for a cold order.', voids: ['W3 Cold food returned'] },
  { note: 'Till float counted twice, corrected next morning.' },
  { note: 'Comp for a wrong order on table 12.', discounts: ['Customer complaint · food'], voids: ['W2 Dropped plate'] },
  { note: 'Walk-ins strong after the match. Ran out of lechon by 9pm.', voids: ['NW1 Out of stock'] },
  { note: 'Staff meal over budget, employee dining applied.', discounts: ['Employee dining 20%'] },
];

function hash(s: string) {
  return [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 2166136261);
}

export function useReportRows(): { rows: ReportRow[]; example: boolean; lastDate: string } {
  const { rows: history, example, lastDate } = useTradingHistory();
  const rows = useMemo(() => {
    const appStart = addDays(lastDate, -55);
    return history.map((r): ReportRow => {
      const h = hash(r.siteCode + r.date);
      const people = MANAGERS[r.siteCode] ?? ['Manager'];
      const extra = h % 7 === 0 || r.cashDiff ? NOTES[(h >>> 3) % NOTES.length]! : null;
      return {
        ...r,
        source: r.date < appStart ? 'workbook' : 'app',
        manager: people[(h >>> 8) % people.length],
        notes: r.cashDiff && !extra?.note.includes('float') ? `Cash ${r.cashDiff < 0 ? 'short' : 'over'}, explained on the night.${extra ? ' ' + extra.note : ''}` : extra?.note,
        discounts: extra?.discounts,
        voids: extra?.voids,
      };
    });
  }, [history, lastDate]);
  return { rows, example, lastDate };
}
