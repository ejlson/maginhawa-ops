import { alertMatches, ALERT_ACTIONS, deliveryProblems, type AlertAction } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { degrees, hm, shortDate, useFoodSafety } from '../lib/food-safety';
import { useChecklists } from '../lib/checklists';
import { Foot, Icon, ICONS, Nav } from '../components/ui';
import { Link } from 'react-router';

/** Deliveries with batch codes, and FSA food alerts matched against what we received (HANDOFF.md §8a, item 7). */
export default function FsDeliveries() {
  const { user } = useAuth();
  const { site, data, siteCode, actOnAlert } = useFoodSafety();
  const { businessDate: today } = useChecklists();
  const deliveries = [...site.deliveries].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  return (
    <main className="page">
      <Nav back="/food-safety" backLabel="Food safety" title="Deliveries" />
      <div className="body">
        <div className="titleblock">
          <h1>Deliveries and recalls</h1>
          <p className="lead">Every item's batch code and use-by date, so a recall can be traced to what we actually received.</p>
        </div>

        <section className="grp">
          <div className="hd"><h2>Food alerts</h2><span>From the FSA</span></div>
          <div className="sub">
            {data.alerts.map((a) => {
              const hits = alertMatches(a, site.deliveries);
              const done = data.alertActions[`${a.id}|${siteCode}`];
              return (
                <div key={a.id}>
                  <div className="li">
                    <span className={`av ${hits.length && !done ? 'bad' : 'ok'}`}><Icon d={hits.length && !done ? ICONS.bang : ICONS.check} /></span>
                    <span className="tx"><span>{a.title}</span><small>{a.reason} · batches {a.batches.join(', ')} · {shortDate(a.issuedOn, today)}</small>
                      <small className={hits.length ? 'bad' : ''}>{hits.length ? `Matches ${hits.map((h) => `${h.item.name} (${h.item.batch})`).join(', ')}` : 'Nothing we received matches'}</small>
                      {done && <small>{ALERT_ACTIONS[done.action]} · {done.by} · {hm(done.at)}</small>}
                    </span>
                  </div>
                  {hits.length > 0 && !done && (
                    <div className="chips" role="group" aria-label={`What we did about ${a.title}`} style={{ paddingLeft: 56, paddingBottom: 12 }}>
                      {(Object.keys(ALERT_ACTIONS) as AlertAction[]).map((k) => <button key={k} type="button" className="chip" onClick={() => actOnAlert(a.id, k, user?.name ?? 'Manager')}>{ALERT_ACTIONS[k]}</button>)}
                    </div>
                  )}
                </div>
              );
            })}
            {!data.alerts.length && <p className="muted">No alerts.</p>}
          </div>
        </section>

        <section className="grp">
          <div className="hd"><h2>Received</h2><span>{deliveries.length}</span></div>
          <div className="sub">
            {deliveries.map((d) => {
              const problems = deliveryProblems(d, data.approvedSuppliers, d.receivedAt.slice(0, 10));
              return (
                <div className="li" key={d.id}>
                  <span className={`av ${problems.length ? 'warn' : ''}`}><Icon d={ICONS.box} /></span>
                  <span className="tx"><span>{d.supplier} · {shortDate(d.receivedAt, today)} {hm(d.receivedAt)}</span>
                    <small>{d.items.map((i) => `${i.name} · ${i.batch}`).join('; ')}</small>
                    {problems.length > 0 && <small className="warn">{problems.join('. ')}</small>}
                  </span>
                  <span className="amt">{d.chilledC === null ? '' : degrees(d.chilledC)}</span>
                </div>
              );
            })}
          </div>
          <p className="note">Approved suppliers: {data.approvedSuppliers.join(', ')}.</p>
        </section>
      </div>
      <Foot><Link className="btn b1" to="/food-safety/deliveries/new">Check in a delivery</Link></Foot>
    </main>
  );
}
