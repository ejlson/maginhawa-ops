import { useState } from 'react';
import { addDays, currentRating, noticeDeadlines, type Notice, type Visit } from '@maginhawa/core';
import { shortDate, useFoodSafety } from '../lib/food-safety';
import { useChecklists } from '../lib/checklists';
import { useDraft } from '../lib/draft';
import { ChipRadio, Foot, Nav, Toggle } from '../components/ui';

const WHO: Visit['who'][] = ['Environmental health', 'Trading standards', 'Other'];
const KINDS: Notice['kind'][] = ['Improvement notice', 'Prohibition notice', 'Written warning'];

/** Hygiene rating, inspector visits and notices with their deadlines (HANDOFF.md §8a, item 10). */
export default function FsInspections() {
  const { site, addVisit, addNotice, closeNotice } = useFoodSafety();
  const { businessDate: today } = useChecklists();
  const { settings } = useDraft();
  const c = site.compliance;
  const rating = c ? currentRating(c) : null;
  const [logging, setLogging] = useState(false);
  const [date, setDate] = useState(today);
  const [who, setWho] = useState<Visit['who']>('Environmental health');
  const [score, setScore] = useState<number | null>(null);
  const [outcome, setOutcome] = useState('');
  const [hasNotice, setHasNotice] = useState(false);
  const [nKind, setNKind] = useState<Notice['kind']>('Improvement notice');
  const [nTitle, setNTitle] = useState('');
  const [fixBy, setFixBy] = useState(addDays(today, 28));
  const open = (c?.notices ?? []).filter((n) => !n.closedOn);
  const visits = [...(c?.visits ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  const save = () => {
    addVisit({ date, who, rating: score, outcome: outcome.trim() });
    // Appeals are usually within 21 days to 1 month: we remind at the shorter one.
    if (hasNotice && nTitle.trim()) addNotice({ kind: nKind, title: nTitle.trim(), servedOn: date, fixBy, appealBy: addDays(date, 21) });
    setLogging(false); setOutcome(''); setScore(null); setHasNotice(false); setNTitle('');
  };

  if (logging) {
    return (
      <main className="page">
        <Nav back="/food-safety/inspections" backLabel="Cancel" title="Log a visit" />
        <div className="body form">
          <section className="grp">
            <div className="chips" role="radiogroup" aria-label="Who visited">{WHO.map((w) => <ChipRadio key={w} checked={who === w} onClick={() => setWho(w)}>{w}</ChipRadio>)}</div>
            <div className="sub">
              <label className="fr"><span>Date</span><input className="in wide-in" type="date" aria-label="Visit date" max={today} value={date} onChange={(e) => setDate(e.target.value)} /></label>
              <div className="fr"><span>Hygiene rating</span><span className="chips" role="radiogroup" aria-label="Rating">{[null, 0, 1, 2, 3, 4, 5].map((n) => <ChipRadio key={String(n)} checked={score === n} onClick={() => setScore(n)}>{n === null ? 'None' : n}</ChipRadio>)}</span></div>
            </div>
            <textarea className="ta" aria-label="What they said" placeholder="What they looked at and said" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
          </section>
          <section className="grp">
            <div className="sub"><div className="fr"><span>They left a notice</span><Toggle label="They left a notice" checked={hasNotice} onChange={setHasNotice} /></div></div>
            {hasNotice && <>
              <div className="chips" role="radiogroup" aria-label="Kind of notice">{KINDS.map((k) => <ChipRadio key={k} checked={nKind === k} onClick={() => setNKind(k)}>{k}</ChipRadio>)}</div>
              <div className="sub">
                <label className="fr"><span>What it's about</span><input className="in wide-in" aria-label="Notice about" value={nTitle} onChange={(e) => setNTitle(e.target.value)} /></label>
                <label className="fr"><span>Fix by</span><input className="in wide-in" type="date" aria-label="Fix by" value={fixBy} onChange={(e) => setFixBy(e.target.value)} /></label>
              </div>
            </>}
          </section>
        </div>
        <Foot><button type="button" className="btn b1" disabled={!date || (hasNotice && !nTitle.trim())} onClick={save}>Save visit</button></Foot>
      </main>
    );
  }

  return (
    <main className="page">
      <Nav back="/food-safety" backLabel="Food safety" title="Inspections" />
      <div className="body form">
        <div className="hero">
          <span className="hl">Food hygiene rating · {settings.siteName}</span>
          <div className="big"><b>{rating?.rating ?? '—'}</b><i>&nbsp;of 5</i></div>
          <div className="hm"><span>{rating ? shortDate(rating.date, today) : '—'}<small>Last inspection</small></span><span>{c?.council || '—'}<small>Registered with</small></span><span>Any time<small>Next visit</small></span></div>
        </div>
        <section className="grp">
          <div className="hd"><h2>Open notices</h2><span>{open.length}</span></div>
          <div className="sub">
            {open.map((n) => {
              const dl = noticeDeadlines(n, today);
              return (
                <div className="li" key={n.id}>
                  <span className={`av ${dl.overdue ? 'bad' : 'warn'}`}>{n.kind === 'Improvement notice' ? 'IN' : n.kind === 'Prohibition notice' ? 'PN' : 'WW'}</span>
                  <span className="tx"><span>{n.kind}</span><small>{n.title} · fix by {shortDate(n.fixBy, today)}{n.appealBy ? ` · appeal by ${shortDate(n.appealBy, today)}` : ''}</small><button type="button" className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => closeNotice(n.id)}>Mark as sorted</button></span>
                  <span className={`pill ${dl.overdue ? 'p-bad' : 'p-warn'}`}>{dl.overdue ? `${-dl.fixDays} days over` : `${dl.fixDays} days`}</span>
                </div>
              );
            })}
            {!open.length && <p className="muted">No open notices.</p>}
          </div>
        </section>
        <section className="grp">
          <div className="hd"><h2>Visits</h2><span>{visits.length}</span></div>
          <div className="sub">
            {visits.map((v) => (
              <div className="li" key={v.id}>
                <span className="av">{v.who === 'Environmental health' ? 'EH' : v.who === 'Trading standards' ? 'TS' : '?'}</span>
                <span className="tx"><span>{v.who}{v.rating !== null ? ` · rated ${v.rating}` : ''}</span><small>{shortDate(v.date, today)}{v.outcome ? ` · ${v.outcome}` : ''}</small></span>
              </div>
            ))}
          </div>
          <p className="note">Head office is reminded 7 days before any notice or appeal deadline.</p>
        </section>
      </div>
      <Foot><button type="button" className="btn b1" onClick={() => setLogging(true)}>Log a visit</button></Foot>
    </main>
  );
}
