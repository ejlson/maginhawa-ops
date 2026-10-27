import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { formatPounds, SECTION_LABELS, type NoteItem, type SectionKey } from '@maginhawa/core';
import { useDraft } from '../lib/draft';
import { BigMoney, Foot, Icon, ICONS, MoneyRow, Nav, Toggle } from '../components/ui';

function Shell({ section, hero, children }: { section: SectionKey; hero: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  const { update } = useDraft();
  const label = SECTION_LABELS[section];
  return (
    <main className="page">
      <Nav back="/close" title={label} right={<span className="saved"><span className="dot" />Saved</span>} />
      <div className="body form">
        <div className="hero" role="status" aria-live="polite">{hero}</div>
        {children}
      </div>
      <Foot>
        <button type="button" className="btn b1" onClick={() => { update((d) => { d.completed[section] = true; }); navigate('/close'); }}>Save {label.toLowerCase()}</button>
      </Foot>
    </main>
  );
}

export function DeliverySection() {
  const { draft, result, update, settings } = useDraft();
  return (
    <Shell section="delivery" hero={<>
      <span className="hl">Delivery estimated net</span>
      <BigMoney value={result.deliveryNet} />
      <span className="hs-small">Gross less VAT, times each platform's share</span>
    </>}>
      <section className="grp">
        <div className="gh"><h2>Platforms</h2><p>Copy the gross from each platform's tablet or report.</p></div>
        {draft.delivery.map((e, i) => {
          const platform = settings.platforms.find((p) => p.id === e.platformId);
          const res = result.delivery[i];
          const name = platform?.name ?? e.platformId;
          return (
            <div className="sub" key={e.platformId}>
              <div className="sl"><span>{name}</span><span>{e.traded && res ? `${formatPounds(res.net)} est. net` : "Didn't trade"}</span></div>
              <div className="fr"><span>Traded today</span><Toggle label={`${name} traded today`} checked={e.traded} onChange={(v) => update((d) => { d.delivery[i]!.traded = v; })} /></div>
              {e.traded && <>
                <MoneyRow label={`${name} gross`} value={e.gross} onChange={(v) => update((d) => { d.delivery[i]!.gross = v; })} sub={platform ? `Keeps ${platform.estimatedNetPct}% after VAT` : undefined} />
                <div className="fr"><span className="tx"><span>Refund pending</span><small>Finance will follow it up</small></span><Toggle label={`${name} refund pending`} checked={e.refundPending} onChange={(v) => update((d) => { d.delivery[i]!.refundPending = v; })} /></div>
              </>}
            </div>
          );
        })}
      </section>
    </Shell>
  );
}

export function PromotionsSection() {
  const { draft, update } = useDraft();
  return (
    <Shell section="promotions" hero={<><span className="hl">Promotions &amp; other</span><span style={{ fontSize: 22, fontWeight: 600 }}>Anything that shaped today</span><span className="hs-small">Offers, events, weather, a big party</span></>}>
      <section className="grp">
        <div className="gh"><h2>Notes</h2><p>Optional. It helps head office read the numbers.</p></div>
        <textarea className="ta" aria-label="Promotions and other notes" placeholder="e.g. 2-for-1 cocktails 17:00–19:00, birthday party of 14" value={draft.promotions.notes} onChange={(e) => update((d) => { d.promotions.notes = e.target.value; })} />
      </section>
    </Shell>
  );
}

export function WagesSection() {
  const { draft, result, update, settings } = useDraft();
  const tone = result.wageRag === 'red' ? 'h-bad' : result.wageRag === 'amber' ? 'h-warn' : 'h-ok';
  return (
    <Shell section="wages" hero={<>
      <span className="hl">Wages as a share of net</span>
      <div className="big"><b data-testid="wage-pct">{result.wagePct !== null ? `${result.wagePct}%` : '—'}</b></div>
      <span className={`hs-small ${result.wagePct !== null ? tone : ''}`}>
        {result.wageRag === 'green' ? `Under the ${settings.wageAmberPct}% target` : result.wageRag === 'amber' ? `Between ${settings.wageAmberPct}% and ${settings.wageRedPct}%` : result.wageRag === 'red' ? `Over the ${settings.wageRedPct}% red line` : `Of ${formatPounds(result.totalNet)} net so far`}
      </span>
    </>}>
      <section className="grp">
        <div className="gh"><h2>Wage cost</h2><p>Today's total from the rota, including on-costs if you have them.</p></div>
        <div className="sub"><MoneyRow label="Wage cost" value={draft.wages.wageCost} onChange={(v) => update((d) => { d.wages.wageCost = v; })} /></div>
      </section>
    </Shell>
  );
}

export function TipsSection() {
  const { draft, result, update } = useDraft();
  return (
    <Shell section="tips" hero={<><span className="hl">Tips today</span><BigMoney value={result.tips} /><span className="hs-small">Kept for 3 years, as the Tips Act requires</span></>}>
      <section className="grp">
        <div className="gh"><h2>Tips &amp; service charge</h2><p>All tips go to staff, shared under your written tipping policy.</p></div>
        <div className="sub">
          <MoneyRow label="Card tips" value={draft.tips.card} onChange={(v) => update((d) => { d.tips.card = v; })} />
          <MoneyRow label="Cash tips" value={draft.tips.cash} onChange={(v) => update((d) => { d.tips.cash = v; })} />
          <div className="fr"><span className="tx"><span>Goes to the tronc</span><small>Shared by the troncmaster</small></span><Toggle label="Tips go to the tronc" checked={draft.tips.toTronc} onChange={(v) => update((d) => { d.tips.toTronc = v; })} /></div>
        </div>
      </section>
    </Shell>
  );
}

const FEEDBACK_CATS = ['Guest', 'Staff', 'Maintenance'];
const HANDOVER_CATS = ['Stock', 'Maintenance', 'Staff', 'Bookings', 'Other'];

function NotesSection({ section, field, cats, intro }: { section: 'feedback' | 'handover'; field: 'feedback' | 'handover'; cats: string[]; intro: string }) {
  const { draft, update } = useDraft();
  const [cat, setCat] = useState(cats[0]!);
  const [body, setBody] = useState('');
  const [repair, setRepair] = useState(false);
  const items: NoteItem[] = draft[field];
  const add = () => {
    if (!body.trim()) return;
    update((d) => { d[field].push({ id: Math.random().toString(36).slice(2, 10), category: cat, body: body.trim(), raiseRepair: section === 'feedback' && cat === 'Maintenance' && repair }); });
    setBody(''); setRepair(false);
  };
  return (
    <Shell section={section} hero={<><span className="hl">{SECTION_LABELS[section]}</span><span style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-.04em' }}>{items.length} {items.length === 1 ? 'note' : 'notes'}</span><span className="hs-small">{intro}</span></>}>
      <section className="grp">
        <div className="gh"><h2>Add a note</h2></div>
        <div className="panel">
          <div className="chips" role="radiogroup" aria-label="Category">
            {cats.map((c) => <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
          </div>
          <textarea className="ta" aria-label="Note" placeholder={section === 'handover' ? 'e.g. Low on limes, order arrives 10:00' : 'e.g. Table 6 loved the new adobo'} value={body} onChange={(e) => setBody(e.target.value)} />
          {section === 'feedback' && cat === 'Maintenance' && (
            <div className="fr"><span className="tx"><span>Raise a repair job</span><small>Head office sees it straight away</small></span><Toggle label="Raise a repair job" checked={repair} onChange={setRepair} /></div>
          )}
          <button type="button" className="btn b1" style={{ height: 46 }} disabled={!body.trim()} onClick={add}>Add note</button>
        </div>
      </section>
      {items.length > 0 && (
        <section className="grp">
          <div className="hd"><h2>Notes</h2><span>{items.length}</span></div>
          <div className="sub">
            {items.map((n) => (
              <div className="li" key={n.id}>
                <span className={`av ${n.raiseRepair ? 'warn' : ''}`}><Icon d={n.category === 'Maintenance' ? ICONS.wrench : ICONS.chat} size={17} /></span>
                <span className="tx"><span>{n.body}</span><small>{n.category}{n.raiseRepair ? ' · repair raised' : ''}</small></span>
                <button type="button" className="linkbtn" aria-label={`Remove note: ${n.body}`} onClick={() => update((d) => { d[field] = d[field].filter((x) => x.id !== n.id); })}>Remove</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </Shell>
  );
}

export const FeedbackSection = () => <NotesSection section="feedback" field="feedback" cats={FEEDBACK_CATS} intro="Guests, staff and anything broken" />;
export const HandoverSection = () => <NotesSection section="handover" field="handover" cats={HANDOVER_CATS} intro="What tomorrow's opener needs to know" />;
