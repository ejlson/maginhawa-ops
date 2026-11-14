/**
 * Maintenance (PM1): what's due next on the main card, the next few after it, and the site's equipment.
 * Anyone can see it; managers log visits.
 */
import { TabBar } from '../components/TabBar';
import { SiteLine } from '../components/SiteLine';
import { Link } from 'react-router';
import { daysBetween, dueStatus, keepsBreaking, serviceNextDue } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { useOps } from '../lib/ops';
import { useChecklists } from '../lib/checklists';
import { dayText } from '../lib/stock-helpers';
import { Icon, Nav, RowLink } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

export default function Maintenance() {
  const { user } = useAuth();
  const ops = useOps();
  const { businessDate: today } = useChecklists();
  if (!user) return null;
  const site = user.siteCode;
  const due = ops.data.schedules.filter((s) => s.siteCode === site)
    .map((s) => ({ s, next: serviceNextDue(s, ops.data.visits) }))
    .sort((a, b) => a.next.localeCompare(b.next));
  const first = due[0];
  const overdue = due.filter((d) => dueStatus(d.next, today) === 'overdue').length;
  const equipment = ops.data.equipment.filter((e) => e.siteCode === site);
  const breaking = (id: string) => keepsBreaking(ops.data.callOuts.filter((c) => c.equipmentId === id).map((c) => c.date), today);
  const when = (d: string) => { const n = daysBetween(today, d); return n < 0 ? `Overdue by ${-n} days` : n === 0 ? 'Due today' : `Due in ${n} days`; };

  const atSite = !(user.role === 'headoffice' && !user.inSite);
  return (
    <main className={`page${atSite ? ' tabs' : ''}`}>
      {!atSite && <Nav back="/head-office" backLabel="Head office" title="Maintenance" />}
      <div className="body">
        {atSite && <SiteLine />}
        <div className="titleblock mh-title page-title"><h1>Maintenance</h1></div>
        {first && (
          <div className="hero stk-hero" role="status">
            <span className="hl">{when(first.next)}</span>
            <span className="stk-title">{first.s.name}</span>
            <span className="stk-sub">{first.s.contractor}{first.s.booked ? ` · booked ${dayText(first.s.booked, today)}` : ''}</span>
            {can.logVisits(user.role) && <Link className="upnext" to={`/maintenance/visit/${first.s.id}`}><span className="tx"><b>Log the visit</b></span><span className="arrow"><Icon d={ICONS.arrow} size={16} /></span></Link>}
          </div>
        )}
        <section className="grp" aria-label="Coming up">
          <div className="hd"><h2>Coming up</h2></div>
          <div className="sub">
            {due.slice(1, 4).map(({ s, next }) => <RowLink key={s.id} to={can.logVisits(user.role) ? `/maintenance/visit/${s.id}` : undefined} lead={<span className="av"><Icon d={/light/i.test(s.name) ? ICONS.sun : /fire|alarm|gas/i.test(s.name) ? ICONS.flame : ICONS.wrench} /></span>}
              title={s.name} sub={`Every ${s.everyMonths === 12 ? 'year' : `${s.everyMonths} months`}${s.contractor ? ` · ${s.contractor}` : ''}`}
              right={<span className={`stk-meta${dueStatus(next, today) === 'overdue' ? ' t-bad' : ''}`}>{dayText(next, today)}</span>} />)}
          </div>
        </section>
        <section className="grp" aria-label="Equipment">
          <div className="hd"><h2>Equipment</h2><span>{equipment.length} items</span></div>
          <div className="sub">
            {/* Design PM1: the equipment that needs attention, with a link to all of it. */}
            {equipment.filter((e) => breaking(e.id)).map((e) => <RowLink key={e.id} to={`/maintenance/equipment/${e.id}`} lead={<span className="av"><Icon d={/fridge|chill|freez/i.test(e.name) ? ICONS.snow : ICONS.box} /></span>}
              title={e.name} sub={`${ops.data.callOuts.filter((c) => c.equipmentId === e.id && daysBetween(c.date, today) <= 183).length} call-outs in 6 months`} right={<span className="pill p-warn">Keeps breaking</span>} />)}
            {equipment.filter((e) => !breaking(e.id)).map((e) => <RowLink key={e.id} to={`/maintenance/equipment/${e.id}`} lead={<span className="av"><Icon d={/fridge|chill|freez/i.test(e.name) ? ICONS.snow : ICONS.box} /></span>}
              title={e.name} sub={e.make} />)}
            <RowLink lead={<span className="av"><Icon d={ICONS.doc} /></span>} title="Certificates" sub="Gas, electrics, extraction, fire"
              right={<span className={`pill ${overdue ? 'p-bad' : 'p-ok'}`}>{overdue ? `${overdue} overdue` : 'All in date'}</span>} />
          </div>
        </section>
      </div>
      {atSite && <TabBar />}
    </main>
  );
}
