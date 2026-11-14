import { Link, Navigate, useLocation } from 'react-router';
import { formatPounds } from '@maginhawa/core';
import { formatDay, timeHM, useDraft } from '../lib/draft';
import { isConnected, isSharedDev } from '../lib/config';
import { Foot, Icon } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

export default function Done() {
  const { report, settings } = useDraft();
  // The one moment in the app that moves: only straight after sending, not when reopened as a receipt.
  const justSent = Boolean((useLocation().state as { justSent?: boolean } | null)?.justSent);
  if (!report || report.status === 'draft' || !report.official) return <Navigate to="/close" replace />;
  const o = report.official;
  const at = report.submittedAt ? timeHM(new Date(report.submittedAt)) : '';
  const warns = report.issues.filter((i) => i.level === 'warn' || i.level === 'ok');
  const repairs = report.draft.feedback.filter((f) => f.raiseRepair).length;

  // Who has it now: head office when connected; otherwise where it was saved.
  const where = report.status === 'approved' ? 'Approved by head office' : isConnected() ? 'Head office has it' : isSharedDev() ? 'On the test server' : 'Saved on this device';
  const notes = report.draft.handover.filter((h) => h.body.trim()).length;

  return (
    <main className={`page sent-page${justSent ? ' celebrate' : ''}`}>
      <div className="body sent-body">
        {/* Design P9: the card centred, a big tick, the day and its net, and who has it now. */}
        <div className="hero sent-card">
          <svg className="closed-mark" viewBox="0 0 72 72" aria-hidden="true">
            <circle className="disc" cx="36" cy="36" r="36" />
            <path className="tick" d="M22 37l9.5 9.5L51 27" />
          </svg>
          <h1 className="rise r1">Day closed</h1>
          <span className="sent-line rise r2">{settings.siteName} · {formatDay(report.draft.businessDate, { weekday: 'long', day: 'numeric', month: 'short' })} · {formatPounds(o.totalNet)} net</span>
          <span className="sent-pill rise r3"><span className="dot" aria-hidden="true" />{where}{at ? ` · ${at}` : ''}</span>
        </div>
        <section className="grp rise r4" aria-label="What happens next">
          <div className="sub">
            <div className="li"><span className="av"><Icon d={ICONS.check} /></span><span className="tx">
              <span>{report.status === 'approved' ? 'Head office approved it' : isConnected() ? 'Head office checks it' : 'Kept on this device'}</span>
              <small>{report.submittedBy ? `Sent by ${report.submittedBy}${at ? ` at ${at}` : ''}. ` : ''}{report.status === 'approved' ? 'Nothing else to do.' : isConnected() ? 'In the morning. You hear only if something needs fixing' : 'Head office sees it once this device is connected'}{warns.length && report.status !== 'approved' ? ` · ${warns.length} ${warns.length === 1 ? 'note' : 'notes'} for them` : ''}</small>
            </span></div>
            {notes > 0 && <div className="li"><span className="av"><Icon d={ICONS.handover} /></span><span className="tx"><span>Handover goes to the opener</span><small>{notes} {notes === 1 ? 'note' : 'notes'} for tomorrow morning</small></span></div>}
            {repairs > 0 && <div className="li"><span className="av warn"><Icon d={ICONS.wrench} /></span><span className="tx"><span>Repair raised</span><small>{repairs} from feedback</small></span></div>}
            <div className="li"><span className="av"><Icon d={ICONS.pen} /></span><span className="tx"><span>Need to change something?</span><small>Ask head office to send it back. Every change is recorded.</small></span></div>
          </div>
        </section>
      </div>
      <Foot>
        <Link className="btn b1" to="/">Done</Link>
      </Foot>
    </main>
  );
}
