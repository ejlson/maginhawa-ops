/**
 * Managers: in the morning, how last night went and what needs sorting; from the afternoon, the EOD.
 * A late checklist always comes first.
 */
import { Link } from 'react-router';
import { addDays, dayNet, formatPounds, lastSevenDays, reportedText, splitPounds, weekday, WEEKDAY_NAMES, type Pence } from '@maginhawa/core';
import { can, useAuth } from '../../lib/auth';
import { formatDay, timeHM, useDraft } from '../../lib/draft';
import { runPath, statusPill, useChecklists } from '../../lib/checklists';
import { useSite } from '../../lib/site';
import { useTradingHistory } from '../../lib/history';
import { Icon, ICONS, RowLink } from '../ui';
import { TabBar } from '../TabBar';
import { EodHero, EodRow, firstName, greeting, HomeHeader, isDaytime, NextChecklistHero, PhaseRows, TimelineRow, useEod, useToday } from './shared';
import { FoodSafetyRow } from '../FoodSafetyRow';
import { Columns } from '../Columns';
import { FirstWeek } from './FirstWeek';

interface LastNight {
  net: Pence;
  wagePct: number | null;
  covers: number | null;
  /** Change on the same weekday a week before, as a whole percentage. */
  change: number | null;
  status: { cls: string; text: string };
  example: boolean;
}

/** Last night from the report saved on this device, or from the trading history (example figures in demo mode). */
function useLastNight(): LastNight | null {
  const { lastNight } = useSite();
  const { settings } = useDraft();
  const { rows, example, lastDate } = useTradingHistory();
  const mine = rows.filter((r) => r.siteCode === settings.siteCode);
  const row = mine.find((r) => r.date === lastDate);
  const weekBefore = mine.find((r) => r.date === addDays(lastDate, -7));
  const change = row && weekBefore ? Math.round(((dayNet(row) - dayNet(weekBefore)) / dayNet(weekBefore)) * 100) : null;
  const o = lastNight?.official;
  if (lastNight && o) {
    return {
      net: o.totalNet, wagePct: o.wagePct, covers: o.covers, change, example: false,
      status: lastNight.status === 'approved' ? { cls: 'h-ok', text: 'Approved by finance' }
        : { cls: '', text: `Sent ${lastNight.submittedAt ? timeHM(new Date(lastNight.submittedAt)) : ''} by ${lastNight.submittedBy ?? 'the closer'}` },
    };
  }
  if (lastNight) return null; // Started but never sent: the EOD card and Needs you deal with it.
  if (!row) return null;
  const net = dayNet(row);
  return {
    net, wagePct: row.wages !== null && net ? Math.round((row.wages / net) * 1000) / 10 : null,
    covers: row.covers.lunch + row.covers.dinner, change, example,
    status: { cls: '', text: example ? 'Example figures' : 'Sent' },
  };
}

function LastNightHero({ n }: { n: LastNight }) {
  const { lastDate } = useTradingHistory();
  const [p, d] = splitPounds(n.net);
  return (
    <Link className="hero" data-tour="hero-night" to="/close/done" aria-label={`Last night, ${formatPounds(n.net)} net. ${n.status.text}`}>
      <div className="hero-row"><span className="hl">Last night · {WEEKDAY_NAMES[weekday(lastDate)]}</span><span className={`hs-small ${n.status.cls}`} style={{ fontWeight: 600 }}>{n.status.text}</span></div>
      <div className="titleblock">
        <div className="big"><b>{p}</b><i>{d}</i></div>
        <span className="hs-small">Net sales</span>
      </div>
      <div className="hm">
        <span>{n.wagePct !== null ? `${n.wagePct}%` : '—'}<small>Wages</small></span>
        <span>{n.covers ?? '—'}<small>Covers</small></span>
        <span className={n.change === null ? '' : n.change >= 0 ? 'h-ok' : 'h-warn'}>{n.change === null ? '—' : `${n.change >= 0 ? '+' : '−'}${Math.abs(n.change)}%`}<small>On last {WEEKDAY_NAMES[weekday(lastDate)]}</small></span>
      </div>
    </Link>
  );
}

function LastSevenDays() {
  const { settings } = useDraft();
  const { rows, example, lastDate } = useTradingHistory();
  const w = lastSevenDays(rows, settings.siteCode, lastDate);
  if (!w) return null;
  const top = Math.max(...w.days.map((d) => d.net ?? 0), 1);
  const change = (n: number | null) => (n === null ? null : <span className={n >= 0 ? 'ok' : 'warn'} style={{ fontSize: 13, fontWeight: 600 }}>{n >= 0 ? '+' : '−'}{Math.abs(n)}%</span>);
  return (
    <section className="grp">
      <div className="hd"><h2>Last 7 days</h2><span>{example ? 'Example figures' : 'Net sales'}</span></div>
      <div className="bars" role="img" aria-label={`Net sales each day: ${w.days.map((d) => `${d.label} ${d.net === null ? 'closed' : formatPounds(d.net)}`).join(', ')}`}>
        {w.days.map((d, i) => (
          <div key={d.date} className={`bar${i === 6 ? ' now' : ''}`}><i style={{ height: d.net === null ? 2 : Math.max(4, Math.round((d.net / top) * 72)) }} />{d.label}</div>
        ))}
      </div>
      <div className="sub">
        <div className="fr"><span>Net sales</span><span className="rt"><span className="amt">{formatPounds(w.net)}</span>{change(w.netChange)}</span></div>
        {w.wagePct !== null && <div className="fr"><span>Wages</span><span className="rt"><span className="amt">{w.wagePct}%</span>{w.wagePct > 30 && <span className="warn" style={{ fontSize: 13, fontWeight: 600 }}>Over 30%</span>}</span></div>}
        <div className="fr"><span>Covers</span><span className="rt"><span className="amt">{w.covers}</span>{change(w.coversChange)}</span></div>
      </div>
    </section>
  );
}

export function ManagerHome() {
  const { user } = useAuth();
  const { businessDate, missedYesterday } = useChecklists();
  const { open, handover, handoverBy, handoverRead } = useSite();
  const { at, tasks, urgent, next } = useToday();
  const eod = useEod();
  const lastNight = useLastNight();
  const morning = isDaytime(at);

  // A late or due checklist always leads. Otherwise mornings look back at last night, evenings at the EOD.
  const focus = urgent[0] ?? (morning && !lastNight && !eod.submitted && eod.statuses.every((s) => s === 'todo') ? next : undefined);
  const unreadHandover = handover.length > 0 && !handoverRead;
  // One main button: a late list, then last night's handover, then the next list, then the EOD.
  const readFirst = morning && unreadHandover && !urgent.length;
  // Late lists can still be done, so each gets a row. Missed ones can't, so they fold into one calm row:
  // only the thing to do now should shout.
  const lateChecks = tasks.filter((t) => t.status === 'late' && t.key !== focus?.key).slice(0, 3);
  const missedToday = tasks.filter((t) => t.status === 'missed' && t.key !== focus?.key);
  const showNeeds = unreadHandover || open.length > 0 || missedYesterday.length > 0 || lateChecks.length > 0 || missedToday.length > 0 || eod.issues.length > 0;

  return (
    <main className="page tabs">
      <HomeHeader />
      <Columns
        top={<>
          <div className="titleblock">
            <span className="eyebrow">{formatDay(businessDate)}</span>
            <h1>{greeting(at)}, {firstName(user?.name ?? '')}</h1>
          </div>
        </>}
        hero={<>
          {focus ? <NextChecklistHero focus={focus} /> : morning && lastNight ? <LastNightHero n={lastNight} /> : <EodHero />}
        </>}
        main={<>

        {showNeeds && (
          <section className="grp" data-tour="needs">
            <div className="hd"><h2>Needs you</h2></div>
            <div className="sub">
              {unreadHandover && (
                <RowLink to="/handover" lead={<span className="av link"><Icon d={ICONS.chat} /></span>} title={`Handover from ${handoverBy ?? 'last night'}`}
                  sub={handover.map((h) => h.body).join(' · ')} right={<span className="pill p-new">New</span>} />
              )}
              {open.slice(0, 2).map((r) => (
                <RowLink key={r.id} to="/repairs" lead={<span className={`av ${r.urgent ? 'bad' : 'warn'}`}><Icon d={ICONS.wrench} /></span>}
                  title={r.title} sub={`Repair · ${reportedText(r.reportedAt, at)}`} right={<span className={`pill ${r.urgent ? 'p-bad' : 'p-warn'}`}>{r.urgent ? 'Urgent' : 'Open'}</span>} />
              ))}
              {open.length > 2 && <RowLink to="/repairs" lead={<span className="av"><Icon d={ICONS.wrench} /></span>} title={`${open.length - 2} more repairs`} />}
              {lateChecks.map((t) => (
                <RowLink key={t.key} to={runPath(t.key)} lead={<span className="av warn"><Icon d={ICONS.clock} size={17} /></span>}
                  title={t.title} sub="Checklist · can still be done" right={<span className="pill p-warn">{statusPill(t, at).text}</span>} />
              ))}
              {missedToday.length > 0 && (
                <RowLink to="/day" lead={<span className="av">{missedToday.length}</span>}
                  title={missedToday.length === 1 ? `${missedToday[0]!.title} was missed` : `${missedToday.length} checklists missed earlier`}
                  sub={`${missedToday.map((t) => t.title).join(', ')} · add a note`} />
              )}
              {missedYesterday.length > 0 && (
                <RowLink to="/checklists" lead={<span className="av">{missedYesterday.length}</span>}
                  title={missedYesterday.length === 1 ? `${missedYesterday[0]!.title} was missed` : `${missedYesterday.length} checklists missed`}
                  sub={missedYesterday.length === 1 ? 'Yesterday' : `Yesterday · ${missedYesterday.map((t) => t.title).join(', ')}`} />
              )}
              {eod.issues.map((i) => (
                <RowLink key={i.code + i.section} to={`/close/${i.section}`} lead={<span className={`av ${i.level === 'block' ? 'bad' : 'warn'}`}><Icon d={ICONS.bang} size={15} /></span>} title={i.title} sub={i.detail} />
              ))}
            </div>
          </section>
        )}

        <FirstWeek />
        {morning && <LastSevenDays />}
        </>}
        side={<>
        <section className="grp">
          <div className="hd"><h2>Today</h2>{user && can.editChecklists(user.role) && <Link className="linkbtn" to="/checklists/edit">Edit lists</Link>}</div>
          <div className="sub">
            <div className="sl"><span>Checklists</span></div>
            <PhaseRows />
            <TimelineRow />
            <FoodSafetyRow />
          </div>
          <div className="sub">
            <div className="sl"><span>End of day</span></div>
            <EodRow />
            {handover.length > 0 && !unreadHandover && <RowLink to="/handover" lead={<span className="av"><Icon d={ICONS.chat} /></span>} title="Handover from last night" sub={handover.map((h) => h.body).join(' · ')} />}
          </div>
        </section>
        </>}
        actions={<>
        {readFirst ? (
          <>
            <Link className="btn b1" to="/handover">Read {handoverBy ? `${firstName(handoverBy)}'s` : "last night's"} handover</Link>
          </>
        ) : focus ? (
          // One button. The EOD stays one tap away in "Today" and the tab bar.
          <Link className="btn b1" to={runPath(focus.key)}>{focus.status === 'late' ? 'Do now' : 'Start'}: {focus.title}</Link>
        ) : (
          <Link className="btn b1" to={eod.to}>{eod.label}</Link>
        )}
        </>}
      />
      <TabBar />
    </main>
  );
}
