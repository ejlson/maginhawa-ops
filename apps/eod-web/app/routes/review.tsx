import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { canSubmit, formatPounds, SECTION_LABELS, sectionStatus, type Issue } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { formatDay, useDraft } from '../lib/draft';
import { BigMoney, Foot, Icon, ICONS, Nav, RowLink } from '../components/ui';

function IssueRow({ i }: { i: Issue }) {
  const cls = i.level === 'block' ? 'bad' : i.level === 'warn' ? 'warn' : 'ok';
  return (
    <div className="li" style={{ alignItems: 'flex-start', padding: '12px 0' }}>
      <span className={`av ${cls}`}><Icon d={i.level === 'ok' ? ICONS.check : ICONS.bang} size={15} /></span>
      <span className="tx">
        <span>{i.title}</span>
        <small>{i.detail}</small>
        {i.level !== 'ok' && <Link className="act" to={`/close/${i.section}`}>{i.level === 'block' ? 'Fix in' : 'Review in'} {SECTION_LABELS[i.section]}</Link>}
      </span>
    </div>
  );
}

export default function Review() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { draft, result, issues, update, submit, status } = useDraft();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  if (status === 'submitted' || status === 'approved') return <Navigate to="/close/done" replace />;

  const blocks = issues.filter((i) => i.level === 'block');
  const warns = issues.filter((i) => i.level === 'warn');
  const oks = issues.filter((i) => i.level === 'ok');
  const ready = canSubmit(draft, issues);
  const weekday = formatDay(draft.businessDate, { weekday: 'long' });
  const wageTone = result.wageRag === 'red' ? 'h-bad' : result.wageRag === 'amber' ? 'h-warn' : 'h-ok';
  const cashDiff = (result.sessions.lunch.cash.difference ?? 0) + (result.sessions.dinner.cash.difference ?? 0);

  const send = async () => {
    setSending(true);
    setError(null);
    const res = await submit(user?.name ?? 'Manager');
    setSending(false);
    if (res.ok) navigate('/close/done');
    else setError(res.error);
  };

  return (
    <main className="page">
      <Nav back="/close" title="Review" right={<span className="saved"><span className="dot" />Saved</span>} />
      <div className="body">
        <div className="hero">
          <span className="hl">{formatDay(draft.businessDate, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <div className="titleblock" style={{ gap: 6 }}><BigMoney value={result.totalNet} /><span className="hs-small">Net sales for the day</span></div>
          <div className="hm two">
            <span>{result.covers}<small>Covers · {result.sessions.lunch.covers} lunch, {result.sessions.dinner.covers} dinner</small></span>
            <span>{result.perHeadDineIn !== null ? formatPounds(result.perHeadDineIn) : '—'}<small>Net a head, dine-in</small></span>
            <span>{result.wagePct !== null ? `${result.wagePct}%` : '—'}<small className={result.wagePct !== null ? wageTone : ''}>Wages</small></span>
            <span>{formatPounds(cashDiff)}<small>Cash difference</small></span>
          </div>
        </div>

        <section className="grp">
          <div className="hd"><h2>Check before sending</h2><span>{blocks.length ? `${blocks.length} to fix` : warns.length ? `${warns.length} to note` : 'All clear'}</span></div>
          {blocks.length + warns.length > 0 && <div className="sub"><div className="sl"><span>Needs a look</span></div>{[...blocks, ...warns].map((i) => <IssueRow key={i.code + i.section + i.title} i={i} />)}</div>}
          {oks.length > 0 && <div className="sub"><div className="sl"><span>Already explained</span></div>{oks.map((i) => <IssueRow key={i.code + i.section} i={i} />)}</div>}
          {issues.length === 0 && <p className="note" style={{ margin: 0 }}>Nothing unusual. Good close.</p>}
        </section>

        <section className="grp">
          <div className="hd"><h2>The day</h2><span>Tap to edit</span></div>
          <div className="sub">
            <div className="sl"><span>Sales</span></div>
            {(['lunch', 'dinner'] as const).map((k) => (
              <RowLink key={k} to={`/close/${k}`} lead={<span className="av"><Icon d={k === 'lunch' ? ICONS.sun : ICONS.moon} /></span>}
                title={SECTION_LABELS[k]} sub={draft.ran[k] ? `${result.sessions[k].covers} covers · ${formatPounds(result.sessions[k].gross)} gross` : "Didn't run"}
                right={<span className="amt">{formatPounds(result.sessions[k].net)}</span>} />
            ))}
            {result.delivery.map((x) => (
              <RowLink key={x.platformId} to="/close/delivery" lead={<span className="av" style={{ fontSize: 13, fontWeight: 700 }}>{x.name[0]}</span>}
                title={x.name} sub={x.traded ? `${formatPounds(x.gross)} gross${x.refundPending ? ' · refund pending' : ''}` : "Didn't trade"}
                right={<span className="amt">{formatPounds(x.net)}</span>} />
            ))}
            <div className="fr tot"><span>Day total net</span><span data-testid="day-total">{formatPounds(result.totalNet)}</span></div>
          </div>
          <div className="sub">
            <div className="sl"><span>Team</span></div>
            <RowLink to="/close/wages" lead={<span className="av"><Icon d={ICONS.people} /></span>} title="Wages" sub={result.wagePct !== null ? `${result.wagePct}% of net` : 'Not entered'} right={draft.wages.wageCost !== null ? <span className="amt">{formatPounds(draft.wages.wageCost)}</span> : ''} />
            <RowLink to="/close/tips" lead={<span className="av"><Icon d={ICONS.tip} /></span>} title="Tips & service charge" sub={`Card ${formatPounds(draft.tips.card ?? 0)} · cash ${formatPounds(draft.tips.cash ?? 0)}${draft.tips.toTronc ? ' · to tronc' : ''}`} right={<span className="amt">{formatPounds(result.tips)}</span>} />
          </div>
          <div className="sub">
            <div className="sl"><span>Notes</span></div>
            <RowLink to="/close/feedback" lead={<span className="av"><Icon d={ICONS.chat} /></span>} title="Feedback" sub={`${draft.feedback.length} notes${draft.feedback.some((f) => f.raiseRepair) ? ' · repair raised' : ''}`} />
            <RowLink to="/close/handover" lead={<span className="av"><Icon d={ICONS.arrow} /></span>} title="Handover" sub={`${draft.handover.length} for the opener`} />
            {sectionStatus(draft, 'promotions') !== 'todo' && <RowLink to="/close/promotions" lead={<span className="av"><Icon d={ICONS.star} /></span>} title="Promotions & other" sub={draft.promotions.notes} />}
          </div>
        </section>

        <section className="grp quiet">
          <label className="check">
            <input type="checkbox" checked={draft.confirmed} onChange={(e) => update((d) => { d.confirmed = e.target.checked; })} />
            <span>I confirm these figures match the till reports and the cash I counted.</span>
          </label>
        </section>
      </div>
      <Foot>
        {error && <p className="note bad" role="alert" style={{ textAlign: 'center', margin: '0 0 8px' }}>{error}</p>}
        <button type="button" className="btn b1" disabled={!ready || sending} onClick={send}>{sending ? 'Sending…' : `Submit ${weekday} · ${formatPounds(result.totalNet)}`}</button>
        <p className="note">{blocks.length ? `Fix ${blocks.length} ${blocks.length === 1 ? 'issue' : 'issues'} to submit.` : draft.confirmed ? 'Goes to finance and the daily sheet.' : 'Tick the confirmation to submit.'}</p>
      </Foot>
    </main>
  );
}
