/**
 * Scheduled Netlify Function: forecasts every site, service and metric 1–14 days ahead and logs it.
 * Runs at 05:30 UTC, after nightly-snapshot, so tonight's bookings are already saved.
 *
 * Not connected yet: until SharePoint is, it logs that it ran and does nothing.
 */
import { parseGovUkBankHolidays } from '@maginhawa/core';
import { createForecastJob } from '../../src/nightly';

export const config = { schedule: '30 5 * * *' };

export default async (): Promise<void> => {
  if (!process.env.SHAREPOINT_SITE_ID) {
    console.log('nightly-forecast: SharePoint not connected yet; nothing forecast.');
    return;
  }
  // Connection point:
  //   sites       → Sites list
  //   historyFor  → TradingSessions / TradingDays via Graph, then seriesFromReports()
  //   store       → SharePoint BookingSnapshots / ForecastLog lists
  const job = createForecastJob({
    sites: async () => [],
    historyFor: async () => [],
    holidays: async () => parseGovUkBankHolidays(await (await fetch('https://www.gov.uk/bank-holidays.json')).json()),
    store: { saveSnapshots: notReady, listSnapshots: notReady, saveForecasts: notReady, listForecasts: notReady },
  });
  console.log('nightly-forecast', JSON.stringify(await job()));
};

async function notReady(): Promise<never> {
  throw new Error('SharePoint store not connected yet.');
}
