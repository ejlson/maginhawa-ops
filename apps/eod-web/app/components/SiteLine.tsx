/**
 * The small site line at the top of a screen (designs P3, P5, S1, HS1, PM1): the site's badge, its name and
 * the trading day, with something on the right (Saved, Edit lists…). It replaces a repeated title in the bar.
 */
import type { ReactNode } from 'react';
import { formatDay, useDraft } from '../lib/draft';
import { SiteMono } from '../lib/site-colours';

export function SiteLine({ right }: { right?: ReactNode }) {
  const { settings, draft } = useDraft();
  return (
    <div className="close-top site-line">
      <span className="close-site"><SiteMono code={settings.siteCode} size="sm" />{settings.siteName} · {formatDay(draft.businessDate, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
      {right}
    </div>
  );
}
