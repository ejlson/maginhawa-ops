/** One piece of equipment (PM2): what it is, every call-out, and whether it keeps breaking. */
import { Link, Navigate, useParams } from 'react-router';
import { keepsBreaking } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { useOps } from '../lib/ops';
import { useChecklists } from '../lib/checklists';
import { dayText } from '../lib/stock-helpers';
import { Icon, Nav, RowLink } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

export default function Equipment() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const ops = useOps();
  const { businessDate: today } = useChecklists();
  const e = ops.data.equipment.find((x) => x.id === id);
  if (!user || !e) return <Navigate to="/maintenance" replace />;
  const history = ops.data.callOuts.filter((c) => c.equipmentId === id).sort((a, b) => b.date.localeCompare(a.date));
  const breaking = keepsBreaking(history.map((c) => c.date), today);
  const schedule = ops.data.schedules.find((x) => x.equipmentId === id);

  return (
    <main className="page">
      <Nav back="/maintenance" backLabel="Maintenance" />
      <div className="body">
        <div className="hero stk-hero">
          <span className="hl">{e.make} · serial {e.serial}</span>
          <span className="stk-title">{e.name}</span>
          <span className="stk-sub">Serviced by {e.contractor}</span>
        </div>
        {/* Design PM2: report a fault, or log a visit for this piece of equipment (FM6). */}
        <div className="chips">
          <Link className="chip stk-chip" to="/report"><Icon d={ICONS.bang} size={16} />Report a fault</Link>
          {schedule && can.logVisits(user.role) && <Link className="chip stk-chip" to={`/maintenance/visit/${schedule.id}`}><Icon d={ICONS.cal} size={16} />Log a visit</Link>}
        </div>
        {breaking && <div className="banner warn" role="note"><Icon d={ICONS.bang} size={16} /><span>{history.length} call-outs in 6 months. Worth asking {e.contractor} about a replacement.</span></div>}
        <section className="grp" aria-label="History">
          <div className="hd"><h2>History</h2></div>
          <div className="sub">
            {history.length === 0 && <p className="lead">No call-outs yet.</p>}
            {history.map((c) => <RowLink key={c.date + c.title} lead={<span className="av"><Icon d={ICONS.wrench} /></span>} title={c.title} sub={`${dayText(c.date, today)} · ${c.detail}`} />)}
          </div>
        </section>
      </div>
    </main>
  );
}
