import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatPounds, isEditable, SECTION_LABELS, sectionStatus, type SectionKey } from '@maginhawa/core';
import { recordedAs, useAuth } from '../lib/auth';
import { formatDay, timeHM, useDraft } from '../lib/draft';
import { EodSyncNotice } from '../components/Sync';
import { BigMoney, Icon, NextBar, Pie, RowLink, SiteMono, Toggle } from '../components/ui';
import { SECTION_ICONS } from '../components/ui-helpers';
import { TabBar } from '../components/TabBar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AWAY_MS, readResume, resumePath } from '../lib/resume';
import { now } from '../lib/clock';
import { sectionFigure, sectionSub } from '../lib/section-text';

const SALES: SectionKey[] = ['lunch', 'dinner', 'delivery', 'promotions'];
const TEAM: SectionKey[] = ['wages', 'tips', 'feedback', 'handover'];

export default function Close() {
  const { user } = useAuth();
  const { draft, result, progress, savedAt, update, status, settings } = useDraft();
  const locked = !isEditable(status);

  const sub = (k: SectionKey) => sectionSub(k, draft, result, settings);
  const right = (k: SectionKey) => sectionFigure(k, draft, result);
  const next = [...SALES, ...TEAM].find((k) => { const st = sectionStatus(draft, k); return st !== 'done' && st !== 'skipped'; });
  const allDone = progress.active > 0 && progress.done === progress.active;
  const wageCls = result.wageRag === 'red' ? 'h-bad' : result.wageRag === 'amber' ? 'h-warn' : '';
  // Back after being pulled away: offer the exact field they were in.
  const [place] = useState(() => readResume(draft.siteCode, draft.businessDate));
  const resume = !locked && place && now().getTime() - place.at >= AWAY_MS
    && !['done', 'skipped'].includes(sectionStatus(draft, place.section)) ? place : null;

  // P3 groups: Sales, Team, Wrap up. Each says how many are done.
  const GROUPS: { title: string; keys: SectionKey[] }[] = [
    { title: 'Sales', keys: SALES },
    { title: 'Team', keys: ['wages', 'tips'] },
    { title: 'Wrap up', keys: ['feedback', 'handover'] },
  ];
  const groupMeta = (keys: SectionKey[]) => {
    const active = keys.filter((k) => sectionStatus(draft, k) !== 'skipped');
    const done = active.filter((k) => sectionStatus(draft, k) === 'done').length;
    return done === active.length ? (active.length ? 'All done' : "Didn't run") : done === 0 ? `${active.length} to do` : `${done} of ${active.length} done`;
  };
  const left = [...SALES, ...TEAM].filter((k) => { const st = sectionStatus(draft, k); return st !== 'done' && st !== 'skipped'; });
  // The small line names at most three, so it never runs off the bar.
  const leftText = `${left.length} left · ${left.slice(0, 3).map((k) => SECTION_LABELS[k]).join(', ')}${left.length > 3 ? '…' : ''}`;
  const wageWord = result.wageRag === 'red' ? 'over target' : result.wageRag === 'amber' ? 'close to target' : 'on track';
  // The floating bar: what's left, and one Go to the next thing.
  const bar = locked
    ? { small: 'Sent to head office', big: "See today's report", to: '/close/done', go: "See today's report" }
    : resume
      ? { small: leftText, big: `Next: carry on with ${SECTION_LABELS[resume.section].toLowerCase()}`, to: resumePath(resume), go: `Carry on with ${SECTION_LABELS[resume.section]}` }
      : next
        ? { small: leftText, big: `Next: ${sectionStatus(draft, next) === 'started' ? 'finish' : 'start'} ${SECTION_LABELS[next].toLowerCase()}`, to: `/close/${next}`, go: `${sectionStatus(draft, next) === 'started' ? 'Finish' : 'Start'} ${SECTION_LABELS[next].toLowerCase()}` }
        : { small: `All ${progress.active} sections done`, big: 'Next: review and send', to: '/close/review', go: 'Review and send' };
  const pct = progress.active ? progress.done / progress.active : 0;

  return (
    <main className="page tabs close-page">
      <EodSyncNotice />
      <div className="body close-body">
        <div className="close-top">
          <span className="close-site"><SiteMono code={settings.siteCode} size="sm" />{settings.siteName} · {formatDay(draft.businessDate, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <span className="saved close-saved"><span className="dot" />{locked ? 'Sent' : savedAt ? `Saved on this device · ${timeHM(savedAt)}` : 'Not started'}</span>
        </div>
        <div className="titleblock mh-title">
          <h1>End of day report</h1>
          {!locked && progress.done === 0 && !savedAt && <p className="lead">Do the sections in any order. Everything saves on this device, even without signal.</p>}
        </div>
        {resume && (
          <Link className="resume" to={resumePath(resume)}>
            <span className="resume-k">Pick up where you left off · {timeHM(new Date(resume.at))}</span>
            <span className="resume-t">{SECTION_LABELS[resume.section]} · {resume.field}</span>
            <span className="resume-s">Everything you typed is saved.</span>
          </Link>
        )}

        <div className="hero close-card" role="status">
          <div className="close-card-tx">
            <span className="hl">{allDone ? 'Day net' : 'Day net so far'}</span>
            <BigMoney value={result.totalNet} />
            <span className={`hs-small ${wageCls}`}>{result.wagePct !== null ? `Wages so far ${result.wagePct}% · ${wageWord}` : result.covers > 0 ? `${result.covers} covers` : 'Wages come from the rota'}</span>
          </div>
          <div className="close-ring" role="img" aria-label={`${progress.done} of ${progress.active} sections done`}>
            <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
              <circle cx="36" cy="36" r="31" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="7" />
              <circle cx="36" cy="36" r="31" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeOpacity={pct ? 1 : 0} pathLength={100} strokeDasharray={`${pct * 100} 100`} transform="rotate(-90 36 36)" />
            </svg>
            <b aria-hidden="true">{progress.done}/{progress.active}</b>
          </div>
        </div>

        <div className="close-groups">
          {GROUPS.map((g) => (
            <section className="grp cl-group" key={g.title} aria-label={g.title}>
              <div className="cl-hd"><span>{g.title}</span><span>{groupMeta(g.keys)}</span></div>
              <div className="sub">
                {g.keys.map((k) => {
                  const st = sectionStatus(draft, k);
                  return <RowLink key={k} to={`/close/${k}`} lead={<Pie status={st} />}
                    title={<span className={st === 'skipped' ? 'muted' : ''}>{SECTION_LABELS[k]}</span>} sub={sub(k)} right={<span className="amt">{right(k)}</span>} />;
                })}
              </div>
            </section>
          ))}
        </div>

        {!locked && <SubmitEod />}

        <section className="grp quiet close-ran" aria-label="What ran today">
          <div className="cl-hd"><span>What ran today</span></div>
          <div className="sub">
            {(['lunch', 'dinner', 'delivery'] as const).map((k) => (
              <div className="li" key={k}>
                <span className="av"><Icon d={SECTION_ICONS[k]} /></span>
                <span className="tx">{SECTION_LABELS[k]}</span>
                <Toggle label={`${SECTION_LABELS[k]} ran today`} checked={draft.ran[k]} onChange={(v) => !locked && update((d) => { d.ran[k] = v; })} />
              </div>
            ))}
            <p className="note" style={{ marginLeft: 56 }}>Switch off anything that didn't run and its section is skipped. Reported by {user?.name ?? 'you'}; reports before {settings.dayCloseTime} count as the day before.</p>
          </div>
        </section>

        <NextBar name="What's left" small={bar.small} big={bar.big} to={bar.to} label={bar.go} />
      </div>
      <TabBar />
    </main>
  );
}

/** "Submit all" under the sections, like the checklists. Always there; greyed out until nothing blocks the day. */
function SubmitEod() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { draft, result, issues, update, submit } = useDraft();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocks = issues.filter((i) => i.level === 'block');
  const warns = issues.filter((i) => i.level === 'warn').length;
  const unfinished = blocks.some((i) => i.code === 'section-incomplete');
  const weekday = formatDay(draft.businessDate, { weekday: 'long' });

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    // Pressing Submit in the dialog is the same confirmation as the tick box on Review.
    update((d) => { d.confirmed = true; });
    const res = await submit(user ? recordedAs(user) : 'Manager');
    setBusy(false);
    if (res.ok) navigate('/close/done', { state: { justSent: true } });
    else { setAsking(false); setError(res.error); }
  };

  return (
    <div className="submit-lists">
      <button type="button" className="btn b1" disabled={busy || blocks.length > 0} onClick={() => { setError(null); setAsking(true); }}>Submit all</button>
      {asking && blocks.length === 0 && (
        <ConfirmDialog title={`Submit ${weekday}'s EOD?`} busy={busy} onConfirm={onSubmit} onCancel={() => setAsking(false)}>
          <p>{formatPounds(result.totalNet)} net · {result.covers} covers. Once submitted, it can't be edited.</p>
          <p>This confirms the figures match the till reports and the cash you counted.{warns > 0 && ` ${warns} ${warns === 1 ? 'note' : 'notes'} from Review ${warns === 1 ? 'goes' : 'go'} with it.`}</p>
        </ConfirmDialog>
      )}
      <p className={`note${error ? ' bad' : ''}`} role="status">
        {error ?? (blocks.length === 0
          ? 'Goes to finance and the daily sheet.'
          : unfinished ? 'Finish the sections, then submit here.'
          : <>Fix {blocks.length} {blocks.length === 1 ? 'issue' : 'issues'} first. <Link to="/close/review">See Review</Link></>)}
      </p>
    </div>
  );
}
