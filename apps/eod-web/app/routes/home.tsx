import { Link } from 'react-router';
import { formatPounds, SECTION_KEYS, sectionStatus } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { formatDay, timeHM, useDraft } from '../lib/draft';
import { deviceStore } from '../lib/store';
import { now } from '../lib/clock';
import { isUrgent, phaseSummaries, runPath, statusPill, useChecklists, type PhaseSummary } from '../lib/checklists';
import { BigMoney, Foot, Icon, ICONS, Pie, RowLink, Segments } from '../components/ui';
import { TabBar } from '../components/TabBar';

function greeting(d: Date) {
  const h = d.getHours();
  return h < 12 && h >= 4 ? 'Good morning' : h < 18 && h >= 12 ? 'Good afternoon' : 'Good evening';
}

/** "Hot holding ×3 · Bar opening", or "Opening checks · 09:30" for a single list. */
function phaseSub(p: PhaseSummary): string {
  if (p.scheduled.length > 0 && p.done === p.scheduled.length) return `All ${p.done} done`;
  const counts = new Map<string, number>();
  // Scheduled lists only; 'when needed' lists (e.g. deliveries) stay inside the phase.
  for (const t of p.scheduled.length ? p.scheduled : p.tasks) counts.set(t.template.title, (counts.get(t.template.title) ?? 0) + 1);
  const names = [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(' · ');
  const single = p.tasks.length === 1 && p.tasks[0]!.dueTime ? ` · ${p.tasks[0]!.dueTime}` : '';
  return p.done > 0 ? `${p.done} of ${p.scheduled.length} done · ${names}` : names + single;
}

/** Daytime ends at 15:00: after that the end-of-day report becomes the focus. */
const DAYTIME_END_HOUR = 15;

export default function Home() {
  const { user, signOut } = useAuth();
  const { draft, result, issues, progress, status, settings, savedAt } = useDraft();
  const { tasks } = useChecklists();
  const at = now();
  const statuses = SECTION_KEYS.map((k) => sectionStatus(draft, k)).filter((s) => s !== 'skipped');
  const submitted = status !== 'draft' && status !== 'sent-back';

  // Checklists run all day, independent of the end-of-day report.
  const scheduled = tasks.filter((t) => t.status !== 'anytime');
  const checksDone = scheduled.filter((t) => t.status === 'done' || t.status === 'failed').length;
  const urgent = tasks.filter((t) => isUrgent(t.status));
  const nextCheck = urgent[0] ?? tasks.find((t) => t.status === 'upcoming');

  // The top card shows what matters right now.
  const daytime = at.getHours() >= 4 && at.getHours() < DAYTIME_END_HOUR;
  const focus = urgent[0] ?? (daytime && progress.done === 0 && !submitted ? nextCheck : undefined);

  // Each item appears once: the focused checklist is not repeated below.
  const lateChecks = tasks.filter((t) => (t.status === 'late' || t.status === 'missed') && t.key !== focus?.key).slice(0, 3);
  const needs = submitted ? [] : issues.filter((i) => i.level !== 'ok' && i.code !== 'section-incomplete').slice(0, 3);

  const yesterday = new Date(`${draft.businessDate}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const lastNight = deviceStore().peek(settings.siteCode, yesterday.toISOString().slice(0, 10));

  const eodTo = submitted ? '/close/done' : '/close';
  const eodLabel = submitted ? 'See today\'s EOD' : progress.done === 0 ? 'Start today\'s EOD' : 'Continue today\'s EOD';
  const focusPill = focus ? statusPill(focus, at) : null;

  return (
    <main className="page tabs">
      <header className="nav" style={{ paddingLeft: 20 }}>
        <span className="title">{settings.siteName}</span>
        <span className="saved"><span className="dot" />{savedAt ? `Saved ${timeHM(savedAt)}` : 'On this device'}</span>
        <button className="av ink" style={{ width: 32, height: 32, fontSize: 12, border: 0, cursor: 'pointer' }} onClick={signOut} aria-label={`Signed in as ${user?.name}. Sign out`}>{user?.initials}</button>
      </header>
      <div className="body">
        <div className="top">
          <div className="titleblock">
            <span className="eyebrow">{formatDay(draft.businessDate)}</span>
            <h1>{greeting(at)}, {user?.name}</h1>
          </div>

          {focus ? (
            <Link className="hero" to={runPath(focus.key)} aria-label={`Next checklist: ${focus.title}, ${focusPill?.text}`}>
              <div className="hero-row">
                <span className="hl">Next checklist</span>
                <span className={`hs-small ${focus.status === 'late' ? 'h-bad' : focus.status === 'due' ? 'h-warn' : ''}`} style={{ fontWeight: 600 }}>{focusPill?.text}</span>
              </div>
              <div className="titleblock" style={{ gap: 6 }}>
                <span className="hero-title">{focus.title}</span>
                <span className="hs-small">{focus.total} checks · {focus.template.who}</span>
              </div>
              <div className="titleblock" style={{ gap: 10 }}>
                <div className="segs" aria-hidden="true">{scheduled.map((t) => <span key={t.key} className={t.status === 'done' || t.status === 'failed' ? 'd' : ''} />)}</div>
                <span className="hs-small">{checksDone} of {scheduled.length} checklists done today</span>
              </div>
            </Link>
          ) : (
            <Link className="hero" to={eodTo}>
              <div className="hero-row"><span className="hl">Today's EOD</span><span className="hs-small">{submitted ? 'Sent to head office' : `Due by ${settings.dayCloseTime}`}</span></div>
              <div className="titleblock">
                <BigMoney value={result.totalNet} />
                <span className="hs-small">{submitted ? 'Net for the day' : 'Net so far'}</span>
              </div>
              <div className="titleblock" style={{ gap: 10 }}>
                <Segments statuses={statuses} />
                <span className="hs-small">{progress.done} of {progress.active} sections done</span>
              </div>
            </Link>
          )}
        </div>

        {(needs.length > 0 || lateChecks.length > 0) && (
          <section className="grp">
            <div className="hd"><h2>Needs you</h2></div>
            <div className="sub">
              {lateChecks.map((t) => (
                <RowLink key={t.key} to={runPath(t.key)} lead={<span className="av bad"><Icon d={ICONS.bang} size={15} /></span>}
                  title={t.title} sub="Checklist" right={<span className={`pill ${statusPill(t, at).cls}`}>{statusPill(t, at).text}</span>} />
              ))}
              {needs.map((i) => (
                <RowLink key={i.code + i.section} to={`/close/${i.section}`}
                  lead={<span className={`av ${i.level === 'block' ? 'bad' : 'warn'}`}><Icon d={ICONS.bang} size={15} /></span>}
                  title={i.title} sub={i.detail} />
              ))}
            </div>
          </section>
        )}

        <section className="grp">
          <div className="hd"><h2>Today</h2></div>
          <div className="sub">
            <div className="sl"><span>Checklists</span><span>{checksDone} of {scheduled.length} done</span></div>
            {phaseSummaries(tasks).map((p) => {
              const pill = p.status === 'done' ? { cls: 'p-ok', text: 'Done' } : p.lead ? statusPill(p.lead, at) : null;
              return (
                <RowLink key={p.phase} to={p.to} lead={<Pie status={p.status} />}
                  title={p.label} sub={phaseSub(p)} right={pill ? <span className={`pill ${pill.cls}`}>{pill.text}</span> : undefined} />
              );
            })}
          </div>
          <div className="sub">
            <div className="sl"><span>End of day</span></div>
            <RowLink to={eodTo} lead={<span className="av"><Icon d={ICONS.list} /></span>} title="End-of-day report"
              sub={submitted ? 'Sent to head office' : progress.done === 0 ? `${progress.active} sections · start any time` : `${progress.done} of ${progress.active} sections done`}
              right={result.totalNet ? <span className="amt">{formatPounds(result.totalNet)}</span> : undefined} />
            {lastNight && lastNight.draft.handover.length > 0 && (
              <RowLink lead={<span className="av"><Icon d={ICONS.arrow} /></span>} title="Handover from last night"
                sub={lastNight.draft.handover.map((h) => h.body).join(' · ')} />
            )}
          </div>
        </section>
      </div>
      <Foot>
        {focus ? (
          <>
            <Link className="btn b1" to={runPath(focus.key)}>{focus.status === 'late' ? 'Do now' : 'Start'}: {focus.title}</Link>
            <Link className="btn b2" to={eodTo}>{eodLabel}</Link>
          </>
        ) : (
          <Link className="btn b1" to={eodTo}>{eodLabel}</Link>
        )}
      </Foot>
      <TabBar />
    </main>
  );
}
