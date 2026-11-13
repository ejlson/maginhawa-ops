/**
 * Managers: in the morning, how last night went and what needs sorting; from the afternoon, the EOD.
 * A late checklist always comes first.
 */
import { addDays, dayNet, formatPounds, lastSevenDays, SECTION_KEYS, SECTION_LABELS, sectionStatus, splitPounds, weekday, WEEKDAY_NAMES, type Pence } from '@maginhawa/core';
import { useAuth } from '../../lib/auth';
import { formatDay, timeHM, useDraft } from '../../lib/draft';
import { runPath, useChecklists } from '../../lib/checklists';
import { useSite } from '../../lib/site';
import { useTradingHistory } from '../../lib/history';
import { useTwoColumns } from '../../lib/wide';
import { sectionFigure, sectionSub } from '../../lib/section-text';
import { BigMoney, Pie, RowLink, Segments } from '../ui';
import { TabBar } from '../TabBar';
import { HomeHeader } from './shared';
import { firstName, greeting, isDaytime, useEod, useToday } from './shared-helpers';
import { FirstWeek } from './FirstWeek';
import { ChecklistsSection, EndOfDaySection, eodStep, FoodSafetySection, RepairsSection, service, UpNext, type UpNextStep } from './today';

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

function LastNightHero({ n, next }: { n: LastNight; next: UpNextStep }) {
  const { lastDate } = useTradingHistory();
  const [p, d] = splitPounds(n.net);
  return (
    <div className="hero mh-card" data-tour="hero-night">
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
      <UpNext step={next} />
    </div>
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

/** The EOD as the main card: net so far, the sections as bars, and the next step. */
function EodCard({ next, wide }: { next: UpNextStep; wide: boolean }) {
  const eod = useEod();
  const { result, progress } = useDraft();
  const due = eod.due();
  const right = [due.text, wide && result.wagePct !== null ? `wages ${result.wagePct}%` : ''].filter(Boolean).join(' · ');
  return (
    <div className="hero mh-card" data-tour="hero-eod">
      <div className="hero-row"><span className="hl">{eod.submitted ? 'Net for the day' : wide ? 'Net so far tonight' : 'Net so far'}</span>{right && <span className={`hs-small ${due.cls}`}>{right}</span>}</div>
      <BigMoney value={eod.result.totalNet} />
      <div className="mh-progress">
        <Segments statuses={eod.statuses} />
        <span className="hs-small">EOD · {progress.done} of {progress.active} sections done</span>
      </div>
      <UpNext step={next} />
    </div>
  );
}

/** End of day (desktop): the eight sections in two columns, each with its circle and figure (D1). */
function CloseGrid() {
  const { draft, result, settings, progress } = useDraft();
  const keys = SECTION_KEYS.filter((k) => sectionStatus(draft, k) !== 'skipped');
  const half = Math.ceil(keys.length / 2);
  const col = (ks: typeof keys) => (
    <div className="sub">
      {ks.map((k) => <RowLink key={k} to={`/close/${k}`} lead={<Pie status={sectionStatus(draft, k)} size={22} />} title={SECTION_LABELS[k]} sub={sectionSub(k, draft, result, settings)} right={<span className="amt">{sectionFigure(k, draft, result)}</span>} />)}
    </div>
  );
  return (
    <section className="grp mh-close" aria-label="End of day">
      <div className="hd"><h2>End of day</h2><span>{progress.done} of {progress.active} done · {progress.left} left</span></div>
      <div className="mh-close-cols">{col(keys.slice(0, half))}{col(keys.slice(half))}</div>
    </section>
  );
}


export function ManagerHome() {
  const { user } = useAuth();
  const { businessDate } = useChecklists();
  const { handover, handoverBy, handoverRead } = useSite();
  const { savedAt, settings } = useDraft();
  const { at, urgent, next: nextTask } = useToday();
  const eod = useEod();
  const lastNight = useLastNight();
  const wide = useTwoColumns();
  const morning = isDaytime(at);

  // One next step, in the card: a late list, then last night's handover, then the EOD (or, before
  // anything's started in the morning, the next list).
  const unread = handover.length > 0 && !handoverRead;
  const step: UpNextStep = urgent[0]
    ? { to: runPath(urgent[0].key), text: urgent[0].title, label: `${urgent[0].status === 'late' ? 'Do now' : 'Start'}: ${urgent[0].title}` }
    : morning && unread
      ? { to: '/handover', text: `${handoverBy ? `${firstName(handoverBy)}'s` : "Last night's"} handover`, label: `Read ${handoverBy ? `${firstName(handoverBy)}'s` : "last night's"} handover` }
      : morning && nextTask && !lastNight && eod.statuses.every((s) => s === 'todo')
        ? { to: runPath(nextTask.key), text: `${nextTask.title}${nextTask.dueTime ? ` · ${nextTask.dueTime}` : ''}`, label: `Start: ${nextTask.title}` }
        : eodStep(eod);

  const card = morning && lastNight ? <LastNightHero n={lastNight} next={step} /> : <EodCard next={step} wide={wide} />;
  const title = (
    <div className="titleblock mh-title">
      <span className="eyebrow">{formatDay(businessDate)}{wide ? '' : service(at, settings.timezone)}</span>
      <h1>{greeting(at)}, {firstName(user?.name ?? '')}</h1>
    </div>
  );

  if (wide) {
    return (
      <main className="page tabs mh-page wide">
        <div className="body mh-desk">
          <div className="mh-head">{title}<span className="saved" data-tour="sync"><span className="dot" />{savedAt ? `All saved · ${timeHM(savedAt)}` : 'Saved on this device'}</span></div>
          <div className="mh-top">{card}<ChecklistsSection yesterday /></div>
          <CloseGrid />
          <div className="mh-pair"><RepairsSection at={at} /><div className="mh-stack"><EndOfDaySection eodRow={false} issues /><FoodSafetySection /></div></div>
          <FirstWeek />
          {morning && <LastSevenDays />}
        </div>
      </main>
    );
  }
  return (
    <main className="page tabs mh-page">
      <HomeHeader />
      <div className="body mh-phone">
        {title}
        {card}
        <ChecklistsSection yesterday />
        <RepairsSection at={at} />
        <EndOfDaySection />
        <FoodSafetySection />
        <FirstWeek />
        {morning && <LastSevenDays />}
      </div>
      <TabBar />
    </main>
  );
}
