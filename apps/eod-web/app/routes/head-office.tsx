import { SITES } from '@maginhawa/core';
import { SitesOverview } from '../components/SitesOverview';

/** Head office · all sites for the trading day. Approve the clean ones in one go. */
export default function HeadOffice() {
  return <SitesOverview sites={SITES} />;
}
