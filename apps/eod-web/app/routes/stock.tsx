/**
 * Stock (anyone): the one count to do next on the main card, then the site's other regular counts
 * and the last few sent. Designs: design/redesign-canvas/project/S1-Stock.dc.html.
 */
import { useNavigate } from 'react-router';
import { areasFor, countValue, formatPounds, itemIdsOf, type StockPlan } from '@maginhawa/core';
import { can, recordedAs, useAuth } from '../lib/auth';
import { useStock } from '../lib/stock';
import { useChecklists } from '../lib/checklists';
import { useDraft } from '../lib/draft';
import { isConnected } from '../lib/config';
import { dayText, minutesText, planState, type PlanState } from '../lib/stock-helpers';
import { Icon, Nav, Pie, RowLink } from '../components/ui';
import { ICONS } from '../components/ui-helpers';
import { hm } from '../lib/food-safety';
import { useOps } from '../lib/ops';
import { suggestions, amountText } from '../lib/ops-helpers';
import { dailyUse, runsOutText } from '@maginhawa/core';

export default function Stock() {
  const { user } = useAuth();
  const { site, start, data } = useStock();
  const { businessDate } = useChecklists();
  const { settings } = useDraft();
  const navigate = useNavigate();
  const ops = useOps();
  if (!user) return null;
  const low = suggestions(data.items, data.counts, ops, user.siteCode).filter((s) => s.packs > 0 && s.onHand !== null)
    .map((s) => ({ ...s, lasts: runsOutText(s.onHand!, dailyUse(s.item.id, ops.data.recipes)) }))
    .sort((a, b) => (a.onHand! / a.par) - (b.onHand! / b.par)).slice(0, 3);
  const toCheck = ops.data.orders.filter((o) => o.siteCode === user.siteCode && o.sentAt && !o.receivedAt);
  const today = businessDate;
  const states = site.plans.map((p) => ({ plan: p, state: planState(p, site.counts, today) }));
  // The main card: a count already started, else the first one due today (the full count first, it matters most).
  const focus = states.find((s) => s.state.kind === 'open')
    ?? [...states].sort((a, b) => (a.plan.kind === 'full' ? -1 : 0) - (b.plan.kind === 'full' ? -1 : 0)).find((s) => s.state.kind === 'due')
    ?? null;
  const others = states.filter((s) => s !== focus);
  // A count with one area (most spot counts) goes straight to counting: no list of one.
  const go = (plan: StockPlan) => {
    const id = start(plan.id, recordedAs(user));
    const open = site.counts.find((c) => c.id === id);
    const areas = open?.areas ?? areasFor(plan, data.areas, data.items);
    navigate(areas.length === 1 ? `/stock/count/${id}/area/${areas[0]!.id}` : `/stock/count/${id}`);
  };
  const itemCount = (plan: StockPlan) => plan.itemIds?.length ?? data.areas.filter((a) => a.siteCode === plan.siteCode).reduce((n, a) => n + a.itemIds.length, 0);
  const past = site.counts.filter((c) => c.sentAt).slice(0, 5);
  const nextUp = states.filter((s) => s.state.kind === 'later').map((s) => ({ plan: s.plan, next: (s.state as Extract<PlanState, { kind: 'later' }>).next ?? '9999' }))
    .sort((a, b) => a.next.localeCompare(b.next))[0];

  const sub = (s: PlanState, plan: StockPlan) => {
    if (s.kind === 'open') return `${Object.keys(s.count.lines).length} of ${itemIdsOf(s.count).length} counted`;
    if (s.kind === 'done') return `Done today at ${hm(s.count.sentAt!)}`;
    if (s.kind === 'due') return `Due today · ${itemCount(plan)} items`;
    return s.next ? `Next: ${dayText(s.next, today)}` : '';
  };
  const pie = (s: PlanState) => <Pie status={s.kind === 'done' ? 'done' : s.kind === 'open' ? 'started' : 'todo'} />;

  return (
    <main className="page">
      <Nav back={user.role === 'headoffice' && !user.inSite ? '/head-office' : '/more'} backLabel={user.role === 'headoffice' && !user.inSite ? 'Head office' : 'More'} title="Stock" />
      <div className="body">
        <div className="titleblock"><h1>Stock</h1><p className="lead">{settings.siteName}</p></div>

        <div className="hero stk-hero" role="status">
          {focus ? (
            <>
              <span className="hl">{focus.state.kind === 'open' ? `Started by ${focus.state.count.startedBy}` : 'Due today'}</span>
              <span className="stk-title">{focus.plan.name}</span>
              <span className="stk-sub">{focus.state.kind === 'open' ? sub(focus.state, focus.plan) : `${itemCount(focus.plan)} items · ${minutesText(itemCount(focus.plan))}`}</span>
              <button type="button" className="upnext" onClick={() => go(focus.plan)}>
                <span className="tx"><b>{focus.state.kind === 'open' ? 'Carry on' : 'Start count'}</b></span>
                <span className="arrow"><Icon d={ICONS.arrow} size={16} /></span>
              </button>
            </>
          ) : (
            <>
              <span className="hl">Stock</span>
              <span className="stk-title">All counted for today</span>
              {nextUp && <span className="stk-sub">Next: {nextUp.plan.name}, {dayText(nextUp.next, today)}</span>}
            </>
          )}
        </div>

        {others.length > 0 && (
          <section className="grp">
            <div className="hd"><h2>{focus ? 'Other counts' : 'Counts'}</h2></div>
            <div className="sub">
              {others.map(({ plan, state }) => (
                <RowLink key={plan.id} lead={pie(state)} title={plan.name} sub={sub(state, plan)}
                  to={state.kind === 'done' ? `/stock/count/${state.count.id}` : undefined}
                  onClick={state.kind === 'done' ? undefined : () => go(plan)} />
              ))}
            </div>
          </section>
        )}

        {low.length > 0 && (
          <section className="grp" aria-label="Running low">
            <div className="hd"><h2>Running low</h2></div>
            <div className="sub">
              {low.map((l) => <RowLink key={l.item.id} to={`/stock/item/${l.item.id}`} lead={<span className="av"><Icon d={ICONS.box} /></span>}
                title={l.item.name} sub={`${amountText(l.onHand!, l.item.unit)} left${l.lasts ? ` · ${l.lasts.toLowerCase()}` : ''}`} />)}
            </div>
          </section>
        )}

        <section className="grp" aria-label="Orders and waste">
          <div className="hd"><h2>Orders and waste</h2></div>
          <div className="sub">
            {toCheck.map((o) => <RowLink key={o.id} to={`/stock/delivery/${o.id}`} lead={<span className="av warn"><Icon d={ICONS.check} /></span>}
              title={`Check in ${ops.supplier(o.supplierId)?.name ?? 'a delivery'}`} sub="Arrived? Tap only what didn't come" />)}
            <RowLink to="/stock/order" lead={<span className="av"><Icon d={ICONS.box} /></span>} title="Order" sub={can.sendOrders(user.role) ? 'Filled in from your usual levels' : 'See what we order'} />
            <RowLink to="/stock/waste" lead={<span className="av"><Icon d={ICONS.x} /></span>} title="Log waste" sub="Item, then Log" />
          </div>
        </section>

        {past.length > 0 && (
          <section className="grp" aria-label="Sent">
            <div className="hd"><h2>Sent</h2></div>
            <div className="sub">
              {past.map((c) => (
                <RowLink key={c.id} to={`/stock/count/${c.id}`} lead={<span className="av"><Icon d={c.kind === 'full' ? ICONS.box : ICONS.list} /></span>}
                  title={c.name} sub={`${dayText(c.businessDate, today)} · ${c.sentBy}`}
                  right={can.seeStockValue(user.role) ? <b className="amt">{formatPounds(countValue(c, data.items).value)}</b> : undefined} />
              ))}
            </div>
          </section>
        )}

        {!isConnected() && <div className="banner" role="note"><Icon d={ICONS.bang} size={16} /><span>Example stock, saved on this device until the app is connected. Names and figures are made up.</span></div>}
      </div>
    </main>
  );
}
