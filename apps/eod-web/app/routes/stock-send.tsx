/**
 * Ready to send? (S4-StockReview). Only two things can come up: items not counted yet (they stop
 * sending) and a big change from last time (a tap on "It's right"). Then Send count.
 */
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { areaProgress, countValue, formatPounds, itemIdsOf, qtyText, sendProblem, swings } from '@maginhawa/core';
import { can, recordedAs, useAuth } from '../lib/auth';
import { useStock } from '../lib/stock';
import { useChecklists } from '../lib/checklists';
import { dayText, names } from '../lib/stock-helpers';
import { Foot, Icon, Nav } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

export default function StockSend() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { data, item, markOkay, send } = useStock();
  const { businessDate } = useChecklists();
  const navigate = useNavigate();
  const count = data.counts.find((c) => c.id === id);
  if (!user || !count) return <Navigate to="/stock" replace />;
  // Just sent (or opened again later): the low-items screen, which moves on to the count if nothing is low.
  if (count.sentAt) return <Navigate to={`/stock/count/${id}/low`} replace />;

  const total = itemIdsOf(count).length;
  const counted = Object.keys(count.lines).filter((x) => itemIdsOf(count).includes(x)).length;
  const left = areaProgress(count).filter((a) => a.status !== 'done');
  const changes = swings(count, data.counts).filter((s) => !s.okay);
  const problem = sendProblem(count);
  const people = [...new Set(Object.values(count.lines).map((l) => l.by))];
  const base = `/stock/count/${id}`;

  return (
    <main className="page">
      <Nav back={count.areas.length > 1 ? base : `${base}/area/${count.areas[0]?.id}`} backLabel={count.areas.length > 1 ? 'Areas' : count.areas[0]?.name ?? 'Back'} title="Send" />
      <div className="body">
        <div className="titleblock"><h1>Ready to send?</h1></div>

        <div className="hero stk-hero">
          <span className="hl">{count.name} · {dayText(count.businessDate, businessDate)}</span>
          <span className="stk-title">{counted} of {total} counted</span>
          {can.seeStockValue(user.role) && <span className="stk-sub">Worth {formatPounds(countValue(count, data.items).value)} so far</span>}
        </div>

        {left.length + changes.length > 0 ? (
          <section className="grp">
            <div className="hd"><h2>Before you send</h2></div>
            <div className="sub">
              {left.map((a) => (
                <div className="li" key={a.id}>
                  <span className="tx"><span>{a.total - a.counted} not counted yet</span><small className="t-bad">In the {a.name.toLowerCase()}</small></span>
                  <span className="rt"><Link className="chip stk-chip" to={`${base}/area/${a.id}`}>Count</Link></span>
                </div>
              ))}
              {changes.map((s) => {
                const it = item(s.itemId);
                return (
                  <div className="li" key={s.itemId}>
                    <span className="tx"><span>{it?.name}: {qtyText(s.qty, it?.unit ?? '')}</span><small className="t-warn">Last time it was {s.last}</small></span>
                    <span className="rt"><button type="button" className="chip" onClick={() => markOkay(count.id, s.itemId)} aria-label={`${it?.name} is right`}>It's right</button></span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <p className="stk-clear"><Icon d={ICONS.check} size={20} />Everything is counted</p>
        )}
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={!!problem} onClick={() => { send(count.id, recordedAs(user)); navigate(`${base}/low`, { replace: true }); }}>Send count</button>
        <p className="note">{problem ?? `Counted by ${names(people)}`}</p>
      </Foot>
    </main>
  );
}
