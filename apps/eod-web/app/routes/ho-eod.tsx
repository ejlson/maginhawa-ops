import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router';
import { clockTime, computeDayWith, denominationLabel, findSite, formatPounds, SECTION_LABELS, SESSION_KEYS, type Pence, type SessionKey } from '@maginhawa/core';
import { previewDefinitions } from '../lib/definition';
import { formatDay } from '../lib/draft';
import { useSiteDay } from '../lib/site-timeline';
import { eodPill } from '../lib/day-status';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { BigMoney, Icon, ICONS, Nav, SECTION_ICONS } from '../components/ui';

const money = (p: Pence | null | undefined) => (p === null || p === undefined ? '—' : formatPounds(p));
const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('en-GB'));

function Line({ label, value, tone }: { label: ReactNode; value: ReactNode; tone?: 'bad' | 'warn' }) {
  return <div className="fr"><span className="muted">{label}</span><span className={tone}>{value}</span></div>;
}

function Card({ title, icon, right, children }: { title: string; icon: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="grp">
      <div className="hd"><h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon d={icon} size={18} />{title}</h2>{right && <span>{right}</span>}</div>
      <div className="sub">{children}</div>
    </section>
  );
}

/** Head office · one site's EOD for one day, read-only: the results, then every figure the manager typed in. */
export default function HeadOfficeEod() {
  const { site: code = '', date = '' } = useParams();
  const site = findSite(code);
  const day = useSiteDay(site?.code ?? '', date);
  if (!site || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return <Navigate to="/head-office" replace />;
  const dayLink = `/head-office/${code.toLowerCase()}?tab=day&date=${date}`;
  const report = day.report;
  if (!report) return <Navigate to={dayLink} replace />;

  const { draft } = report;
  // Sent reports show the server's official figures; a draft shows what the figures come to so far.
  const r = report.official ?? computeDayWith(draft, day.settings, undefined, previewDefinitions());
  const pill = eodPill(report);
  const cashDiff = (r.sessions.lunch.cash.difference ?? 0) + (r.sessions.dinner.cash.difference ?? 0);
  const wageTone = r.wageRag === 'red' ? 'h-bad' : r.wageRag === 'amber' ? 'h-warn' : 'h-ok';
  const flagged = report.issues.filter((i) => i.level !== 'block');

  const session = (k: SessionKey) => {
    const s = draft.sessions[k];
    const res = r.sessions[k];
    if (!draft.ran[k]) return <Card key={k} title={SECTION_LABELS[k]} icon={SECTION_ICONS[k]} right="Didn't run"><p className="note" style={{ margin: 0 }}>No {k} service.</p></Card>;
    const counted = Object.entries(s.cash.counted).filter(([, n]) => n > 0).sort(([a], [b]) => Number(b) - Number(a));
    return (
      <Card key={k} title={SECTION_LABELS[k]} icon={SECTION_ICONS[k]} right={money(res.net)}>
        <div className="sl"><span>Till</span></div>
        <Line label="Gross" value={money(s.gross)} />
        <Line label="Service charge" value={money(s.serviceCharge)} />
        <Line label="VAT" value={money(s.vat)} />
        <Line label="Discounts & comps" value={money(s.discounts)} />
        <div className="fr tot"><span>Net</span><span>{money(res.net)}</span></div>
        <Line label="Food" value={`${money(s.food)}${res.foodDrink.foodPct !== null ? ` · ${res.foodDrink.foodPct}%` : ''}`} />
        <Line label="Drink" value={`${money(s.drink)}${res.foodDrink.drinkPct !== null ? ` · ${res.foodDrink.drinkPct}%` : ''}`} />
        {!res.foodDrink.matches && <Line label="Food + drink vs net" value={`${money(res.foodDrink.gap)} out${s.foodDrinkConfirmed ? ' · confirmed' : ''}`} tone="warn" />}
        <div className="sl"><span>Covers</span></div>
        <Line label="Booked" value={num(s.booked)} />
        <Line label="Walk-ins" value={num(s.walkins)} />
        <Line label="Net a head" value={money(res.perHead)} />
        {s.adjustments.length > 0 && <>
          <div className="sl"><span>Discounts, comps & voids</span></div>
          {s.adjustments.map((a) => <Line key={a.id} label={`${a.kind === 'void' ? 'Void' : a.kind === 'comp' ? 'Comp' : 'Discount'} · ${a.reason}${a.note ? ` (${a.note})` : ''}`} value={money(a.amount)} />)}
        </>}
        <div className="sl"><span>Cash</span></div>
        {counted.map(([d, n]) => <Line key={d} label={`${denominationLabel(Number(d))} × ${n}`} value={formatPounds(Number(d) * n)} />)}
        <Line label="Counted" value={formatPounds(res.cash.counted)} />
        <Line label="Taken (less float)" value={formatPounds(res.cash.taken)} />
        <Line label="Cash on the till report" value={money(s.cash.tillCash)} />
        <Line label="Difference" value={res.cash.difference === null ? '—' : res.cash.difference === 0 ? 'Balanced' : `${formatPounds(Math.abs(res.cash.difference))} ${res.cash.difference < 0 ? 'short' : 'over'}`}
          tone={res.cash.status === 'short' ? 'bad' : res.cash.status === 'over' ? 'warn' : undefined} />
        {s.cash.reason && <Line label="Reason" value={`${s.cash.reason}${s.cash.note ? `: ${s.cash.note}` : ''}`} />}
      </Card>
    );
  };

  return (
    <HeadOfficeShell>
    <main className="page wide">
      <Nav back={dayLink} backLabel={`${site.name} · ${formatDay(date, { weekday: 'short', day: 'numeric', month: 'short' })}`} title="End of day" />
      <div className="body" style={{ paddingTop: 16 }}>
        <div className="hero" style={{ maxWidth: 720 }}>
          <div className="hero-row"><span className="hl">{site.name} · {formatDay(date, { weekday: 'long', day: 'numeric', month: 'long' })}</span><span className={`pill ${pill.cls}`}>{pill.text}</span></div>
          <div className="titleblock" style={{ gap: 6 }}><BigMoney value={r.totalNet} /><span className="hs-small">Net sales for the day{report.official ? '' : ' so far (not sent)'}</span></div>
          <div className="hm two">
            <span>{r.covers}<small>Covers · {r.sessions.lunch.covers} lunch, {r.sessions.dinner.covers} dinner</small></span>
            <span>{money(r.perHeadDineIn)}<small>Net a head, dine-in</small></span>
            <span>{r.wagePct !== null ? `${r.wagePct}%` : '—'}<small className={r.wagePct !== null ? wageTone : ''}>Wages</small></span>
            <span>{cashDiff === 0 ? 'Balanced' : `${formatPounds(Math.abs(cashDiff))} ${cashDiff < 0 ? 'short' : 'over'}`}<small>Cash</small></span>
          </div>
          <span className="hs-small">{report.submittedAt ? `Sent ${formatDay(report.submittedAt.slice(0, 10), { day: 'numeric', month: 'short' })} at ${clockTime(report.submittedAt)}${report.submittedBy ? ` by ${report.submittedBy}` : ''}` : 'Still being filled in at the site.'}</span>
        </div>

        {flagged.length > 0 && (
          <section className="grp" style={{ maxWidth: 720 }}>
            <div className="hd"><h2>Flagged on review</h2><span>{flagged.length}</span></div>
            <div className="sub">
              {flagged.map((i) => (
                <div className="li" key={i.code + i.section + i.title} style={{ alignItems: 'flex-start' }}>
                  <span className={`av ${i.level === 'warn' ? 'warn' : 'ok'}`}><Icon d={i.level === 'ok' ? ICONS.check : ICONS.bang} size={15} /></span>
                  <span className="tx"><span>{i.title}</span><small>{SECTION_LABELS[i.section]} · {i.detail}</small></span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="ro-grid">
          {SESSION_KEYS.map(session)}

          <Card title="Delivery" icon={SECTION_ICONS.delivery} right={draft.ran.delivery ? money(r.deliveryNet) : "Didn't run"}>
            {r.delivery.map((x) => {
              const entry = draft.delivery.find((e) => e.platformId === x.platformId);
              return <Line key={x.platformId} label={`${x.name}${x.traded ? ` · ${money(x.gross)} gross` : ''}${x.refundPending ? ' · refund pending' : ''}${entry?.note ? ` · ${entry.note}` : ''}`} value={x.traded ? money(x.net) : "Didn't trade"} />;
            })}
            <div className="fr tot"><span>Day total net</span><span>{money(r.totalNet)}</span></div>
          </Card>

          <Card title="Wages & tips" icon={SECTION_ICONS.wages} right={r.wagePct !== null ? `${r.wagePct}%` : undefined}>
            <Line label="Wage cost" value={money(draft.wages.wageCost)} />
            <Line label="Wages as % of net" value={r.wagePct !== null ? `${r.wagePct}%` : '—'} tone={r.wageRag === 'red' ? 'bad' : r.wageRag === 'amber' ? 'warn' : undefined} />
            <Line label="Card tips & service" value={money(draft.tips.card)} />
            <Line label="Cash tips" value={money(draft.tips.cash)} />
            <Line label="Goes to the tronc" value={draft.tips.toTronc ? 'Yes' : 'No'} />
          </Card>

          <Card title="Notes" icon={ICONS.chat}>
            {draft.promotions.notes || draft.promotions.tags?.length
              ? <Line label="Promotions & other" value={[draft.promotions.tags?.join(', '), draft.promotions.notes].filter(Boolean).join(' · ')} />
              : null}
            <div className="sl"><span>Feedback</span></div>
            {draft.feedback.length ? draft.feedback.map((f) => <Line key={f.id} label={f.category} value={`${f.body}${f.raiseRepair ? ' · repair raised' : ''}`} />) : <p className="note" style={{ margin: 0 }}>None.</p>}
            <div className="sl"><span>Handover</span></div>
            {draft.handover.length ? draft.handover.map((h) => <Line key={h.id} label={h.category} value={h.body} />) : <p className="note" style={{ margin: 0 }}>None.</p>}
          </Card>
        </div>
        {day.example && <div className="banner" role="note"><Icon d={ICONS.bang} size={16} /><span>Example data. Every figure and note here is made up.</span></div>}
      </div>
    </main>
    </HeadOfficeShell>
  );
}
