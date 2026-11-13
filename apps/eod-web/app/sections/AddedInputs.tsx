/**
 * Inputs finance added in the report builder, shown in the section they belong to.
 * Values are saved on the report by figure id (draft.extra): pence, a fraction for %, or a count.
 */
import { addedInputs, sectionForGroup, type SectionKey } from '@maginhawa/core';
import { useDraft } from '../lib/draft';
import { CountInput, MoneyRow } from '../components/ui';

export function AddedInputs({ section }: { section: SectionKey }) {
  const { draft, definition, update } = useDraft();
  const fields = addedInputs(definition).filter((f) => sectionForGroup(f.group) === section);
  if (!fields.length) return null;
  const set = (id: string, v: number | null) => update((d) => { d.extra = { ...(d.extra ?? {}), [id]: v }; });
  return (
    <section className="grp" aria-label="Added by head office">
      <div className="gh"><h2>Added by head office</h2><p>Head office added {fields.length === 1 ? 'this' : 'these'} to the report.</p></div>
      <div className="sub">
        {fields.map((f) => {
          const v = draft.extra?.[f.id] ?? null, sub = f.help || (f.required ? undefined : 'Optional');
          if (f.type === 'money') return <MoneyRow key={f.id} label={f.name} sub={sub} value={v} onChange={(x) => set(f.id, x)} />;
          if (f.type === 'percent') {
            return (
              <label key={f.id} className="fr"><span className="tx"><span>{f.name}</span>{sub && <small>{sub}</small>}</span>
                <input className="in" inputMode="decimal" aria-label={f.name} defaultValue={v === null ? '' : String(Math.round(v * 10000) / 100)}
                  onChange={(e) => { const n = parseFloat(e.target.value.replace('%', '')); set(f.id, Number.isFinite(n) ? n / 100 : null); }} />
              </label>
            );
          }
          return <label key={f.id} className="fr"><span className="tx"><span>{f.name}</span>{sub && <small>{sub}</small>}</span><CountInput label={f.name} value={v} onChange={(x) => set(f.id, x)} /></label>;
        })}
      </div>
    </section>
  );
}

/** Figures finance added, worked out, for the review screen. */
export function AddedFigures() {
  const { result } = useDraft();
  const added = result.definition?.added ?? [];
  if (!added.length) return null;
  const text = (t: string, v: number | null) => v === null ? '—' : t === 'money' ? `£${(v / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : t === 'percent' ? `${Math.round(v * 1000) / 10}%` : t === 'yesno' ? (v ? 'Yes' : 'No') : String(v);
  return (
    <section className="grp" aria-label="Figures added by head office">
      <div className="hd"><h2>Added by head office</h2><span>v{result.definition!.version}</span></div>
      <div className="sub">
        {added.map((x) => <div key={x.id} className="fr"><span className="tx"><span>{x.name}</span></span><b>{text(x.type, x.value)}</b></div>)}
      </div>
    </section>
  );
}
