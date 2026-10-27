import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CASH_REASONS, formatPounds, SECTION_LABELS, type AdjustmentLine, type SessionKey } from '@maginhawa/core';
import { useDraft } from '../lib/draft';
import { BigMoney, Chevron, CountInput, Foot, Icon, ICONS, MoneyInput, MoneyRow, Nav } from '../components/ui';

const ADJ_REASONS: Record<AdjustmentLine['kind'], string[]> = {
  discount: ['Staff meal 20%', 'Regulars 10%', 'Manager discount', 'Promotion'],
  comp: ['Customer complaint', 'Wrong order', 'Long wait', 'Birthday'],
  void: ['Rung in by mistake', 'Customer changed mind', 'Out of stock'],
};

const newId = () => Math.random().toString(36).slice(2, 10);

export function SessionSection({ session }: { session: SessionKey }) {
  const navigate = useNavigate();
  const { draft, result, update, settings } = useDraft();
  const s = draft.sessions[session];
  const r = result.sessions[session];
  const label = SECTION_LABELS[session];
  const set = (change: (x: typeof s) => void) => update((d) => change(d.sessions[session]));

  const [adding, setAdding] = useState<null | { kind: AdjustmentLine['kind']; reason: string; amount: number | null; note: string }>(null);

  const cashPill = r.cash.status === 'balanced' ? ['p-ok', 'Balanced']
    : r.cash.status === 'short' ? ['p-warn', `${formatPounds(Math.abs(r.cash.difference ?? 0))} short`]
    : r.cash.status === 'over' ? ['p-warn', `${formatPounds(Math.abs(r.cash.difference ?? 0))} over`]
    : ['p-mut', 'Not counted'];
  const gap = r.adjustments.gap;

  return (
    <main className="page">
      <Nav back="/close" title={label} right={<span className="saved"><span className="dot" />Saved</span>} />
      <div className="body form">
        <div className="hero" role="status" aria-live="polite">
          <div className="hero-row"><span className="hl">{label} net sales</span></div>
          <BigMoney value={r.net} />
          <div className="hm">
            <span>{formatPounds(s.gross ?? 0).replace(/\.\d\d$/, '')}<small>Gross</small></span>
            <span>{r.covers}<small>Covers</small></span>
            <span>{r.perHead !== null ? formatPounds(r.perHead) : '—'}<small>A head</small></span>
          </div>
        </div>

        <section className="grp">
          <div className="gh"><h2>Sales</h2><p>Copy these from the end-of-service report. Net works itself out.</p></div>
          <div className="sub">
            <div className="sl"><span>From the till</span></div>
            <MoneyRow label="Gross sales" value={s.gross} onChange={(v) => set((x) => { x.gross = v; })} />
            <MoneyRow label="Service charge" value={s.serviceCharge} onChange={(v) => set((x) => { x.serviceCharge = v; })} />
            <MoneyRow label="VAT" value={s.vat} onChange={(v) => set((x) => { x.vat = v; })} />
            <MoneyRow label="Discounts & comps" value={s.discounts} onChange={(v) => set((x) => { x.discounts = v; })} />
            <div className="fr tot"><span>Net sales</span><span data-testid="net">{formatPounds(r.net)}</span></div>
          </div>

          <div className="sub">
            <div className="sl"><span>Food &amp; drink</span><span>{r.foodDrink.foodPct !== null ? `${r.foodDrink.foodPct}% food` : ''}</span></div>
            <MoneyRow label="Food" value={s.food} onChange={(v) => set((x) => { x.food = v; x.foodDrinkConfirmed = false; })} />
            <MoneyRow label="Drink" value={s.drink} onChange={(v) => set((x) => { x.drink = v; x.foodDrinkConfirmed = false; })} />
            {(s.food !== null || s.drink !== null) && (r.foodDrink.matches
              ? <div className="fr"><span className="muted">Adds up to net sales</span><span className="pill p-ok"><Icon d={ICONS.check} size={11} />Matches</span></div>
              : r.foodDrink.needsCheck
                ? (
                  <div className="blk">
                    <span className="pill p-warn" style={{ alignSelf: 'flex-start' }}>{formatPounds(Math.abs(r.foodDrink.gap))} {r.foodDrink.gap > 0 ? 'over' : 'under'} net</span>
                    <span className="note" style={{ margin: 0, fontSize: 15 }}>Food and drink usually add up to net sales. Check the till report, or confirm it's right.</span>
                    <button type="button" className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => set((x) => { x.foodDrinkConfirmed = true; })}>It's right</button>
                  </div>
                )
                : <div className="fr"><span className="muted">Confirmed by you</span><span className="pill p-mut">{formatPounds(Math.abs(r.foodDrink.gap))} {r.foodDrink.gap > 0 ? 'over' : 'under'} net</span></div>
            )}
          </div>

          <div className="sub">
            <div className="sl"><span>Discount &amp; comp lines</span><span>{formatPounds(r.adjustments.listed)} of {formatPounds(s.discounts ?? 0)}</span></div>
            {s.adjustments.map((a) => (
              <div className="li" key={a.id}>
                <span className={`av ${a.kind === 'comp' ? 'warn' : ''}`} style={a.kind === 'discount' ? { background: 'rgba(0,113,227,.12)', color: 'var(--link)' } : undefined}>
                  {a.kind === 'discount' ? '%' : a.kind === 'comp' ? <Icon d={ICONS.chat} size={17} /> : '×'}
                </span>
                <span className="tx"><span>{a.reason}</span><small>{a.kind[0]!.toUpperCase() + a.kind.slice(1)}{a.note ? ` · ${a.note}` : ''}</small></span>
                <span className="amt">{formatPounds(a.amount ?? 0)}</span>
                <button type="button" className="linkbtn" aria-label={`Remove ${a.reason}`} onClick={() => set((x) => { x.adjustments = x.adjustments.filter((y) => y.id !== a.id); })}>Remove</button>
              </div>
            ))}
            {adding ? (
              <div className="panel" style={{ marginTop: 8 }}>
                <div className="chips" role="radiogroup" aria-label="Kind">
                  {(['discount', 'comp', 'void'] as const).map((k) => (
                    <button key={k} type="button" className="chip" aria-pressed={adding.kind === k} onClick={() => setAdding({ ...adding, kind: k, reason: '' })}>{k[0]!.toUpperCase() + k.slice(1)}</button>
                  ))}
                </div>
                <div className="chips" role="radiogroup" aria-label="Reason">
                  {ADJ_REASONS[adding.kind].map((reason) => (
                    <button key={reason} type="button" className="chip" aria-pressed={adding.reason === reason} onClick={() => setAdding({ ...adding, reason })}>{reason}</button>
                  ))}
                </div>
                <label className="fr"><span>Amount</span><MoneyInput label="Line amount" value={adding.amount} onChange={(v) => setAdding({ ...adding, amount: v })} /></label>
                <input className="in wide" placeholder="Note (optional), e.g. table 12" value={adding.note} onChange={(e) => setAdding({ ...adding, note: e.target.value })} aria-label="Line note" />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn b1" style={{ height: 44 }} disabled={!adding.reason || !adding.amount}
                    onClick={() => { set((x) => { x.adjustments.push({ id: newId(), kind: adding.kind, reason: adding.reason, amount: adding.amount, note: adding.note }); }); setAdding(null); }}>Add line</button>
                  <button type="button" className="btn b2" onClick={() => setAdding(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" className="li" style={{ color: 'var(--link)', fontWeight: 500 }} onClick={() => setAdding({ kind: 'discount', reason: '', amount: null, note: '' })}>
                <span className="av dash"><Icon d={ICONS.plus} size={16} /></span><span className="tx">Add discount, comp or void</span>
              </button>
            )}
            {(s.discounts ?? 0) > 0 && (
              <div className="fr"><span className="muted" style={{ fontSize: 15 }}>Lines vs till total</span>
                <span className={`pill ${gap === 0 ? 'p-ok' : 'p-warn'}`}>{gap === 0 ? 'Matches' : gap > 0 ? `${formatPounds(gap)} still to list` : `${formatPounds(-gap)} too much listed`}</span>
              </div>
            )}
          </div>
        </section>

        <section className="grp">
          <div className="gh"><h2>Covers</h2></div>
          <div className="sub">
            <div className="sl"><span>Guests</span><span>{r.covers} total</span></div>
            <label className="fr"><span>Booked</span><CountInput label="Booked covers" value={s.booked} onChange={(v) => set((x) => { x.booked = v; })} /></label>
            <label className="fr"><span>Walk-ins</span><CountInput label="Walk-in covers" value={s.walkins} onChange={(v) => set((x) => { x.walkins = v; })} /></label>
          </div>
        </section>

        <section className="grp">
          <div className="gh"><h2>Cash</h2><p>Count the drawer, then copy the cash figure from the till report. Within {formatPounds(settings.cashTolerance)} counts as balanced.</p></div>
          <div className="sub">
            <Link className="li" to={`/close/${session}/cash`}>
              <span className="av"><Icon d={ICONS.cash} /></span>
              <span className="tx"><span>Counted in drawer</span><small>{Object.keys(s.cash.counted).length ? `${formatPounds(r.cash.taken)} after the ${formatPounds(settings.float)} float` : 'Tap to count notes and coins'}</small></span>
              <span className="amt">{formatPounds(r.cash.counted)}</span><Chevron />
            </Link>
            <MoneyRow label="Till says" value={s.cash.tillCash} onChange={(v) => set((x) => { x.cash.tillCash = v; })} />
            <div className="fr tot" role="status" aria-live="polite"><span>Difference</span><span className={`pill ${cashPill[0]}`} data-testid="cash-status">{cashPill[1]}</span></div>
          </div>
          {r.cash.status !== 'balanced' && r.cash.status !== 'not-started' && (
            <div className="sub" style={{ gap: 12 }}>
              <div className="sl"><span>What happened?</span><span>{s.cash.reason ? '' : 'Needed to submit'}</span></div>
              <div className="chips" role="radiogroup" aria-label="Reason for the cash difference">
                {CASH_REASONS.map((reason) => (
                  <button key={reason} type="button" className="chip" aria-pressed={s.cash.reason === reason} onClick={() => set((x) => { x.cash.reason = reason; })}>{reason}</button>
                ))}
              </div>
              <textarea className="ta" placeholder="Add a note (optional), e.g. table 4" aria-label="Note about the cash difference" value={s.cash.note} onChange={(e) => set((x) => { x.cash.note = e.target.value; })} />
            </div>
          )}
        </section>
      </div>
      <Foot>
        <button type="button" className="btn b1" onClick={() => { update((d) => { d.completed[session] = true; }); navigate('/close'); }}>Save {label.toLowerCase()}</button>
      </Foot>
    </main>
  );
}
