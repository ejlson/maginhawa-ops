import { useMemo } from 'react';
import { checklistEvents, dayBounds, eodEvents, repairEvents } from '@maginhawa/core';
import { formatDay, useDraft } from '../lib/draft';
import { runPath, useChecklists } from '../lib/checklists';
import { useSite } from '../lib/site';
import { Nav } from '../components/ui';
import { DayTimeline } from '../components/DayTimeline';

/** The site's trading day hour by hour, day-close to day-close: what was done, by whom, and what was missed. */
export default function Day() {
  const { tasks, businessDate } = useChecklists();
  const { repairs } = useSite();
  const { report, settings } = useDraft();
  const bounds = useMemo(() => dayBounds(businessDate, settings.dayCloseTime, settings.timezone), [businessDate, settings.dayCloseTime, settings.timezone]);
  const events = useMemo(() => [
    ...checklistEvents(tasks.map((t) => ({ key: t.key, title: t.title, dueAt: t.dueAt, status: t.status, run: t.run, template: t.template })), runPath),
    ...repairEvents(repairs.filter((r) => r.siteCode === settings.siteCode), bounds.start, bounds.end),
    ...eodEvents(report),
  ], [tasks, repairs, report, bounds, settings.siteCode]);

  return (
    <main className="page day-page">
      <Nav back="/" backLabel="Home" title="Timeline" />
      <div className="body">
        <div className="titleblock">
          <span className="eyebrow">{settings.siteName} · {formatDay(businessDate)}</span>
          <h1>The day so far</h1>
        </div>
        <DayTimeline events={events} bounds={bounds} timezone={settings.timezone} dayCloseTime={settings.dayCloseTime} />
      </div>
    </main>
  );
}
