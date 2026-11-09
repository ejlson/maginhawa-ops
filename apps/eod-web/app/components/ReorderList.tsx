/**
 * Reorder mode for a list of checks: drag a row by its handle (finger or mouse), or use the up and
 * down buttons. The buttons stay because dragging can't be the only way to reorder (WCAG 2.5.7), and
 * they're what keyboard and screen-reader users use.
 */
import { useRef, useState, type ReactNode } from 'react';
import { Icon } from './ui';
import { ICONS } from './ui-helpers';
import { dropIndex } from './reorder-helpers';

export interface ReorderItem { id: string; title: ReactNode; sub?: ReactNode; label: string }

interface Drag { id: string; from: number; startY: number; dy: number; tops: number[]; heights: number[] }

const GRIP = 'M7 4.5h.01M11 4.5h.01M7 9h.01M11 9h.01M7 13.5h.01M11 13.5h.01';

export function ReorderList({ items, onMove }: { items: ReorderItem[]; onMove: (id: string, to: number) => void }) {
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [moved, setMoved] = useState<string | null>(null);
  const to = drag ? dropIndex(drag.from, drag.dy, drag.tops, drag.heights) : -1;

  const start = (e: React.PointerEvent, id: string, from: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const boxes = rows.current.slice(0, items.length).map((r) => r?.getBoundingClientRect());
    setDrag({ id, from, startY: e.clientY, dy: 0, tops: boxes.map((b) => b?.top ?? 0), heights: boxes.map((b) => b?.height ?? 0) });
  };
  const move = (e: React.PointerEvent) => { if (drag) setDrag({ ...drag, dy: e.clientY - drag.startY }); };
  const end = () => {
    if (!drag) return;
    if (to !== drag.from) onMove(drag.id, to);
    setMoved(drag.id);
    setDrag(null);
  };
  const step = (id: string, i: number, by: -1 | 1) => { onMove(id, i + by); setMoved(id); };

  // While dragging, the rows between the old and new place slide to make room.
  const shift = (k: number) => {
    if (!drag || k === drag.from) return 0;
    const h = drag.heights[drag.from] ?? 0;
    if (drag.from < to && k > drag.from && k <= to) return -h;
    if (to < drag.from && k >= to && k < drag.from) return h;
    return 0;
  };

  return (
    <div className={`reorder${drag ? ' dragging' : ''}`}>
      {items.map((it, i) => {
        const lifted = drag?.id === it.id;
        const y = lifted ? drag!.dy : shift(i);
        return (
          <div key={it.id} ref={(el) => { rows.current[i] = el; }}
            className={`ro-row${lifted ? ' lifted' : ''}${!drag && moved === it.id ? ' moved' : ''}`}
            style={y ? { transform: `translateY(${y}px)` } : undefined}>
            <button type="button" className="ro-grip" aria-label={`Drag ${it.label}`} tabIndex={-1}
              onPointerDown={(e) => start(e, it.id, i)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d={GRIP} stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
            </button>
            <span className="tx"><span>{it.title}</span>{it.sub && <small>{it.sub}</small>}</span>
            <span className="ro-arrows">
              <button type="button" className="ro-btn" aria-label={`Move ${it.label} up`} disabled={i === 0} onClick={() => step(it.id, i, -1)}><Icon d={ICONS.up} size={14} /></button>
              <button type="button" className="ro-btn" aria-label={`Move ${it.label} down`} disabled={i === items.length - 1} onClick={() => step(it.id, i, 1)}><Icon d={ICONS.down} size={14} /></button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
