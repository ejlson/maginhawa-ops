/**
 * Scheduled Netlify Function: saves covers on the books for the next 14 days, every night.
 * Runs at 05:15 UTC (05:15 GMT / 06:15 BST), after the 04:00 day close in both.
 *
 * Not connected yet: SharePoint (Graph) and the reservations system come later. Until then it
 * logs that it ran and saves nothing, so switching it on is only a matter of filling in the deps.
 */
import { createSnapshotJob } from '../../src/nightly';
import { forecastStoreNotReady } from '../../src/not-connected';

export const config = { schedule: '15 5 * * *' };

export default async (): Promise<void> => {
  if (!process.env.SHAREPOINT_SITE_ID) {
    console.log('nightly-snapshot: SharePoint not connected yet; nothing saved.');
    return;
  }
  // Connection point:
  //   sites        → Sites list (active sites, with their settings)
  //   store        → SharePoint BookingSnapshots / ForecastLog lists via Graph
  //   bookingsFor  → the reservations system's API (returns null for sites not on one yet)
  const job = createSnapshotJob({
    sites: async () => [],
    store: forecastStoreNotReady,
    bookingsFor: async () => null,
  });
  console.log('nightly-snapshot', JSON.stringify(await job()));
};
