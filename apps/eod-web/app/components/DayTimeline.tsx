import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { buildTimeline, DAY_FILTERS, type DayEvent, type DayFilter, type TimelineHour } from '@maginhawa/core';
import { now } from '../lib/clock';
import { useMinuteTick } from './home/shared-helpers';
import { Icon } from './ui';
import { ICONS } from './ui-helpers';

const KIND_ICON: Record<DayEvent['kind'], string> = {
  checklist: ICONS.check, missed: ICONS.bang, due: ICONS.clock, fix: ICONS.wrench, repair: ICONS.wrench, fixed: ICONS.check, eod: ICONS.list,
};
const TONE_RANK: Record<DayEvent['tone'], number> = { mut: 0, ok: 1, warn: 2, bad: 3 };
const time = (iso: string, tz: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz });

/** The trading day as a calendar day view: a 24-hour strip, filters, then every event placed at its time. Used for a site's own day and on head office's site pages. */
export function DayTimeline({ events, bounds, timezone, dayCloseTime, linkEvents = true }: {
  events: DayEvent[]; bounds: { start: Date; end: Date }; timezone: string; dayCloseTime: string; linkEvents?: boolean;
}) {
  useMinuteTick();
  const [filter, setFilter] = useState<DayFilter>('all');
  const at = now();
  const day = buildTimeline(events, bounds, at, timezone, filter);
  const settings = { timezone, dayCloseTime };
  const most = Math.max(1, ...day.hours.map((h) => h.events.length));

  return (
    <>
    <div className="hero" role="img" aria-label={`${day.done} checklists done, ${day.missed} missed, ${day.fixes} fixes, ${day.repairs} repairs reported`}>
      <div className="hero-row"><span className="hl">{settings.dayCloseTime} to {settings.dayCloseTime}</span><span className="hs-small">Now {time(at.toISOString(), settings.timezone)}</span></div>
      <div className="day-strip" aria-hidden="true">
        {day.hours.map((h) => {
          const worst = h.events.reduce<DayEvent['tone'] | null>((w, e) => (!w || TONE_RANK[e.tone] > TONE_RANK[w] ? e.tone : w), null);
          return (
            <span key={h.start} className={`${h.past || h.current ? '' : 'future'} ${h.current ? 'now' : ''}`}>
              <i className={worst ? `t-${worst}` : ''} style={{ height: h.events.length ? `${20 + (h.events.length / most) * 80}%` : undefined }} />
            </span>
          );
        })}
      </div>
      <div className="day-axis" aria-hidden="true"><span>{day.hours[0]?.label}</span><span>{day.hours[12]?.label}</span><span>{day.hours[day.hours.length - 1]?.label}</span></div>
      <div className="hm">
        <span>{day.done}<small>Checklists done</small></span>
        <span className={day.missed ? 'h-bad' : ''}>{day.missed}<small>Missed</small></span>
        <span className={day.fixes + day.repairs ? 'h-warn' : ''}>{day.fixes + day.repairs}<small>Fixes &amp; repairs</small></span>
      </div>
    </div>

    <div className="chips" role="group" aria-label="Show">
      {DAY_FILTERS.map((f) => <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}
    </div>

    <DayGrid hours={day.hours} start={bounds.start} at={at} tz={settings.timezone} linkEvents={linkEvents} />
    </>
  );
}

const HOUR = 64; // px per hour, like Calendar's day view
const BLOCK = 46; // events are moments, so each gets a fixed-height block

/** Lay events out like Calendar's day view: placed by time, side by side where they would overlap. */
function place(events: DayEvent[], start: Date) {
  const items = events.map((e) => ({ e, top: ((new Date(e.at).getTime() - start.getTime()) / 3_600_000) * HOUR, col: 0, cols: 1 }));
  let group: typeof items = [];
  let groupEnd = -Infinity;
  const close = () => { const n = Math.max(...group.map((g) => g.col)) + 1; group.forEach((g) => { g.cols = n; }); };
  for (const it of items) {
    if (it.top >= groupEnd && group.length) { close(); group = []; }
    const taken = new Set(group.filter((g) => g.top + BLOCK > it.top).map((g) => g.col));
    while (taken.has(it.col)) it.col++;
    group.push(it);
    groupEnd = Math.max(groupEnd, it.top + BLOCK);
  }
  if (group.length) close();
  return items;
}

function DayGrid({ hours, start, at, tz, linkEvents }: { hours: TimelineHour[]; start: Date; at: Date; tz: string; linkEvents: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const nowTop = ((at.getTime() - start.getTime()) / 3_600_000) * HOUR;
  const inDay = nowTop >= 0 && nowTop < hours.length * HOUR;
  const items = place(hours.flatMap((h) => h.events), start);

  // Open on the current time, with a little of the morning above it, as Calendar does.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && inDay) el.scrollTop = Math.max(0, nowTop - HOUR * 1.5);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="cal" ref={scroller} role="region" aria-label="Day view" tabIndex={0}>
      <div className="cal-grid" style={{ height: hours.length * HOUR + 16 }}>
        {hours.map((h, i) => (
          <div key={h.start} className="cal-hour" style={{ top: i * HOUR }}>
            <span className={inDay && Math.abs(nowTop - i * HOUR) < 14 ? 'hide' : ''}>{h.label}</span>
          </div>
        ))}
        {inDay && <div className="cal-past" style={{ height: nowTop }} aria-hidden="true" />}
        <ol className="cal-events" aria-label="Events">
          {items.map(({ e, top, col, cols }, i) => (
            <li key={e.kind + e.at + i} style={{ top: top + 1, height: BLOCK - 2, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}>
              <EventBlock e={linkEvents ? e : { ...e, to: undefined }} tz={tz} />
            </li>
          ))}
        </ol>
        {inDay && (
          <div className="cal-now" style={{ top: nowTop }} aria-label={`Now, ${time(at.toISOString(), tz)}`}>
            <b>{time(at.toISOString(), tz)}</b>
          </div>
        )}
      </div>
    </div>
  );
}

function EventBlock({ e, tz }: { e: DayEvent; tz: string }) {
  const inner = (
    <>
      <span className="ct"><Icon d={KIND_ICON[e.kind]} size={13} />{e.title}</span>
      <small>{time(e.at, tz)} · {[e.detail, e.by].filter(Boolean).join(' · ')}</small>
    </>
  );
  const cls = `cal-ev t-${e.tone}`;
  return e.to ? <Link className={cls} to={e.to}>{inner}</Link> : <div className={cls}>{inner}</div>;
}
