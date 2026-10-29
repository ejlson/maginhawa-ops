import { useState, type ReactNode } from 'react';
import { formatPounds, SECTION_LABELS, type NoteItem, type SectionKey } from '@maginhawa/core';
import { useDraft } from '../lib/draft';
import { BigMoney, Icon, ICONS, MoneyRow, Toggle } from '../components/ui';
import { EodPage } from '../components/EodPage';
import { AddedInputs } from './AddedInputs';

function Shell({ section, hero, children }: { section: SectionKey; hero: ReactNode; children: ReactNode }) {
  return (
    <EodPage section={section}>
      <div className="hero" role="status" aria-live="polite">{hero}</div>
      {children}
    </EodPage>
  );
}

export function DeliverySection() {
  const { draft, result, update, settings } = useDraft();
  const traded = draft.delivery.filter((e) => e.traded);
  const gross = traded.reduce((t, e) => t + (e.gross ?? 0), 0);
  const refunds = traded.filter((e) => e.refundPending).length;
  return (
    <Shell section="delivery" hero={<>
      <span className="hl">Delivery estimated net</span>
      <BigMoney value={result.deliveryNet} />
      <div className="hm">
        <span>{formatPounds(gross).replace(/\.00$/, '')}<small>Gross</small></span>
        <span>{traded.length} of {draft.delivery.length}<small>Traded</small></span>
        <span className={refunds ? 'h-warn' : ''}>{refunds}<small>Refunds pending</small></span>
      </div>
    </>}>
      <section className="grp">
        <div className="gh"><h2>Platforms</h2><p>Copy the gross from each platform's tablet or end-of-day report. Net is gross less VAT, times what each platform lets you keep.</p></div>
        {draft.delivery.map((e, i) => {
          const platform = settings.platforms.find((p) => p.id === e.platformId);
          const res = result.delivery[i];
          const name = platform?.name ?? e.platformId;
          return (
            <div className={`sub plat${e.traded ? '' : ' off'}`} key={e.platformId}>
              <div className="fr">
                <span className="av">{name.slice(0, 1)}</span>
                <span className="tx"><span>{name}</span><small>{e.traded && res ? `${formatPounds(res.net)} estimated net` : "Didn't trade today"}</small></span>
                <Toggle label={`${name} traded today`} checked={e.traded} onChange={(v) => update((d) => { d.delivery[i]!.traded = v; })} />
              </div>
              {e.traded && <>
                <MoneyRow label={`${name} gross`} value={e.gross} onChange={(v) => update((d) => { d.delivery[i]!.gross = v; })} sub={platform ? `Keeps ${platform.estimatedNetPct}% after VAT` : undefined} />
                <div className="fr"><span className="tx"><span>Refund pending</span><small>Finance will follow it up</small></span><Toggle label={`${name} refund pending`} checked={e.refundPending} onChange={(v) => update((d) => { d.delivery[i]!.refundPending = v; })} /></div>
              </>}
            </div>
          );
        })}
        <p className="note" style={{ margin: 0 }}>Each platform's share is a site setting that head office keeps up to date. The real figure arrives with the weekly statement.</p>
      </section>
      <AddedInputs section="delivery" />
    </Shell>
  );
}

/** Quick tags for what shaped the day; head office sees them next to the numbers. */
export const PROMOTION_TAGS = ['Offer', 'Event', 'Big party', 'Weather', 'Football on', 'Short-staffed', 'Closed early', 'Kitchen issue'];

export function PromotionsSection() {
  const { draft, update } = useDraft();
  const tags = draft.promotions.tags ?? [];
  return (
    <Shell section="promotions" hero={<>
      <span className="hl">Promotions &amp; other</span>
      <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1.15 }}>Anything that shaped today</span>
      <span className="hs-small">{tags.length ? tags.join(' · ') : 'Offers, events, weather, a big party'}</span>
    </>}>
      <section className="grp">
        <div className="gh"><h2>What happened?</h2><p>Tap any that apply. They're saved with today's report.</p></div>
        <div className="chips" role="group" aria-label="What happened today">
          {PROMOTION_TAGS.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={tags.includes(t)}
              onClick={() => update((d) => { const was = d.promotions.tags ?? []; d.promotions.tags = was.includes(t) ? was.filter((x) => x !== t) : [...was, t]; })}>{t}</button>
          ))}
        </div>
      </section>
      <section className="grp">
        <div className="gh"><h2>Notes</h2><p>Optional. A line or two helps head office read the numbers.</p></div>
        <textarea className="ta" aria-label="Promotions and other notes" placeholder="e.g. 2-for-1 cocktails 17:00–19:00, birthday party of 14" value={draft.promotions.notes} onChange={(e) => update((d) => { d.promotions.notes = e.target.value; })} />
        <p className="note" style={{ margin: 0 }}>Nothing unusual today? Leave it blank. Saving still marks it done.</p>
      </section>
      <AddedInputs section="promotions" />
    </Shell>
  );
}

export function WagesSection() {
  const { draft, result, update, settings } = useDraft();
  const tone = result.wageRag === 'red' ? 'h-bad' : result.wageRag === 'amber' ? 'h-warn' : 'h-ok';
  // The bar runs to 10 points past the red line, with the marker clamped to its end.
  const top = settings.wageRedPct + 10;
  const at = (pct: number) => `${Math.min(100, (pct / top) * 100)}%`;
  const room = draft.wages.wageCost === null ? null : Math.round(result.totalNet * settings.wageAmberPct / 100) - draft.wages.wageCost;
  return (
    <Shell section="wages" hero={<>
      <span className="hl">Wages as a share of net</span>
      <div className="big" style={{ gap: 10 }}>
        <b data-testid="wage-pct">{result.wagePct !== null ? `${result.wagePct}%` : '—'}</b>
        <span className={`hs-small ${result.wagePct !== null ? tone : ''}`} style={{ fontSize: 15, fontWeight: 600 }}>
          {result.wageRag === 'green' ? `Under the ${settings.wageAmberPct}% target` : result.wageRag === 'amber' ? `Between ${settings.wageAmberPct}% and ${settings.wageRedPct}%` : result.wageRag === 'red' ? `Over the ${settings.wageRedPct}% red line` : `Of ${formatPounds(result.totalNet)} net so far`}
        </span>
      </div>
      <div className="wband" aria-hidden="true">
        <span className="g" style={{ flex: settings.wageAmberPct }} /><span className="a" style={{ flex: settings.wageRedPct - settings.wageAmberPct }} /><span className="r" style={{ flex: 10 }} />
        {result.wagePct !== null && <i style={{ left: at(result.wagePct) }} />}
      </div>
      <div className="wticks" aria-hidden="true">
        <span style={{ left: 0, transform: 'none' }}>0%</span>
        <span style={{ left: at(settings.wageAmberPct) }}>{settings.wageAmberPct}%</span>
        <span style={{ left: at(settings.wageRedPct) }}>{settings.wageRedPct}%</span>
      </div>
    </>}>
      <section className="grp">
        <div className="gh"><h2>Wage cost</h2><p>Today's total from the rota, including employer NI and pension if you have them.</p></div>
        <div className="sub"><MoneyRow label="Wage cost" value={draft.wages.wageCost} onChange={(v) => update((d) => { d.wages.wageCost = v; })} /></div>
      </section>
      <AddedInputs section="wages" />
      <section className="grp">
        <div className="gh"><h2>Against today's net</h2><p>Worked out from the other sections. It updates as they change.</p></div>
        <div className="sub">
          {draft.ran.lunch && <div className="fr"><span className="muted">Lunch net</span><span>{formatPounds(result.sessions.lunch.net)}</span></div>}
          {draft.ran.dinner && <div className="fr"><span className="muted">Dinner net</span><span>{formatPounds(result.sessions.dinner.net)}</span></div>}
          {draft.ran.delivery && <div className="fr"><span className="muted">Delivery net</span><span>{formatPounds(result.deliveryNet)}</span></div>}
          <div className="fr tot"><span>Day total net</span><span>{formatPounds(result.totalNet)}</span></div>
          {room !== null && <div className="fr"><span className="muted">{room >= 0 ? `Room before ${settings.wageAmberPct}%` : `Over ${settings.wageAmberPct}% by`}</span><span>{formatPounds(Math.abs(room))}</span></div>}
        </div>
      </section>
    </Shell>
  );
}

export function TipsSection() {
  const { draft, result, update } = useDraft();
  const sc = (k: 'lunch' | 'dinner') => (draft.ran[k] ? draft.sessions[k].serviceCharge ?? 0 : 0);
  const service = sc('lunch') + sc('dinner');
  const short = (p: number) => formatPounds(p).replace(/\.00$/, '');
  return (
    <Shell section="tips" hero={<>
      <span className="hl">For the team today</span>
      <BigMoney value={service + result.tips} />
      <div className="hm">
        <span>{short(service)}<small>Service charge</small></span>
        <span>{short(draft.tips.card ?? 0)}<small>Card tips</small></span>
        <span>{short(draft.tips.cash ?? 0)}<small>Cash tips</small></span>
      </div>
    </>}>
      <section className="grp">
        <div className="gh"><h2>Service charge</h2><p>From lunch and dinner. Nothing to type here.</p></div>
        <div className="sub">
          {draft.ran.lunch && <div className="fr"><span className="muted">Lunch</span><span>{formatPounds(sc('lunch'))}</span></div>}
          {draft.ran.dinner && <div className="fr"><span className="muted">Dinner</span><span>{formatPounds(sc('dinner'))}</span></div>}
          <div className="fr tot"><span>Service charge</span><span>{formatPounds(service)}</span></div>
        </div>
      </section>
      <section className="grp">
        <div className="gh"><h2>Tips</h2><p>Card tips are on the till report. Count cash tips before they're shared.</p></div>
        <div className="sub">
          <MoneyRow label="Card tips" value={draft.tips.card} onChange={(v) => update((d) => { d.tips.card = v; })} />
          <MoneyRow label="Cash tips" value={draft.tips.cash} onChange={(v) => update((d) => { d.tips.cash = v; })} />
          <div className="fr"><span className="tx"><span>Goes to the tronc</span><small>Shared by the troncmaster</small></span><Toggle label="Tips go to the tronc" checked={draft.tips.toTronc} onChange={(v) => update((d) => { d.tips.toTronc = v; })} /></div>
        </div>
      </section>
      <AddedInputs section="tips" />
      <div className="lawnote">
        <span className="av ok"><Icon d={ICONS.check} size={17} /></span>
        <p><b>All of it goes to the team.</b> Tips and service charge are shared fairly under your written tipping policy, and this record is kept for 3 years, as the Tips Act requires.</p>
      </div>
    </Shell>
  );
}

const FEEDBACK_CATS = ['Guest', 'Staff', 'Maintenance'];
const HANDOVER_CATS = ['Stock', 'Maintenance', 'Staff', 'Bookings', 'Other'];

const CAT_ICONS: Record<string, string> = {
  Guest: ICONS.people, Staff: ICONS.people, Maintenance: ICONS.wrench, Stock: ICONS.box, Bookings: ICONS.cal, Other: ICONS.chat,
};
const PLACEHOLDERS: Record<string, string> = {
  Guest: 'e.g. Table 6 loved the new adobo', Staff: 'e.g. Jo covered the bar brilliantly', Maintenance: 'e.g. Glasswasher slow to drain',
  Stock: 'e.g. Low on limes, order arrives 10:00', Bookings: 'e.g. Party of 14 at 13:00, set menu', Other: 'Anything else the opener should know',
};

function NotesSection({ section, field, cats, intro, hero }: { section: 'feedback' | 'handover'; field: 'feedback' | 'handover'; cats: string[]; intro: string; hero: (items: NoteItem[]) => ReactNode }) {
  const { draft, update } = useDraft();
  const [cat, setCat] = useState(cats[0]!);
  const [body, setBody] = useState('');
  const [repair, setRepair] = useState(true);
  const items: NoteItem[] = draft[field];
  const add = () => {
    if (!body.trim()) return;
    update((d) => { d[field].push({ id: Math.random().toString(36).slice(2, 10), category: cat, body: body.trim(), raiseRepair: section === 'feedback' && cat === 'Maintenance' && repair }); });
    setBody('');
  };
  return (
    <Shell section={section} hero={<>
      <span className="hl">{section === 'handover' ? "For tomorrow's opener" : SECTION_LABELS[section]}</span>
      <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-.045em', lineHeight: 1 }}>{items.length} {items.length === 1 ? 'note' : 'notes'}</span>
      {hero(items)}
    </>}>
      <section className="grp">
        <div className="gh"><h2>Add a note</h2><p>{intro}</p></div>
        <div className="chips" role="radiogroup" aria-label="Category">
          {cats.map((c) => <button key={c} type="button" className="chip" role="radio" aria-checked={cat === c} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <textarea className="ta" aria-label="Note" placeholder={PLACEHOLDERS[cat]} value={body} onChange={(e) => setBody(e.target.value)} />
        {section === 'feedback' && cat === 'Maintenance' && (
          <div className="fr"><span className="tx"><span>Raise a repair job</span><small>Head office sees it straight away</small></span><Toggle label="Raise a repair job" checked={repair} onChange={setRepair} /></div>
        )}
        <button type="button" className="btn addnote" disabled={!body.trim()} onClick={add}>Add note</button>
      </section>
      <section className="grp">
        <div className="hd"><h2>Notes</h2><span>{items.length}</span></div>
        {items.length > 0 && (
          <div className="sub">
            {items.map((n) => (
              <div className="li note-li" key={n.id}>
                <span className={`av${n.category === 'Guest' ? ' link' : n.category === 'Maintenance' || n.category === 'Bookings' ? ' warn' : ''}`}><Icon d={CAT_ICONS[n.category] ?? ICONS.chat} size={17} /></span>
                <span className="tx"><span>{n.body}</span><small>{n.category}{n.raiseRepair && <span className="pill p-warn" style={{ marginLeft: 8 }}>Repair raised</span>}</small></span>
                <button type="button" className="linkbtn" aria-label={`Remove note: ${n.body}`} onClick={() => update((d) => { d[field] = d[field].filter((x) => x.id !== n.id); })}>Remove</button>
              </div>
            ))}
          </div>
        )}
        {section === 'handover' && <p className="note" style={{ margin: 0 }}>Nothing to hand over? Leave it empty. Saving still marks it done.</p>}
      </section>
    </Shell>
  );
}

export const FeedbackSection = () => (
  <NotesSection section="feedback" field="feedback" cats={FEEDBACK_CATS} intro="What guests said, how the team got on, anything that broke."
    hero={(items) => (
      <div className="hm">
        <span>{items.filter((i) => i.category === 'Guest').length}<small>Guest</small></span>
        <span>{items.filter((i) => i.category === 'Staff').length}<small>Staff</small></span>
        <span className={items.some((i) => i.raiseRepair) ? 'h-warn' : ''}>{items.filter((i) => i.raiseRepair).length}<small>Repairs raised</small></span>
      </div>
    )} />
);
export const HandoverSection = () => (
  <NotesSection section="handover" field="handover" cats={HANDOVER_CATS} intro="Anything the next person needs before service: stock, repairs, bookings, staff."
    hero={() => <span className="hs-small">The opener sees these first thing tomorrow.</span>} />
);
