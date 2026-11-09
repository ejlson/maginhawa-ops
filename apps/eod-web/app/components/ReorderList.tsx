/**
 * Reorder mode for a list of checks or lists: drag a row by its handle (finger or mouse), or use the
 * up and down buttons. The buttons stay because dragging can't be the only way to reorder (WCAG
 * 2.5.7), and they're what keyboard and screen-reader users use. Near the top or bottom of the screen
 * the page scrolls while dragging, so a long list can be reordered in one go.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './ui';
import { ICONS } from './ui-helpers';
import { dropIndex, edgeSpeed } from './reorder-helpers';

export interface ReorderItem { id: string; title: ReactNode; sub?: ReactNode; label: string; lead?: ReactNode }

interface Drag { id: string; from: number; startY: number; startScroll: number; y: number; tops: number[]; heights: number[] }

const GRIP = 'M7 4.5h.01M11 4.5h.01M7 9h.01M11 9h.01M7 13.5h.01M11 13.5h.01';

/** The element that scrolls this list: the nearest scrolling ancestor, or the page. */
function scrollerOf(el: HTMLElement | null): HTMLElement {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

export function ReorderList({ items, onMove }: { items: ReorderItem[]; onMove: (id: string, to: number) => void }) {
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const dragRef = useRef<Drag | null>(null);
  const scroller = useRef<HTMLElement | null>(null);
  // A ~60fps timer rather than requestAnimationFrame, which some embedded views pause.
  const frame = useRef<ReturnType<typeof setInterval> | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [moved, setMoved] = useState<string | null>(null);

  // How far the row has moved, counting any scrolling since the drag began.
  const dyOf = (d: Drag) => d.y - d.startY + ((scroller.current?.scrollTop ?? 0) - d.startScroll);
  const dy = drag ? dyOf(drag) : 0;
  const to = drag ? dropIndex(drag.from, dy, drag.tops, drag.heights) : -1;

  const stopScrolling = () => { if (frame.current !== null) clearInterval(frame.current); frame.current = null; };
  useEffect(() => stopScrolling, []);

  // While dragging near an edge, scroll a little each frame and redraw the row under the finger.
  const tick = () => {
    const d = dragRef.current;
    const s = scroller.current;
    if (!d || !s) return;
    const box = s === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : s.getBoundingClientRect();
    const speed = edgeSpeed(d.y, Math.max(box.top, 0) + 80, Math.min(box.bottom, window.innerHeight) - 140);
    if (speed) {
      const before = s.scrollTop;
      s.scrollTop = before + speed;
      if (s.scrollTop !== before) setDrag({ ...d });
    }
  };

  const start = (e: React.PointerEvent, id: string, from: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    // Keep getting moves even when the finger leaves the handle (not available for scripted events).
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fine without it */ }
    scroller.current = scrollerOf(rows.current[from] ?? null);
    const boxes = rows.current.slice(0, items.length).map((r) => r?.getBoundingClientRect());
    const d: Drag = { id, from, startY: e.clientY, startScroll: scroller.current.scrollTop, y: e.clientY, tops: boxes.map((b) => b?.top ?? 0), heights: boxes.map((b) => b?.height ?? 0) };
    dragRef.current = d;
    setDrag(d);
    if (frame.current === null) frame.current = setInterval(tick, 16);
  };
  const move = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const next = { ...d, y: e.clientY };
    dragRef.current = next;
    setDrag(next);
  };
  const end = () => {
    const d = dragRef.current;
    stopScrolling();
    dragRef.current = null;
    if (!d) return;
    const landing = dropIndex(d.from, dyOf(d), d.tops, d.heights);
    if (landing !== d.from) onMove(d.id, landing);
    setMoved(d.id);
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
        const y = lifted ? dy : shift(i);
        return (
          <div key={it.id} ref={(el) => { rows.current[i] = el; }}
            className={`ro-row${it.lead ? ' has-lead' : ''}${lifted ? ' lifted' : ''}${!drag && moved === it.id ? ' moved' : ''}`}
            style={y ? { transform: `translateY(${y}px)` } : undefined}>
            <button type="button" className="ro-grip" aria-label={`Drag ${it.label}`} tabIndex={-1}
              onPointerDown={(e) => start(e, it.id, i)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d={GRIP} stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
            </button>
            {it.lead}
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
