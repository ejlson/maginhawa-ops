import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { COINS, countedTotal, denominationLabel, formatPounds, NOTES, SECTION_LABELS } from '@maginhawa/core';
import { useDraft } from '../lib/draft';
import { BigMoney, CountInput, Icon } from '../components/ui';
import { ICONS } from '../components/ui-helpers';
import { useAuth } from '../lib/auth';
import { tour } from '../lib/tour';
import { FirstTimeTip } from '../components/Tour';

/** Count the cash: only the notes and coins actually in the drawer. */
export default function CashCount() {
  const { session } = useParams();
  const { draft, update, settings } = useDraft();
  const { user } = useAuth();
  const valid = session === 'lunch' || session === 'dinner';
  // Opens on the picker when nothing has been counted yet.
  const [picker, setPicker] = useState(() => !valid || Object.keys(draft.sessions[session].cash.counted).length === 0);
  // Denominations added but not yet counted stay on screen until removed.
  const [pending, setPending] = useState<number[]>([]);
  if (!valid) return <Navigate to="/close" replace />;

  const counted = draft.sessions[session].cash.counted;
  const used = (p: number) => p in counted || pending.includes(p);
  const total = countedTotal(counted);

  const setCount = (p: number, n: number | null) => {
    update((d) => {
      const c = d.sessions[session].cash.counted;
      if (n === null) delete c[String(p)]; else c[String(p)] = n;
    });
    if (n === null && !pending.includes(p)) setPending((x) => [...x, p]);
    if (n !== null) setPending((x) => x.filter((y) => y !== p));
    if (n !== null && user) tour.did(user, 'cash');
  };
  const remove = (p: number) => {
    update((d) => { delete d.sessions[session].cash.counted[String(p)]; });
    setPending((x) => x.filter((y) => y !== p));
  };
  const add = (p: number) => setPending((x) => [...x, p]);

  const rows = (list: number[], title: string) => {
    const mine = list.filter(used);
    if (!mine.length) return null;
    const sub = mine.reduce((s, p) => s + p * (counted[String(p)] ?? 0), 0);
    return (
      <div className="sub">
        <div className="hd" style={{ paddingTop: 8 }}><span style={{ fontWeight: 600, color: 'var(--text)' }}>{title}</span><span>{formatPounds(sub)}</span></div>
        {mine.map((p) => {
          const n = counted[String(p)] ?? null;
          return (
            <label className="dr" key={p}>
              <span className="av">{denominationLabel(p)}</span>
              <span className="x">×</span>
              <CountInput className="in short" label={`Number of ${denominationLabel(p)}`} value={n} onChange={(v) => setCount(p, v)} />
              {n === null
                ? <button type="button" className="linkbtn" style={{ width: 88, textAlign: 'right' }} onClick={() => remove(p)}>Remove</button>
                : <span className="lt">{formatPounds(p * n)}</span>}
            </label>
          );
        })}
      </div>
    );
  };

  const freeNotes = NOTES.filter((p) => !used(p));
  const freeCoins = COINS.filter((p) => !used(p));
  const label = SECTION_LABELS[session];

  return (
    <main className="page">
      <header className="nav" style={{ paddingLeft: 20 }}>
        <Link to={`/close/${session}`} style={{ textDecoration: 'none' }}>Cancel</Link>
        <span className="title">Count the cash</span>
        <Link to={`/close/${session}`} style={{ textDecoration: 'none', fontWeight: 600 }}>Done</Link>
      </header>
      <div className="body" style={{ gap: 32 }}>
        <FirstTimeTip id="cash" title="First time counting?">Add the notes and coins in the drawer and type how many of each. We add it up and take off the {formatPounds(settings.float)} float.</FirstTimeTip>
        <div className="hero" role="status" aria-live="polite">
          <span className="hl">{label} · in the drawer</span>
          <BigMoney value={total} />
          <div className="hero-row" style={{ paddingTop: 12, borderTop: '.5px solid var(--heroline)', fontSize: 15 }}>
            <span className="hl">Less {formatPounds(settings.float)} float</span><span style={{ fontWeight: 600 }} data-testid="taken">{formatPounds(total - settings.float)} taken</span>
          </div>
        </div>
        <section className="grp" style={{ gap: 12 }}>
          <div className="hd"><h2>What you counted</h2><span>{Object.keys(counted).length + pending.length} types</span></div>
          {Object.keys(counted).length === 0 && pending.length === 0 && <p className="note" style={{ margin: 0, fontSize: 15 }}>Add the notes and coins you have. Skip any you don't.</p>}
          {rows(NOTES, 'Notes')}
          {rows(COINS, 'Coins')}
        </section>
        <section className="grp" style={{ gap: 12 }}>
          {picker ? (
            <div className="panel">
              <div className="hd"><span style={{ fontWeight: 600, color: 'var(--text)' }}>Tap to add</span><button type="button" className="linkbtn" onClick={() => setPicker(false)}>Done</button></div>
              {freeNotes.length > 0 && <div className="sub" style={{ gap: 8 }}><span className="sl">Notes</span><div className="chips">{freeNotes.map((p) => <button key={p} type="button" className="chip" onClick={() => add(p)}>{denominationLabel(p)}</button>)}</div></div>}
              {freeCoins.length > 0 && <div className="sub" style={{ gap: 8 }}><span className="sl">Coins</span><div className="chips">{freeCoins.map((p) => <button key={p} type="button" className="chip" onClick={() => add(p)}>{denominationLabel(p)}</button>)}</div></div>}
            </div>
          ) : (
            <button type="button" className="li" style={{ color: 'var(--link)', fontWeight: 500 }} onClick={() => setPicker(true)}>
              <span className="av dash"><Icon d={ICONS.plus} size={16} /></span><span className="tx">Add a note or coin</span>
            </button>
          )}
          <p className="note" style={{ margin: 0 }}>Only add what's in the drawer. Done takes the total back to {label}.</p>
        </section>
      </div>
    </main>
  );
}
