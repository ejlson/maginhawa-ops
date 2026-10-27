/** One checklist question and its answer control: used when doing a list and in the builder's preview. */
import { useEffect, useRef, useState } from 'react';
import { evaluate, ruleText, type AnswerValue, type Checkpoint } from '@maginhawa/core';
import { Icon } from './ui';

/** Downscales a photo to keep it small enough to store on the device. */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 480 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const parseNumber = (t: string) => {
  const n = parseFloat(t.replace('−', '-').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

function NumberAnswer({ c, value, onChange, invalid, disabled }: { c: Checkpoint; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void; invalid: boolean; disabled: boolean }) {
  const [text, setText] = useState(typeof value === 'number' ? String(value) : '');
  const [editing, setEditing] = useState(false);
  // Someone else answered on another device: show it, unless this person is typing here.
  useEffect(() => {
    const v = typeof value === 'number' ? value : null;
    if (!editing && parseNumber(text) !== v) setText(v === null ? '' : String(v));
  }, [value, editing]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input className={`in${invalid ? ' bad' : ''}`} style={{ width: 104 }} type="text" inputMode="decimal" disabled={disabled}
      aria-label={c.title} placeholder={c.type === 'temp' ? '°C' : c.unit ?? ''} value={text}
      onFocus={() => setEditing(true)} onBlur={() => setEditing(false)}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNumber(e.target.value));
      }} />
  );
}

function SignaturePad({ value, onChange, disabled }: { value: AnswerValue | undefined; onChange: (v: AnswerValue) => void; disabled: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const ctx = () => ref.current?.getContext('2d') ?? null;
  useEffect(() => {
    const c = ctx();
    if (!c || typeof value !== 'string' || !value.startsWith('data:')) return;
    const img = new Image(); img.onload = () => c.drawImage(img, 0, 0); img.src = value;
  }, []); // eslint-disable-line
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * e.currentTarget.width, ((e.clientY - r.top) / r.height) * e.currentTarget.height] as const;
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <canvas ref={ref} width={600} height={160} aria-label="Sign here with your finger"
        style={{ width: '100%', height: 96, borderRadius: 14, border: '1.5px dashed var(--sep)', touchAction: 'none', background: 'var(--bg)', opacity: disabled ? .6 : 1 }}
        onPointerDown={(e) => { if (disabled) return; const c = ctx(); if (!c) return; drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); const [x, y] = point(e); c.lineWidth = 3; c.lineCap = 'round'; c.strokeStyle = getComputedStyle(document.body).color; c.beginPath(); c.moveTo(x, y); }}
        onPointerMove={(e) => { if (!drawing.current) return; const c = ctx(); if (!c) return; const [x, y] = point(e); c.lineTo(x, y); c.stroke(); }}
        onPointerUp={() => { drawing.current = false; if (ref.current) onChange(ref.current.toDataURL('image/png')); }} />
      {!disabled && <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => { const c = ctx(); if (c && ref.current) c.clearRect(0, 0, ref.current.width, ref.current.height); onChange(null); }}>{value ? 'Clear signature' : 'Sign with your finger'}</button>}
    </div>
  );
}

export function Answer({ c, value, set, today, disabled }: { c: Checkpoint; value: AnswerValue | undefined; set: (v: AnswerValue) => void; today: string; disabled: boolean }) {
  const e = evaluate(c, value, today);
  const rule = ruleText(c);
  const sub = [c.help, rule].filter(Boolean).join(' · ');
  const status = e.passed === false ? <span className="pill p-bad">{c.type === 'temp' ? (e.reason.startsWith('Too cold') ? 'Too cold' : 'Too warm') : 'Fails'}</span>
    : e.passed === true ? <span className="pill p-ok">OK</span> : null;
  const head = <span className="tx"><span>{c.title}{!c.required && <span className="muted" style={{ fontSize: 14 }}> · optional</span>}</span>{sub && <small>{sub}</small>}</span>;

  switch (c.type) {
    case 'yesno':
      return (
        <div className="fr">{head}
          <span className="chips" role="radiogroup" aria-label={c.title}>
            {([['Yes', true], ['No', false]] as const).map(([l, v]) => (
              <button key={l} type="button" className="chip" disabled={disabled} aria-pressed={value === v}
                style={value === v && e.passed === false ? { background: 'var(--bad)', color: '#fff' } : undefined} onClick={() => set(v)}>{l}</button>
            ))}
          </span>
        </div>
      );
    case 'temp':
    case 'number':
      return <label className="fr">{head}<span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{status}<NumberAnswer c={c} value={value} onChange={set} invalid={e.passed === false} disabled={disabled} /></span></label>;
    case 'date':
      return <label className="fr">{head}<span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{status}<input className={`in${e.passed === false ? ' bad' : ''}`} style={{ width: 160 }} type="date" aria-label={c.title} disabled={disabled} value={typeof value === 'string' ? value : ''} onChange={(ev) => set(ev.target.value || null)} /></span></label>;
    case 'text':
      return <div className="blk">{head}<textarea className="ta" aria-label={c.title} disabled={disabled} placeholder="Type here" value={typeof value === 'string' ? value : ''} onChange={(ev) => set(ev.target.value)} /></div>;
    case 'choice': {
      const picked = Array.isArray(value) ? value : [];
      return (
        <div className="blk">{head}
          <div className="chips" role={c.multi ? 'group' : 'radiogroup'} aria-label={c.title}>
            {(c.options ?? []).map((o, i) => (
              <button key={`${i}:${o}`} type="button" className="chip" disabled={disabled} aria-pressed={picked.includes(o)}
                onClick={() => set(c.multi ? (picked.includes(o) ? picked.filter((x) => x !== o) : [...picked, o]) : [o])}>{o}</button>
            ))}
          </div>
        </div>
      );
    }
    case 'photo': {
      const photos = Array.isArray(value) ? value : [];
      return (
        <div className="blk">{head}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {photos.map((src, i) => <img key={i} src={src} alt={`${c.title} ${i + 1}`} style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 14 }} />)}
            {!disabled && (
              <label style={{ width: 84, height: 84, borderRadius: 14, border: '1.5px dashed var(--sep)', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', color: 'var(--link)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Icon d="M2 6h3l1.5-2h5L13 6h3v9H2zM9 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />{photos.length ? 'Retake' : 'Take photo'}
                <input type="file" accept="image/*" capture="environment" aria-label={`Take a photo: ${c.title}`} style={{ display: 'none' }}
                  onChange={async (ev) => { const f = ev.target.files?.[0]; if (f) set([await shrinkPhoto(f)]); }} />
              </label>
            )}
          </div>
        </div>
      );
    }
    case 'sign':
      return <div className="blk">{head}<SignaturePad value={value} onChange={set} disabled={disabled} /></div>;
  }
}
