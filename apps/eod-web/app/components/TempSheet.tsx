/**
 * A temperature with big targets, for the kitchen iPad: − and + a degree at a time, quick values
 * around the limit, and whether it passes before it's saved. Typing in the row still works.
 */
import { useEffect, useRef, useState } from 'react';
import type { AnswerValue, Checkpoint } from '@maginhawa/core';
import { Icon } from './ui';
import { ICONS } from './ui-helpers';
import { quickValues, verdict } from './temp-sheet-helpers';

export function TempSheet({ c, value, today, onSave, onClose, next }: {
  c: Checkpoint; value: AnswerValue | undefined; today: string;
  onSave: (n: number) => void; onClose: () => void; next?: { title: string; open: () => void };
}) {
  const [n, setN] = useState<number>(typeof value === 'number' ? value : (c.min ?? c.max ?? 0));
  const save = useRef<HTMLButtonElement>(null);
  useEffect(() => { save.current?.focus(); }, [c.id]);
  useEffect(() => { setN(typeof value === 'number' ? value : (c.min ?? c.max ?? 0)); }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = verdict(c, n, today);
  const rule = c.min !== undefined && c.max !== undefined ? `${c.min}°C to ${c.max}°C` : c.min !== undefined ? `${c.min}°C or above` : c.max !== undefined ? `${c.max}°C or below` : '';
  const step = (d: number) => setN((x) => Number((x + d).toFixed(1)));

  return (
    <div className="sheet-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tsheet" role="dialog" aria-modal="true" aria-label={`${c.title} temperature`} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
        <div className="tsheet-hd">
          <span className="tx"><span>{c.title}</span>{rule && <small>Must be {rule}</small>}</span>
          <button type="button" className="mini" aria-label="Close" onClick={onClose}><Icon d={ICONS.x} size={16} /></button>
        </div>
        <div className="tsheet-dial">
          <button type="button" className="tstep" aria-label="1 degree lower" onClick={() => step(-1)}>−</button>
          <output className="tread" aria-live="polite">{String(n).replace('-', '−')}<small> °C</small></output>
          <button type="button" className="tstep" aria-label="1 degree higher" onClick={() => step(1)}>+</button>
        </div>
        {quickValues(c).length > 0 && (
          <div className="tquick" role="group" aria-label="Quick values">
            {quickValues(c).map((q) => <button key={q} type="button" className="chip" aria-pressed={q === n} onClick={() => setN(q)}>{String(q).replace('-', '−')}</button>)}
          </div>
        )}
        <div className={`tverdict${v.ok === false ? ' bad' : v.ok ? ' ok' : ''}`} role="status">
          {v.ok !== null && <Icon d={v.ok ? ICONS.check : ICONS.bang} size={18} />}{v.text}
        </div>
        <button ref={save} type="button" className="btn b1" onClick={() => { onSave(n); if (next) next.open(); else onClose(); }}>
          {next ? `Save and next: ${next.title}` : 'Save'}
        </button>
        <button type="button" className="btn b2" onClick={onClose}>Type it instead</button>
      </div>
    </div>
  );
}
