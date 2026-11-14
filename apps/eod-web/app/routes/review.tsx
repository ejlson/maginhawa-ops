import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { canSubmit, formatPounds, isEditable, SECTION_LABELS, type Issue } from '@maginhawa/core';
import { recordedAs, useAuth } from '../lib/auth';
import { tour } from '../lib/tour';
import { formatDay, useDraft, useWhere } from '../lib/draft';
import { AlreadySent, EodSyncNotice, SyncState } from '../components/Sync';
import { BigMoney, Foot, Icon, Nav } from '../components/ui';
import { ICONS } from '../components/ui-helpers';
import { AddedFigures } from '../sections/AddedInputs';

/** One thing to look at before sending: what it is, why, and one button to sort it (P8). */
function CheckRow({ i }: { i: Issue }) {
  const tone = i.level === 'block' ? 't-bad' : i.level === 'warn' ? 't-warn' : 't-ok';
  return (
    <div className="li rv-check">
      <span className="tx"><span>{i.title}</span><small className={tone}>{i.detail}</small></span>
      {i.level !== 'ok' && <Link className="chip sm" to={`/close/${i.section}`}>{i.level === 'block' ? 'Finish' : 'Check'}<span className="vh"> {SECTION_LABELS[i.section]}</span></Link>}
    </div>
  );
}

export default function Review() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { draft, result, issues, update, submit, status, sync } = useDraft();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  useWhere('Review');
  // Someone else sent it first: say so, with a link, instead of jumping away.
  if (sync.alreadySent && sync.notice) return <Sent text={sync.notice} />;
  if (!isEditable(status)) return <Navigate to="/close/done" replace />;

  const blocks = issues.filter((i) => i.level === 'block');
  const warns = issues.filter((i) => i.level === 'warn');
  const oks = issues.filter((i) => i.level === 'ok');
  const ready = canSubmit(draft, issues);
  const weekday = formatDay(draft.businessDate, { weekday: 'long' });
  const wageTone = result.wageRag === 'red' ? 'h-bad' : result.wageRag === 'amber' ? 'h-warn' : 'h-ok';

  const send = async () => {
    setSending(true);
    setError(null);
    const res = await submit(user ? recordedAs(user) : 'Manager');
    setSending(false);
    if (res.ok) { if (user) tour.did(user, 'close'); navigate('/close/done', { state: { justSent: true } }); }
    else setError(res.error);
  };

  const wageWord = result.wageRag === 'red' ? 'over target' : result.wageRag === 'amber' ? 'close to target' : 'on track';
  const toLook = [...blocks, ...warns];
  const cashDiff = (result.sessions.lunch.cash.difference ?? 0) + (result.sessions.dinner.cash.difference ?? 0);

  return (
    <main className="page rv-page">
      <Nav back="/close" backLabel="End of day report" right={<SyncState />} />
      <div className="body form rv-body">
        <div className="titleblock mh-title"><h1>Ready to send?</h1></div>
        <div className="hero rv-card">
          <div className="titleblock" style={{ gap: 2 }}>
            <span className="hl">{formatDay(draft.businessDate, { weekday: 'long', day: 'numeric', month: 'short' })} · day net</span>
            <BigMoney value={result.totalNet} testId="day-total" />
            <span className={`hs-small ${result.wagePct !== null ? wageTone : ''}`}>{result.wagePct !== null ? `Wages ${result.wagePct}% · ${wageWord}` : 'Wages not entered'}{result.covers ? ` · ${result.covers} covers` : ''}</span>
          </div>
          <div className="hm rv-strip">
            {(['lunch', 'dinner'] as const).map((k) => (
              <Link key={k} to={`/close/${k}`}>{draft.ran[k] ? formatPounds(result.sessions[k].net) : "Didn't run"}<small>{SECTION_LABELS[k]}</small></Link>
            ))}
            <Link to="/close/delivery">{draft.ran.delivery ? formatPounds(result.deliveryNet) : "Didn't run"}<small>Delivery</small></Link>
          </div>
          {/* Tips (Tips Act 2023) and the cash count stay in view before sending, even when within tolerance. */}
          <span className="hs-small rv-extra">
            <Link to="/close/tips">Tips {formatPounds(result.tips)}{draft.tips.toTronc ? ' · to tronc' : ''}</Link>
            {' · '}Cash difference {formatPounds(cashDiff)}
          </span>
        </div>

        <section className="grp rv-checks" aria-label={toLook.length ? 'Before you send' : 'All checked'}>
          <div className="hd"><h2>{toLook.length ? 'Before you send' : 'All checked'}</h2>{toLook.length > 0 && <span>{blocks.length ? `${blocks.length} to finish` : `${warns.length} to check`}</span>}</div>
          {toLook.length > 0
            ? <div className="sub">{toLook.map((i) => <CheckRow key={i.code + i.section + i.title} i={i} />)}</div>
            : <p className="rv-clear"><Icon d={ICONS.check} size={18} />Everything checks out</p>}
          {oks.length > 0 && <div className="sub"><div className="sl"><span>Already explained</span></div>{oks.map((i) => <CheckRow key={i.code + i.section} i={i} />)}</div>}
        </section>

        <AddedFigures />
      </div>
      <EodSyncNotice />
      <Foot>
        <label className="rv-tick">
          <input type="checkbox" className="vh" checked={draft.confirmed} onChange={(e) => update((d) => { d.confirmed = e.target.checked; })} />
          <span className="rv-tick-c" aria-hidden="true"><Icon d={ICONS.check} size={15} /></span>
          <span>I confirm these figures match the till reports and the cash I counted</span>
        </label>
        {error && <p className="note bad" role="alert" style={{ textAlign: 'center', margin: '0 0 8px' }}>{error}</p>}
        <button type="button" className="btn b1" disabled={!ready || sending} onClick={send}>{sending ? 'Sending…' : `Send ${weekday} · ${formatPounds(result.totalNet)}`}</button>
        <p className="note">{blocks.length ? `Finish ${blocks.length === 1 ? SECTION_LABELS[blocks[0]!.section].toLowerCase() : `${blocks.length} things`} first` : draft.confirmed ? 'Goes to head office straight away' : 'Tick to say the figures are right'}</p>
      </Foot>
    </main>
  );
}

function Sent({ text }: { text: string }) {
  return (
    <main className="page">
      <Nav back="/close" title="Review" />
      <div className="body form"><AlreadySent text={text} /></div>
    </main>
  );
}
