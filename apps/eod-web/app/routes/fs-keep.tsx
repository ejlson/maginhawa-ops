import { useState } from 'react';
import { DEFAULT_KEEP, keepText, RECORD_LABELS, RECORD_TYPES, type KeepPolicy, type RecordType } from '@maginhawa/core';
import { useFoodSafety } from '../lib/food-safety';
import { Foot, Icon, Nav } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

const CHOICES = [6, 12, 24, 36, 72];

/** How long each kind of record is kept (HANDOFF.md §8a, item 3). Head office only; nothing is cleared without a yes. */
export default function FsKeep() {
  const { data, setKeep } = useFoodSafety();
  const [draft, setDraft] = useState<KeepPolicy>(data.keep);
  const [open, setOpen] = useState<RecordType | null>(null);
  const [saved, setSaved] = useState(false);
  const changed = JSON.stringify(draft) !== JSON.stringify(data.keep);
  const shortest = Math.min(...RECORD_TYPES.filter((t) => t !== 'fitness').map((t) => draft[t].months));

  return (
    <main className="page">
      <Nav back="/food-safety" backLabel="Food safety" title="Keeping records" />
      <div className="body form">
        <div className="hero">
          <span className="hl">Food-safety records kept for at least</span>
          <div className="big"><b>{shortest % 12 === 0 ? shortest / 12 : shortest}</b><i>&nbsp;{shortest % 12 === 0 ? (shortest === 12 ? 'year' : 'years') : 'months'}</i></div>
          <div className="hm"><span>{RECORD_TYPES.length}<small>Kinds of record</small></span><span>Never<small>Cleared without a yes</small></span><span>SharePoint<small>Kept in</small></span></div>
        </div>
        <section className="grp">
          <div className="hd"><h2>By kind of record</h2><span>Tap to change</span></div>
          <div className="sub">
            {RECORD_TYPES.map((t) => (
              <div key={t}>
                <button type="button" className="li" aria-expanded={open === t} onClick={() => setOpen(open === t ? null : t)}>
                  <span className="tx"><span>{RECORD_LABELS[t].title}</span>{RECORD_LABELS[t].sub && <small>{RECORD_LABELS[t].sub}</small>}</span>
                  <span className="rt"><span className="amt">{keepText(draft[t])}</span>{draft[t].months !== DEFAULT_KEEP[t].months && <span className="pill p-warn">Changed</span>}</span>
                </button>
                {open === t && (
                  <div className="chips" role="radiogroup" aria-label={`Keep ${RECORD_LABELS[t].title}`} style={{ padding: '4px 0 14px' }}>
                    {CHOICES.map((m) => <button key={m} type="button" role="radio" className="chip" aria-checked={draft[t].months === m} aria-pressed={draft[t].months === m} onClick={() => { setDraft({ ...draft, [t]: { ...draft[t], months: m } }); setSaved(false); }}>{keepText({ months: m })}{m === DEFAULT_KEEP[t].months ? ' · suggested' : ''}</button>)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="note">There's no fixed legal period for food-safety records. These are suggestions to check with your environmental health officer. Fit-to-work answers are health data, so UK GDPR says keep them no longer than needed.</p>
        </section>
        {saved && <div className="banner" role="status"><Icon d={ICONS.check} size={16} /><span>Saved. Records past their date are listed for head office to approve; nothing is cleared automatically.</span></div>}
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={!changed} onClick={() => { setKeep(draft); setSaved(true); }}>Save keep periods</button>
      </Foot>
    </main>
  );
}
