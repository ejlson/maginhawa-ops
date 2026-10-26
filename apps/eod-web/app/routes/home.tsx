import { Link } from 'react-router';
import { SECTION_KEYS, sectionStatus } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { formatDay, timeHM, useDraft } from '../lib/draft';
import { deviceStore } from '../lib/store';
import { now } from '../lib/clock';
import { isUrgent, runPath, statusPill, useChecklists } from '../lib/checklists';
import { BigMoney, Foot, Icon, ICONS, RowLink, Segments } from '../components/ui';

function greeting(d: Date) {
  const h = d.getHours();
  return h < 12 && h >= 4 ? 'Good morning' : h < 18 && h >= 12 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { user, signOut } = useAuth();
  const { draft, result, issues, progress, status, settings, savedAt } = useDraft();
  const { tasks } = useChecklists();
  const statuses = SECTION_KEYS.map((k) => sectionStatus(draft, k)).filter((s) => s !== 'skipped');
  const submitted = status !== 'draft' && status !== 'sent-back';
  // Real problems only. Unfinished sections already show as progress on the hub.
  const needs = submitted ? [] : issues.filter((i) => i.level !== 'ok' && i.code !== 'section-incomplete').slice(0, 3);

  // Checklists run all day, independent of the end-of-day report.
  const scheduled = tasks.filter((t) => t.status !== 'anytime');
  const checksDone = scheduled.filter((t) => t.status === 'done' || t.status === 'failed').length;
  const urgent = tasks.filter((t) => isUrgent(t.status));
  const lateChecks = tasks.filter((t) => t.status === 'late' || t.status === 'missed').slice(0, 3);
  const nextCheck = urgent[0] ?? tasks.find((t) => t.status === 'upcoming');

  const yesterday = new Date(`${draft.businessDate}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const lastNight = deviceStore().peek(settings.siteCode, yesterday.toISOString().slice(0, 10));

  const eodLabel = submitted ? 'See today\'s report' : progress.done === 0 ? 'Start today\'s close' : 'Continue today\'s close';

  return (
    <main className="page">
      <header className="nav" style={{ paddingLeft: 20 }}>
        <span className="title">{settings.siteName}</span>
        <span className="saved"><span className="dot" />{savedAt ? `Saved ${timeHM(savedAt)}` : 'On this device'}</span>
        <button className="av ink" style={{ width: 32, height: 32, fontSize: 12, border: 0, cursor: 'pointer' }} onClick={signOut} aria-label={`Signed in as ${user?.name}. Sign out`}>{user?.initials}</button>
      </header>
      <div className="body">
        <div className="top">
          <div className="titleblock">
            <span className="eyebrow">{formatDay(draft.businessDate)}</span>
            <h1>{greeting(now())}, {user?.name}</h1>
          </div>
          <Link className="hero" to={submitted ? '/close/done' : '/close'}>
            <div className="hero-row"><span className="hl">Today's close</span><span className="hs-small">{submitted ? 'Sent to head office' : `Due by ${settings.dayCloseTime}`}</span></div>
            <div className="titleblock">
              <BigMoney value={result.totalNet} />
              <span className="hs-small">{submitted ? 'Net for the day' : 'Net so far'}</span>
            </div>
            <div className="titleblock" style={{ gap: 10 }}>
              <Segments statuses={statuses} />
              <span className="hs-small">{progress.done} of {progress.active} sections done</span>
            </div>
          </Link>
        </div>

        {(needs.length > 0 || lateChecks.length > 0) && (
          <section className="grp">
            <div className="hd"><h2>Needs you</h2><span>{needs.length + lateChecks.length}</span></div>
            <div className="sub">
              {lateChecks.map((t) => (
                <RowLink key={t.key} to={runPath(t.key)} lead={<span className="av bad"><Icon d={ICONS.bang} size={15} /></span>}
                  title={t.title} sub={`Checklist · ${statusPill(t).text.toLowerCase()}`} />
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
            <RowLink to="/checklists" lead={<span className="av"><Icon d={ICONS.check} /></span>} title="Checklists"
              sub={`${checksDone} of ${scheduled.length} done · ${nextCheck ? `next: ${nextCheck.title}` : 'all done today'}`}
              right={nextCheck && isUrgent(nextCheck.status) ? <span className={`pill ${statusPill(nextCheck).cls}`}>{statusPill(nextCheck).text}</span> : undefined} />
            <RowLink to="/close" lead={<span className="av"><Icon d={ICONS.list} /></span>} title="End-of-day report"
              sub={submitted ? 'Sent to head office' : progress.done === 0 ? `${progress.active} sections · do them in any order` : `${progress.left} sections to go`} />
            {lastNight && lastNight.draft.handover.length > 0 && (
              <RowLink lead={<span className="av"><Icon d={ICONS.arrow} /></span>} title="Handover from last night"
                sub={lastNight.draft.handover.map((h) => h.body).join(' · ')} />
            )}
          </div>
        </section>
      </div>
      <Foot>
        {urgent[0] ? (
          <>
            <Link className="btn b1" to={runPath(urgent[0].key)}>{urgent[0].status === 'late' ? 'Do now: ' : 'Start '}{urgent[0].title}</Link>
            <Link className="btn b2" to={submitted ? '/close/done' : '/close'}>{eodLabel}</Link>
          </>
        ) : (
          <Link className="btn b1" to={submitted ? '/close/done' : '/close'}>{eodLabel}</Link>
        )}
      </Foot>
    </main>
  );
}
