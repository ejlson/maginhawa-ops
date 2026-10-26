import { Link, Navigate } from 'react-router';
import { formatPounds, splitPounds } from '@maginhawa/core';
import { formatDay, timeHM, useDraft } from '../lib/draft';
import { isConnected } from '../lib/config';
import { Foot, Icon, ICONS } from '../components/ui';

export default function Done() {
  const { report, settings } = useDraft();
  if (!report || report.status === 'draft' || !report.official) return <Navigate to="/close" replace />;
  const o = report.official;
  const at = report.submittedAt ? timeHM(new Date(report.submittedAt)) : '';
  const [p, d] = splitPounds(o.totalNet);
  const warns = report.issues.filter((i) => i.level === 'warn' || i.level === 'ok');
  const repairs = report.draft.feedback.filter((f) => f.raiseRepair).length;

  return (
    <main className="page">
      <div className="body" style={{ paddingTop: 56 }}>
        <div className="hero">
          <div className="av" style={{ width: 48, height: 48, borderRadius: 24, background: 'var(--heroOk)', color: '#000' }}><Icon d={ICONS.check} size={24} /></div>
          <h1 style={{ marginTop: 4 }}>Day closed</h1>
          <span className="hl">{settings.siteName}, {formatDay(report.draft.businessDate)}. Sent at {at} by {report.submittedBy}.</span>
          <div className="hero-row" style={{ paddingTop: 14, borderTop: '.5px solid var(--heroline)' }}>
            <div className="big"><b style={{ fontSize: 34 }}>{p}</b><i style={{ fontSize: 18 }}>{d} net</i></div>
            {report.status === 'approved' && <span className="hs-small h-ok">Approved by head office</span>}
          </div>
        </div>
        <section className="grp">
          <div className="hd"><h2>What happens next</h2></div>
          <div className="sub">
            <div className="li"><span className="av ok"><Icon d={ICONS.check} size={17} /></span><span className="tx"><span>{isConnected() ? 'Received by head office' : 'Saved on this device'}</span><small>{at}{warns.length ? ` · ${warns.length} ${warns.length === 1 ? 'note' : 'notes'} for finance` : ''}</small></span></div>
            <div className="li"><span className="av"><Icon d={ICONS.chart} /></span><span className="tx"><span>Figures checked again</span><small>{formatPounds(o.totalNet)} net · {o.covers} covers · wages {o.wagePct ?? '—'}%</small></span></div>
            {report.draft.handover.length > 0 && <div className="li"><span className="av"><Icon d={ICONS.arrow} /></span><span className="tx"><span>Handover waits for the opener</span><small>{report.draft.handover.length} for tomorrow morning</small></span></div>}
            {repairs > 0 && <div className="li"><span className="av warn"><Icon d={ICONS.wrench} size={17} /></span><span className="tx"><span>Repair raised</span><small>{repairs} from feedback</small></span></div>}
          </div>
          <p className="note">Need to change something? Ask finance to reopen it. Every change is recorded.</p>
        </section>
      </div>
      <Foot>
        <Link className="btn b1" to="/">Done</Link>
      </Foot>
    </main>
  );
}
