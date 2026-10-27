import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import {
  ALLERGENS, alertMatches, ALERT_ACTIONS, calibrationResult, certStatus, complaintForInspector, coolingStatus, currentVersion, inRange,
  PACK_LABELS, PACK_NOTES, PACK_SECTIONS, SITES, validRange, type PackSection,
} from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { useChecklists } from '../lib/checklists';
import { useTemplates } from '../lib/templates';
import { degrees, hm, shortDate, useFoodSafety } from '../lib/food-safety';
import { loadChecklistRecords, type PackRun } from '../lib/records-pack';
import { isConnected } from '../lib/config';
import { now } from '../lib/clock';
import { Nav } from '../components/ui';
import { Sk, SkRows } from '../components/Skeleton';

const shown = (v: unknown, temp: boolean) => (typeof v === 'number' ? (temp ? degrees(v) : String(v)) : v === true ? 'Yes' : v === false ? 'No' : Array.isArray(v) ? v.join(', ') : typeof v === 'string' && v.startsWith('data:') ? 'Photo' : String(v ?? '—'));

function Section({ id, title, count, children }: { id: PackSection; title: string; count: number; children: ReactNode }) {
  return (
    <section className="pack-sec" aria-labelledby={`pack-${id}`}>
      <h2 id={`pack-${id}`}>{title} <span className="muted">· {count}</span></h2>
      {PACK_NOTES[id] && <p className="note">{PACK_NOTES[id]}</p>}
      {count ? children : <p className="muted">Nothing recorded in these dates.</p>}
    </section>
  );
}

/** The inspector's pack: plain tables, made to print. */
export default function FsPack() {
  const [q] = useSearchParams();
  const { user } = useAuth();
  const { businessDate: today } = useChecklists();
  const { records } = useTemplates();
  const { forSite, data } = useFoodSafety();
  const anySite = Boolean(user && can.seeAllSites(user.role));
  // Supervisors and managers only ever get their own site, whatever the link says.
  const siteCode = anySite ? (q.get('site') ?? user?.siteCode ?? '') : (user?.siteCode ?? '');
  const range = { from: q.get('from') ?? '', to: q.get('to') ?? '' };
  const sections = (q.get('s') ?? '').split(',').filter((s): s is PackSection => (PACK_SECTIONS as readonly string[]).includes(s));
  const [runs, setRuns] = useState<PackRun[] | null>(null);
  const wantRuns = sections.includes('checks') || sections.includes('faults');
  useEffect(() => {
    if (!wantRuns || validRange(range, today)) { setRuns([]); return; }
    let live = true;
    loadChecklistRecords(siteCode, range, records).then((r) => { if (live) setRuns(r); }).catch(() => { if (live) setRuns([]); });
    return () => { live = false; };
  }, [siteCode, range.from, range.to, wantRuns, records, today]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !can.compileRecords(user.role)) return <Navigate to="/" replace />;
  if (validRange(range, today)) return <Navigate to="/food-safety/records" replace />;
  const site = forSite(siteCode);
  const siteName = SITES.find((s) => s.code === siteCode)?.name ?? siteCode;
  const d = (iso: string) => shortDate(iso, today);
  const has = (s: PackSection) => sections.includes(s);
  const madeAt = now();

  const checks = runs ?? [];
  const faults = checks.flatMap((r) => r.failures.map((f) => ({ ...f, date: r.date, list: r.template.title })));
  const cooks = site.cooks.filter((c) => inRange(c.at, range));
  const cals = site.probes.flatMap((p) => p.calibrations.filter((c) => inRange(c.date, range)).map((c) => ({ ...c, probe: p.name })));
  const deliveries = site.deliveries.filter((x) => inRange(x.receivedAt, range));
  const alerts = data.alerts.filter((a) => inRange(a.issuedOn, range));
  const complaints = site.complaints.filter((c) => inRange(c.at, range)).map(complaintForInspector);
  const visits = (site.compliance?.visits ?? []).filter((v) => inRange(v.date, range));
  const notices = (site.compliance?.notices ?? []).filter((n) => inRange(n.servedOn, range) || !n.closedOn);
  const dishChanges = site.dishes.flatMap((dish) => dish.versions.filter((v) => inRange(v.at, range)).map((v) => ({ dish: dish.name, ...v })));

  return (
    <main className="page pack">
      <div className="no-print"><Nav back="/food-safety/records" backLabel="Back" title="Records" right={<button type="button" className="linkbtn" onClick={() => window.print()}>Print</button>} /></div>
      <div className="body">
        <header className="pack-head">
          <span className="eyebrow">Food safety records</span>
          <h1>{siteName}</h1>
          <p className="lead">{d(range.from)} to {d(range.to)} · made by {user.name} on {d(madeAt.toISOString())} at {hm(madeAt.toISOString())}</p>
          {site.compliance && <p className="note">Registered with {site.compliance.council || '[council]'}{site.compliance.registeredOn ? ` since ${d(site.compliance.registeredOn)}` : ''}. Times are when each record reached the server.</p>}
          {!isConnected() && <p className="note">Example records from demo mode. Names and figures are made up.</p>}
          <button type="button" className="btn b1 no-print" onClick={() => window.print()}>Print or save as PDF</button>
        </header>

        {wantRuns && runs === null && (
          <section className="pack-sec no-print" aria-busy="true"><Sk w={220} h={20} /><SkRows count={4} label="Collecting checklist records" /></section>
        )}

        {has('checks') && runs && (
          <Section id="checks" title={PACK_LABELS.checks} count={checks.length}>
            <table className="pack-t">
              <thead><tr><th>Date</th><th>Checklist</th><th>Answers</th><th>Finished</th></tr></thead>
              <tbody>
                {checks.map((r) => (
                  <tr key={r.run.key}>
                    <td>{d(r.date)}{r.run.dueTime ? ` ${r.run.dueTime}` : ''}</td>
                    <td>{r.template.title}</td>
                    <td>
                      {r.template.checkpoints.filter((c) => r.run.answers[c.id] !== undefined).map((c) => (
                        <div key={c.id}>
                          {c.title}: <b>{shown(r.run.answers[c.id], c.type === 'temp')}</b>{r.run.answeredBy?.[c.id] ? ` (${r.run.answeredBy[c.id]!.by})` : ''}
                          {r.run.corrections?.[c.id]?.map((x, i) => <div key={i} className="pack-corr">Corrected from {shown(x.previous, c.type === 'temp')} by {x.by}, {d(x.at)} {hm(x.at)}: “{x.reason}”</div>)}
                        </div>
                      ))}
                    </td>
                    <td>{r.run.completedAt ? `${hm(r.run.completedAt)} by ${r.run.completedBy}` : 'Not finished'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {has('faults') && runs && (
          <Section id="faults" title={PACK_LABELS.faults} count={faults.length}>
            <table className="pack-t">
              <thead><tr><th>Date</th><th>Check</th><th>Problem</th><th>What we did</th></tr></thead>
              <tbody>{faults.map((f, i) => <tr key={i}><td>{d(f.date)}</td><td>{f.list}: {f.title}</td><td>{f.reason}</td><td>{f.fix ?? 'Not recorded'}</td></tr>)}</tbody>
            </table>
          </Section>
        )}

        {has('allergens') && (
          <Section id="allergens" title={PACK_LABELS.allergens} count={site.dishes.length}>
            <table className="pack-t">
              <thead><tr><th>Dish</th><th>Contains (of the 14)</th><th>Version</th></tr></thead>
              <tbody>{site.dishes.map((dish) => { const v = currentVersion(dish); return <tr key={dish.id}><td>{dish.name}</td><td>{v?.allergens.length ? v.allergens.join(', ') : 'None of the 14'}</td><td>v{v?.version} · {v ? d(v.at) : ''}</td></tr>; })}</tbody>
            </table>
            {dishChanges.length > 0 && <>
              <h3>Changes in these dates</h3>
              <table className="pack-t"><tbody>{dishChanges.map((c) => <tr key={`${c.dish}${c.version}`}><td>{d(c.at)}</td><td>{c.dish} v{c.version}</td><td>{c.allergens.join(', ') || 'None'}</td><td>{c.note || 'New dish'} ({c.by})</td></tr>)}</tbody></table>
            </>}
            <p className="note">The 14: {ALLERGENS.join(', ')}.</p>
          </Section>
        )}

        {has('cooking') && (
          <Section id="cooking" title={PACK_LABELS.cooking} count={cooks.length}>
            <table className="pack-t">
              <thead><tr><th>When</th><th>Dish</th><th>Core temperature</th><th>Cooling</th></tr></thead>
              <tbody>{cooks.map((c) => {
                const s = c.coolingStartedAt ? coolingStatus(c.coolingStartedAt, madeAt, c.inFridgeAt) : null;
                return <tr key={c.id}><td>{d(c.at)} {hm(c.at)}</td><td>{c.dish} ({c.kind === 'cook' ? 'cooked' : 'reheated'}, {c.by})</td><td>{degrees(c.tempC)}</td>
                  <td>{!s ? 'Served or hot-held' : c.inFridgeAt ? `In the fridge ${hm(c.inFridgeAt)}${s.state === 'done-late' ? ' (over 90 min)' : ''}` : 'Still cooling'}{c.checks.map((x) => `; ${hm(x.at)} ${degrees(x.tempC)}`).join('')}</td></tr>;
              })}</tbody>
            </table>
          </Section>
        )}

        {has('probes') && (
          <Section id="probes" title={PACK_LABELS.probes} count={cals.length}>
            <table className="pack-t">
              <thead><tr><th>Date</th><th>Probe</th><th>Iced water</th><th>Boiling water</th><th>Result</th></tr></thead>
              <tbody>{cals.map((c, i) => <tr key={i}><td>{d(c.date)}</td><td>{c.probe} ({c.by})</td><td>{degrees(c.ice)}</td><td>{degrees(c.boil)}</td><td>{calibrationResult(c.ice, c.boil).passed ? 'Passed' : 'Failed: taken out of use'}</td></tr>)}</tbody>
            </table>
          </Section>
        )}

        {has('deliveries') && (
          <Section id="deliveries" title={PACK_LABELS.deliveries} count={deliveries.length}>
            <table className="pack-t">
              <thead><tr><th>When</th><th>Supplier</th><th>Chilled</th><th>Items (batch · use by)</th></tr></thead>
              <tbody>{deliveries.map((x) => <tr key={x.id}><td>{d(x.receivedAt)} {hm(x.receivedAt)}</td><td>{x.supplier} ({x.receivedBy})</td><td>{x.chilledC === null ? '—' : degrees(x.chilledC)}{x.packagingOk ? '' : '; packaging damaged'}</td>
                <td>{x.items.map((i) => `${i.name} · ${i.batch || 'no batch'} · ${i.useBy ? d(i.useBy) : '—'}`).join('; ')}{x.rejected.length ? `. Rejected: ${x.rejected.join(', ')}` : ''}</td></tr>)}</tbody>
            </table>
            <p className="note">Approved suppliers: {data.approvedSuppliers.join(', ')}.</p>
            {alerts.length > 0 && <>
              <h3>Food alerts</h3>
              <table className="pack-t"><tbody>{alerts.map((a) => {
                const act = data.alertActions[`${a.id}|${siteCode}`];
                const hits = alertMatches(a, site.deliveries);
                return <tr key={a.id}><td>{d(a.issuedOn)}</td><td>{a.title}: {a.reason}</td><td>{hits.length ? `Matched ${hits.map((h) => h.item.batch).join(', ')}` : 'Not received'}</td><td>{act ? `${ALERT_ACTIONS[act.action]} (${act.by}, ${d(act.at)})` : hits.length ? 'No action recorded' : '—'}</td></tr>;
              })}</tbody></table>
            </>}
          </Section>
        )}

        {has('training') && (
          <Section id="training" title={PACK_LABELS.training} count={site.staff.length}>
            <table className="pack-t">
              <thead><tr><th>Person</th><th>Certificate</th><th>Expires</th></tr></thead>
              <tbody>{site.staff.map((s) => {
                const certs = site.certificates.filter((c) => c.person === s.name);
                return certs.length
                  ? certs.map((c, i) => <tr key={`${s.name}${i}`}><td>{s.name} ({s.job})</td><td>{c.kind}</td><td>{d(c.expires)}{certStatus(c, today).state === 'expired' ? ' (expired)' : ''}</td></tr>)
                  : <tr key={s.name}><td>{s.name} ({s.job})</td><td>None recorded</td><td>—</td></tr>;
              })}</tbody>
            </table>
          </Section>
        )}

        {has('complaints') && (
          <Section id="complaints" title={PACK_LABELS.complaints} count={complaints.length}>
            <table className="pack-t">
              <thead><tr><th>When</th><th>What happened</th><th>Evidence</th><th>What we did</th></tr></thead>
              <tbody>{complaints.map((c) => <tr key={c.id}><td>{d(c.at)} {hm(c.at)}</td><td>{c.kind}: {c.dish}{c.batch ? ` (${c.batch})` : ''}. {c.details}</td><td>{c.photos} photo{c.photos === 1 ? '' : 's'}{c.itemKept ? '; item kept' : ''}</td><td>{c.actions.join(', ')} ({c.by})</td></tr>)}</tbody>
            </table>
          </Section>
        )}

        {has('inspections') && (
          <Section id="inspections" title={PACK_LABELS.inspections} count={visits.length + notices.length}>
            <table className="pack-t"><tbody>
              {visits.map((v) => <tr key={v.id}><td>{d(v.date)}</td><td>{v.who}</td><td>{v.rating !== null ? `Rated ${v.rating}` : '—'}</td><td>{v.outcome}</td></tr>)}
              {notices.map((n) => <tr key={n.id}><td>{d(n.servedOn)}</td><td>{n.kind}</td><td>Fix by {d(n.fixBy)}</td><td>{n.title}{n.closedOn ? `; closed ${d(n.closedOn)}` : '; open'}</td></tr>)}
            </tbody></table>
          </Section>
        )}
      </div>
    </main>
  );
}
