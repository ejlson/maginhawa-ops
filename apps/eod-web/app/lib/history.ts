/**
 * Daily trading history for head office's trends. Demo mode uses example history; once connected,
 * this reads TradingDays / TradingSessions from SharePoint (not built yet, so it's empty there).
 */
import { useMemo } from 'react';
import { addDays, type TradingDayRow } from '@maginhawa/core';
import { showExampleData } from './config';
import { demoHistory } from './demo-history';
import { useDraft } from './draft';

export function useTradingHistory(): { rows: TradingDayRow[]; example: boolean; lastDate: string } {
  const { draft } = useDraft();
  // Trends run up to the last finished trading day; today's close is still coming in.
  const lastDate = addDays(draft.businessDate, -1);
  const example = showExampleData();
  const rows = useMemo(() => (example ? demoHistory(lastDate) : []), [example, lastDate]);
  return { rows, example, lastDate };
}
