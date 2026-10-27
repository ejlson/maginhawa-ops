import { useState } from 'react';
import { Link } from 'react-router';
import { buildTimeline, DAY_FILTERS, type DayEvent, type DayFilter, type TimelineHour } from '@maginhawa/core';
import { now } from '../lib/clock';
import { useMinuteTick } from './home/shared';
import { Chevron, Icon, ICONS } from './ui';

const KIND_ICON: Record<DayEvent['kind'], string> = {
  checklist: ICONS.check, missed: ICONS.bang, due: ICONS.clock, fix: ICONS.wrench, repair: ICONS.wrench, fixed: ICONS.check, eod: ICONS.list,
};
const TONE_AV: Record<DayEvent['tone'], string> = { ok: 'ok', warn: 'warn', bad: 'bad', mut: '' };
const TONE_RANK: Record<DayEvent['tone'], number> = { mut: 0, ok: 1, warn: 2, bad: 3 };
const time = (iso: string, tz: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz });

/** The trading day hour by hour: a 24-hour strip, filters, and every event in its hour. Used for a site's own day and on head office's site pages. */
export function DayTimeline({ events, bounds, timezone, dayCloseTime, linkEvents = true }: {
  events: DayEvent[]; bounds: { start: Date; end: Date }; timezone: string; dayCloseTime: string; linkEvents?: boolean;
}) {
  useMinuteTick();
  const [filter, setFilter] = useState<DayFilter>('all');
  const at = now();
  const day = buildTimeline(events, bounds, at, timezone, filter);
  const settings = { timezone, dayCloseTime };
  const most = Math.max(1, ...day.hours.map((h) => h.events.length));

  // Quiet hours run together into one line, so the day reads at a glance.
  const blocks: ({ quiet: true; from: string; to: string; past: boolean } | { quiet: false; hour: TimelineHour })[] = [];
  for (const h of day.hours) {
    const last = blocks[blocks.length - 1];
    if (!h.events.length && !h.current) {
      if (last?.quiet && last.past === h.past) last.to = h.label;
      else blocks.push({ quiet: true, from: h.label, to: h.label, past: h.past });
    } else blocks.push({ quiet: false, hour: h });
  }

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

    <ol className="day-list" aria-label="Hour by hour">
      {blocks.map((b) => b.quiet ? (
        <li key={b.from} className={`day-quiet ${b.past ? '' : 'future'}`}>
          <span className="day-h">{b.from}{b.to !== b.from ? `–${b.to.slice(0, 2)}:59` : ''}</span>
          <span>{b.past ? 'Nothing logged' : 'Nothing planned'}</span>
        </li>
      ) : (
        <li key={b.hour.start} className={`day-hour ${b.hour.past || b.hour.current ? '' : 'future'}`}>
          <span className="day-h">{b.hour.label}{b.hour.current && <b className="day-now">Now</b>}</span>
          <div className="sub">
            {b.hour.events.length ? b.hour.events.map((e, i) => <EventRow key={e.kind + e.at + i} e={linkEvents ? e : { ...e, to: undefined }} tz={settings.timezone} />)
              : <span className="day-empty">Nothing yet this hour</span>}
          </div>
        </li>
      ))}
    </ol>
    </>
  );
}

function EventRow({ e, tz }: { e: DayEvent; tz: string }) {
  const inner = (
    <>
      <span className={`av ${TONE_AV[e.tone]}`}><Icon d={KIND_ICON[e.kind]} size={17} /></span>
      <span className="tx"><span>{e.title}</span><small>{[e.detail, e.by].filter(Boolean).join(' · ')}</small></span>
      <span className="rt">{time(e.at, tz)}{e.to && <Chevron />}</span>
    </>
  );
  return e.to ? <Link className="li" to={e.to}>{inner}</Link> : <div className="li">{inner}</div>;
}
