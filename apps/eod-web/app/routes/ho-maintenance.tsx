/** Head office › Maintenance (PM4): one sentence, then only what needs action; the rest folds away. */
import { useState } from 'react';
import { daysBetween, dueStatus, keepsBreaking, serviceNextDue, SITES } from '@maginhawa/core';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { WhoMenu } from '../components/home/WhoMenu';
import { SiteMono } from '../lib/site-colours';
import { useOps } from '../lib/ops';
import { useChecklists } from '../lib/checklists';
import { dayText } from '../lib/stock-helpers';

export default function HoMaintenance() {
  const ops = useOps();
  const { businessDate: today } = useChecklists();
  const [all, setAll] = useState(false);
  const name = (c: string) => SITES.find((s) => s.code === c)?.name ?? c;
  const rows = ops.data.schedules.filter((s) => SITES.some((x) => x.code === s.siteCode))
    .map((s) => { const next = serviceNextDue(s, ops.data.visits); return { s, next, st: dueStatus(next, today) }; })
    .sort((a, b) => a.next.localeCompare(b.next));
  const action = rows.filter((r) => r.st !== 'ok');
  const fine = rows.filter((r) => r.st === 'ok');
  const overdue = action.filter((r) => r.st === 'overdue').length;
  const breaking = ops.data.equipment.map((e) => ({ e, outs: ops.data.callOuts.filter((c) => c.equipmentId === e.id) }))
    .filter((x) => keepsBreaking(x.outs.map((c) => c.date), today));

  const row = ({ s, next, st }: (typeof rows)[number]) => (
    <div className="li" key={s.id}>
      <SiteMono code={s.siteCode} />
      <span className="tx"><span>{s.name}</span><small>{name(s.siteCode)} · {st === 'overdue' ? `was due ${dayText(next, today)}` : `due ${dayText(next, today)}`} · {s.contractor}</small></span>
      <span className="rt">
        {st === 'overdue' ? <span className="pill p-bad">Overdue</span> : s.booked ? <span className="pill p-ok">Booked</span> : st === 'soon' ? <span className="pill p-mut">In {daysBetween(today, next)} days</span> : <span className="stk-meta">{dayText(next, today)}</span>}
        {st === 'overdue' && <button type="button" className="chip">Chase site</button>}
      </span>
    </div>
  );

  return (
    <HeadOfficeShell>
      <main className="page wide">
        <header className="nav" style={{ paddingLeft: 24 }}><span className="title">Maintenance</span><WhoMenu /></header>
        <div className="body" style={{ paddingTop: 24, gap: 28 }}>
          <div className="titleblock"><span className="eyebrow">All sites</span><h1>Maintenance</h1></div>
          <div className="hero">
            <span className="hl">This week</span>
            <span className="ho-sentence">{overdue ? `${overdue} certificate${overdue > 1 ? 's are' : ' is'} overdue.` : 'Nothing is overdue.'} Everything else is in date.</span>
          </div>
          <section className="grp" aria-label="Needs action">
            <div className="hd"><h2>Needs action</h2><span>Overdue first, then the next 30 days</span></div>
            <div className="sub">
              {action.map(row)}
              {!all ? (
                <button type="button" className="li" onClick={() => setAll(true)}><span className="av"><svg width="19" height="19" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3.5 9.5l3.5 3.5L14.5 5" /></svg></span>
                  <span className="tx"><span>{fine.length} more, all in date</span><small>Gas, extraction, electrics, fire, extinguishers, pest control</small></span><span className="rt"><span className="stk-meta" style={{ color: 'var(--link)' }}>See all</span></span></button>
              ) : fine.map(row)}
            </div>
          </section>
          {breaking.length > 0 && (
            <section className="grp" aria-label="Keeps breaking">
              <div className="hd"><h2>Keeps breaking</h2><span>3 or more call-outs in 6 months</span></div>
              <div className="sub">
                {breaking.map(({ e, outs }) => <div className="li" key={e.id}><SiteMono code={e.siteCode} /><span className="tx"><span>{e.name}</span><small>{name(e.siteCode)} · {outs.length} call-outs · {e.contractor}</small></span><span className="rt"><button type="button" className="chip">Ask for a quote</button></span></div>)}
              </div>
            </section>
          )}
        </div>
      </main>
    </HeadOfficeShell>
  );
}
