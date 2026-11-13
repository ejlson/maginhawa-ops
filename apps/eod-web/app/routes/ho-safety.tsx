/** Head office › Health and safety (HS4): every site's checks, and what needs head office. */
import { accidentState, doneThisPeriod, SAFETY_CHECKS, SITES, type SafetyCheckKind } from '@maginhawa/core';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { WhoMenu } from '../components/home/WhoMenu';
import { SiteMono } from '../lib/site-colours';
import { useOps } from '../lib/ops';
import { useChecklists } from '../lib/checklists';
import { dayText } from '../lib/stock-helpers';

const MONTHLY = (Object.keys(SAFETY_CHECKS) as SafetyCheckKind[]).filter((k) => SAFETY_CHECKS[k].every === 'month');

export default function HoSafety() {
  const ops = useOps();
  const { businessDate: today } = useChecklists();
  const rows = SITES.map((s) => {
    const fire = doneThisPeriod('fire-alarm', ops.data.safetyChecks, s.code, today);
    const left = MONTHLY.filter((k) => !doneThisPeriod(k, ops.data.safetyChecks, s.code, today)).length;
    const acc = ops.data.accidents.filter((a) => a.siteCode === s.code).map((a) => ({ a, st: accidentState(a, today) })).filter((x) => x.st.kind === 'report' || x.st.kind === 'check');
    return { s, fire, left, acc };
  });
  const reports = rows.flatMap((r) => r.acc.filter((x) => x.st.kind === 'report').map((x) => ({ ...x, s: r.s })));
  const missed = rows.filter((r) => !r.fire);
  const upToDate = rows.filter((r) => r.fire && r.left === 0 && !r.acc.length).length;

  return (
    <HeadOfficeShell>
      <main className="page wide">
        <header className="nav" style={{ paddingLeft: 24 }}><span className="title">Health and safety</span><WhoMenu /></header>
        <div className="body" style={{ paddingTop: 24, gap: 28 }}>
          <div className="titleblock"><span className="eyebrow">All sites · this week</span><h1>Health and safety</h1></div>
          <div className="hero">
            <span className="hl">This week</span>
            <span className="ho-sentence">{reports.length ? `${reports.length} accident${reports.length > 1 ? 's' : ''} must be reported to the HSE. ` : ''}{missed.length ? `${missed.length} site${missed.length > 1 ? 's haven’t' : ' hasn’t'} done the fire alarm test.` : 'Every fire alarm test is done.'}</span>
            <div className="hm"><span>{upToDate} of {SITES.length}<small>Up to date</small></span><span>{missed.length}<small>Fire tests to do</small></span><span>{reports.length}<small>HSE reports due</small></span></div>
          </div>
          <div className="stk-cols">
            <section className="grp" aria-label="Sites">
              <div className="hd"><h2>Sites</h2></div>
              <div className="sub">
                {rows.map(({ s, fire, left, acc }) => (
                  <div className="li" key={s.code}>
                    <SiteMono code={s.code} size="lg" />
                    <span className="tx"><span>{s.name}</span><small>{left ? `${left} monthly check${left > 1 ? 's' : ''} to do` : 'Monthly checks done'}{acc.length ? ` · ${acc.length} accident to follow up` : ''}</small></span>
                    <span className="rt"><span className={`pill ${fire ? 'p-ok' : 'p-warn'}`}>{fire ? 'Fire test done' : 'Fire test due'}</span></span>
                  </div>
                ))}
              </div>
            </section>
            <section className="grp" aria-label="Needs head office">
              <div className="hd"><h2>Needs you</h2></div>
              <div className="sub">
                {reports.length === 0 && missed.length === 0 && <p className="lead">Nothing right now.</p>}
                {reports.map(({ a, st, s }) => (
                  <div className="li" key={a.id}><SiteMono code={s.code} /><span className="tx"><span>{a.name}: {a.what.toLowerCase()}, {a.injury.toLowerCase()}</span><small>{s.name} · {dayText(a.businessDate, today)} · off {a.daysOff} days</small></span>
                    <span className="rt"><span className="pill p-bad">Report by {st.kind === 'report' ? dayText(st.by, today) : ''}</span></span></div>
                ))}
                {missed.map(({ s }) => <div className="li" key={s.code}><SiteMono code={s.code} /><span className="tx"><span>Fire alarm test not done</span><small>{s.name} · due by Sunday</small></span><span className="rt"><span className="pill p-warn">Ask the site</span></span></div>)}
              </div>
              <p className="lead">RIDDOR: an injury that keeps a worker off for more than 7 days must be reported within 15 days.</p>
            </section>
          </div>
        </div>
      </main>
    </HeadOfficeShell>
  );
}
