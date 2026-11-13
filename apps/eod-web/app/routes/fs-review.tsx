import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { addDays, REPEAT_MIN, REPEAT_WINDOW_DAYS, repeatFaults, REVIEW_EVERY_DAYS, REVIEW_QUESTIONS, reviewDue, type RepeatFault } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { shortDate, useFoodSafety } from '../lib/food-safety';
import { isDone, isScheduled, useChecklists } from '../lib/checklists';
import { useTemplates } from '../lib/templates';
import { useDraft } from '../lib/draft';
import { loadChecklistRecords } from '../lib/records-pack';
import { ChipRadio, Foot, Nav } from '../components/ui';
import { SkRows } from '../components/Skeleton';

/** The 4-weekly look back (HANDOFF.md §8a, item 11): repeat faults, what's changed, and a signed review. */
export default function FsReview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { site, siteCode, addReview } = useFoodSafety();
  const { businessDate: today, tasks } = useChecklists();
  const { records } = useTemplates();
  const { settings } = useDraft();
  const [faults, setFaults] = useState<RepeatFault[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>({});
  const last = [...site.reviews].sort((a, b) => b.on.localeCompare(a.on))[0];
  const due = reviewDue(last, today);

  useEffect(() => {
    let live = true;
    loadChecklistRecords(siteCode, { from: addDays(today, -(REPEAT_WINDOW_DAYS - 1)), to: today }, records)
      .then((rs) => { if (live) setFaults(repeatFaults(rs.map((r) => r.run), [...new Map(rs.map((r) => [r.template.id, r.template])).values()], today)); })
      .catch(() => { if (live) setFaults([]); });
    return () => { live = false; };
  }, [siteCode, today, records]);

  const scheduled = tasks.filter(isScheduled);
  const done = scheduled.filter(isDone).length;
  const allAnswered = REVIEW_QUESTIONS.every((q) => answers[q.id] !== undefined);

  return (
    <main className="page">
      <Nav back="/food-safety" backLabel="Food safety" title="4-weekly review" right={<span className="muted" style={{ fontSize: 13 }}>{shortDate(addDays(today, -(REVIEW_EVERY_DAYS - 1)), today)} – {shortDate(today, today)}</span>} />
      <div className="body form">
        <div className="hero">
          <span className="hl">4-weekly review · {settings.siteName}</span>
          <div className="big"><b>{faults?.length ?? '…'}</b><i>&nbsp;repeat {faults?.length === 1 ? 'fault' : 'faults'}</i></div>
          <div className="hm">
            <span>{scheduled.length ? `${done} of ${scheduled.length}` : '—'}<small>Checks done today</small></span>
            <span>{last ? shortDate(last.on, today) : 'Never'}<small>Last review</small></span>
            <span className={due ? 'h-warn' : 'h-ok'}>{due ? 'Due' : 'Not yet'}<small>Next review</small></span>
          </div>
        </div>
        <section className="grp">
          <div className="gh"><h2>Repeat faults</h2><p>The same check failing {REPEAT_MIN} or more times in {REPEAT_WINDOW_DAYS} days: the cause hasn't been fixed.</p></div>
          <div className="sub">
            {faults === null && <SkRows count={2} label="Looking through the last week" />}
            {faults?.map((f) => (
              <div className="li" key={`${f.templateId}${f.checkpointId}`}>
                <span className="av bad">{f.count}×</span>
                <span className="tx"><span>{f.title}</span><small>{f.dates.map((d) => shortDate(d, today)).join(', ')}</small>
                  <span className="chips" style={{ marginTop: 6 }}><Link className="chip" to="/repairs">Raise a repair</Link><Link className="chip" to={`/checklists/edit/${f.templateId}`}>Change the check</Link></span>
                </span>
              </div>
            ))}
            {faults?.length === 0 && <p className="muted">No repeat faults this week.</p>}
          </div>
        </section>
        <section className="grp">
          <div className="gh"><h2>Anything changed?</h2><p>A yes means the safety plan needs updating.</p></div>
          <div className="sub">
            {REVIEW_QUESTIONS.map((q) => (
              <div className="fr" key={q.id}>
                <span className="tx"><span>{q.title}</span>{answers[q.id] && <small className="warn">{q.sub}</small>}</span>
                <span className="chips" role="radiogroup" aria-label={q.title}>
                  <ChipRadio checked={answers[q.id] === false} onClick={() => setAnswers({ ...answers, [q.id]: false })}>No</ChipRadio>
                  <ChipRadio checked={answers[q.id] === true} onClick={() => setAnswers({ ...answers, [q.id]: true })}>Yes</ChipRadio>
                </span>
              </div>
            ))}
            <div className="fr"><span>Signed by</span><span className="amt">{user?.name}</span></div>
          </div>
        </section>
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={!allAnswered} onClick={() => {
          addReview({ on: today, by: user?.name ?? 'Manager', answers: Object.fromEntries(REVIEW_QUESTIONS.map((q) => [q.id, Boolean(answers[q.id])])) });
          navigate('/food-safety');
        }}>Sign off review</button>
      </Foot>
    </main>
  );
}
