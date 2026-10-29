/**
 * The map: four labelled columns (inputs → calculations → day totals → checks & actions), section cards and
 * calculation groups that fold to a summary, lines drawn from the formulas, drag a dot to connect, drag a card
 * to move it, and a canvas you can move around and zoom, like Figma. Ported from the prototype's own map.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { DEFAULT_COLOURS, PALETTE, ROLES, pickColour, type ColourId, type Role } from '../../lib/report-builder/colours';
import { formulaRefs, validateName, type FigureType } from '@maginhawa/core';
import {
  CARD_W, CLUSTERS, KIND_LABEL, LANES, LANEX, LANE_ROLE, ROLE_OF, TYPE_CHIP, boxName, clusterKeys, clusterOf, clusterRole,
  fmt, ownerOf, roleOfName, shortName, targetsFor, testDay, typeOfName, type Box, type ClusterId, type Section,
} from '../../lib/report-builder/model';
import { focusOf, useWs } from './workspace-helpers';
import { Ic } from './icons';

const ZMIN = 0.35, ZMAX = 1.6, DOCK_H = 76;
type Pos = { x: number; y: number };
type Item =
  | { id: string; lane: number; cluster: false; section: Section }
  | { id: ClusterId; lane: number; cluster: true; title: string; prefix: string; members: Box[] };

const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const ROLE_VAR: Record<string, string> = { 'r-in': 'in', 'r-set': 'set', 'r-calc': 'calc', 'r-act': 'act' };

/** Simple columns, top to bottom; or where they were put by hand, with new cards at the bottom of their column. */
function place(items: Item[], H: Record<string, number>, tidy: boolean, manual: Record<string, Pos>): Record<string, Pos> {
  const out: Record<string, Pos> = {};
  if (tidy) {
    const y = [64, 64, 64, 64];
    items.forEach((it) => { out[it.id] = { x: LANEX[it.lane]!, y: y[it.lane]! }; y[it.lane]! += (H[it.id] ?? 0) + 28; });
  } else {
    items.forEach((it) => { const m = manual[it.id]; if (m) out[it.id] = { ...m }; });
    items.forEach((it) => {
      if (out[it.id]) return;
      let bottom = 64;
      items.forEach((o) => { const p = out[o.id]; if (o !== it && p && o.lane === it.lane) bottom = Math.max(bottom, p.y + (H[o.id] ?? 0) + 28); });
      out[it.id] = { x: LANEX[it.lane]!, y: bottom };
    });
  }
  // Nothing may sit on top of anything else: in each column, a card that overlaps the one above moves down.
  [0, 1, 2, 3].forEach((lane) => {
    const col = items.filter((it) => it.lane === lane).sort((a, b) => out[a.id]!.y - out[b.id]!.y);
    for (let i = 1; i < col.length; i++) {
      const above = col[i - 1]!, min = out[above.id]!.y + (H[above.id] ?? 0) + 20;
      if (out[col[i]!.id]!.y < min) out[col[i]!.id]!.y = min;
    }
  });
  return out;
}
const samePos = (a: Record<string, Pos>, b: Record<string, Pos>) => JSON.stringify(a) === JSON.stringify(b);

export function MapView() {
  const ws = useWs();
  const { def, R, secs, bx, collapsed, h, doc } = ws;
  const focus = focusOf(ws);
  const day = testDay(doc);

  const items: Item[] = [
    ...[...secs].sort((a, b) => Number(a.kind === 'setting') - Number(b.kind === 'setting')).map((s) => ({ id: s.id, lane: 0, cluster: false as const, section: s })),
    ...CLUSTERS.map((c) => ({ id: c.id, lane: c.lane, cluster: true as const, title: c.title, prefix: c.prefix, members: bx.filter((b) => clusterOf(b) === c.id) })).filter((c) => c.members.length),
  ];

  const [zoom, setZoomState] = useState(1);
  const [pan, setPan] = useState<Pos>({ x: 0, y: 0 });
  const [placed, setPlaced] = useState<Record<string, Pos>>({});
  const [drag, setDrag] = useState<Record<string, Pos> | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [wiring, setWiring] = useState<{ src: string; ok: Set<string> } | null>(null);
  const [linkPop, setLinkPop] = useState<{ src: string; tgt: string; x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const cvs = useRef<HTMLDivElement>(null), cv = useRef<HTMLDivElement>(null);
  const edges = useRef<SVGSVGElement>(null), vals = useRef<HTMLDivElement>(null), wire = useRef<SVGSVGElement>(null);
  const els = useRef<Record<string, HTMLDivElement | null>>({});
  const centred = useRef(false);
  const z = useRef({ zoom, pan });
  z.current = { zoom, pan };
  const wsRef = useRef(ws);
  wsRef.current = ws;

  const heights = () => Object.fromEntries(items.map((it) => [it.id, els.current[it.id]?.offsetHeight ?? 0]));
  const posOf = (id: string): Pos => (drag?.[id] ?? placed[id]) ?? { x: LANEX[items.find((i) => i.id === id)?.lane ?? 0]!, y: 64 };

  /* ---------- zoom ---------- */
  const setZoom = (next: number, ox?: number, oy?: number) => {
    const el = cvs.current, { zoom: z0, pan: p } = z.current;
    const z1 = Math.min(ZMAX, Math.max(ZMIN, Math.round(next * 1000) / 1000));
    if (z1 === z0) return;
    const cx = ox ?? (el?.clientWidth ?? 0) / 2, cy = oy ?? (el?.clientHeight ?? 0) / 2;
    const wx = (cx - p.x) / z0, wy = (cy - p.y) / z0;
    setZoomState(z1); setPan({ x: cx - wx * z1, y: cy - wy * z1 });
  };
  const bounds = () => {
    const H = heights();
    let x0 = 0, y0 = 0, x1 = LANEX[3]! + CARD_W, y1 = 1;
    Object.entries(placed).forEach(([id, p]) => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + CARD_W); y1 = Math.max(y1, p.y + (H[id] ?? 0)); });
    return [x0, y0, x1 - x0 + 30, y1 - y0 + 30] as const;
  };
  const centreMap = (zz: number) => {
    const el = cvs.current;
    if (!el?.clientWidth) return;
    const [bx0, by0, w, hh] = bounds(), k = Math.min(ZMAX, Math.max(ZMIN, zz)), room = el.clientHeight - DOCK_H;
    setZoomState(k);
    setPan({ x: (el.clientWidth - w * k) / 2 - bx0 * k, y: (hh * k < room ? (room - hh * k) / 2 : 16) - by0 * k });
  };
  const fitZoom = () => {
    const el = cvs.current;
    if (!el?.clientWidth) return;
    const [, , w, hh] = bounds();
    centreMap(Math.floor(Math.min(1, (el.clientWidth - 32) / w, (el.clientHeight - DOCK_H - 24) / hh) * 100) / 100);
  };
  const fitWidth = () => { const el = cvs.current; if (el?.clientWidth) centreMap(Math.floor(Math.min(1, (el.clientWidth - 32) / bounds()[2]) * 100) / 100); };

  /* ---------- layout, then lines (they need the cards' real sizes) ---------- */
  useLayoutEffect(() => {
    const next = place(items, heights(), h.snap.tidy, h.snap.pos);
    if (!samePos(next, placed)) { setPlaced(next); return; }
    if (!centred.current && cvs.current?.clientWidth) { centred.current = true; fitWidth(); }
    if (ws.flash) {
      const el = cv.current?.querySelector<HTMLElement>(`[data-id="${ws.flash.replace(/"/g, '\\"')}"]`);
      const card = el?.closest<HTMLElement>('.node');
      if (el && card) {
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 1900);
        const p = placed[card.dataset.id ?? ''];
        const c = cvs.current;
        if (p && c?.clientWidth) setPan({ x: c.clientWidth / 2 - (p.x + CARD_W / 2) * zoom, y: c.clientHeight / 2 - (p.y + 60) * zoom });
      }
      ws.setFlash(null);
    }
    drawEdges();
  });

  /** Lines between figures, drawn after layout. A folded card bundles its lines into one. */
  function drawEdges() {
    const svg = edges.current, root = cv.current;
    if (!svg || !root) return;
    const varEl: Record<string, HTMLElement> = {};
    root.querySelectorAll<HTMLElement>('[data-var]').forEach((el) => { const v = el.dataset.var!; if (!varEl[v]) varEl[v] = el; });
    const rows: Record<string, HTMLElement> = {};
    root.querySelectorAll<HTMLElement>('.mrow[data-id]').forEach((el) => { rows[el.dataset.id!] = el; });
    const cardOf = (el: HTMLElement) => el.closest<HTMLElement>('.node');
    const anchor = (name: string) => {
      const el = varEl[name], node = el && cardOf(el);
      if (!el || !node) return null;
      const p = posOf(node.dataset.id!);
      const y = el === node || node.classList.contains('collapsed') || el.hidden ? p.y + 28 : p.y + el.offsetTop + el.offsetHeight / 2;
      return { x: p.x + (node.offsetWidth || CARD_W), y, node };
    };
    let cold = '', hot = '', labels = '';
    const seen = new Set<string>();
    bx.forEach((b) => {
      const tgtId = clusterOf(b), tgt = els.current[tgtId];
      if (!tgt) return;
      const tp = posOf(tgtId);
      const gate = b.kind === 'output' ? b.act.when : undefined;
      const off = !!gate && !R.vals[gate];
      const refs = [...new Set(b.kind === 'output' ? b.act.shows : formulaRefs(b.fig.formula))];
      refs.forEach((r) => {
        const a = anchor(r);
        if (!a || a.node === tgt) return;
        const bundled = a.node.classList.contains('collapsed') || tgt.classList.contains('collapsed');
        const k = `${a.node.dataset.id}>${tgtId}${bundled ? '' : `|${r}>${b.id}`}`;
        if (seen.has(k)) return;
        seen.add(k);
        const srcOwner = ownerOf(def, r);
        const isHot = !!focus && focus.has(b.id) && !!srcOwner && focus.has(srcOwner), dim = !!focus && !isHot;
        const row = !bundled ? rows[b.id] : undefined;
        const ty = row ? tp.y + row.offsetTop + row.offsetHeight / 2 : tp.y + 28;
        const ap = posOf(a.node.dataset.id!);
        let c1: [number, number], c2: [number, number], ex: number;
        if (Math.abs(ap.x - tp.x) < 60) { ex = tp.x + (tgt.offsetWidth || CARD_W); c1 = [a.x + 36, a.y]; c2 = [ex + 36, ty]; }
        else { ex = tp.x; const dx = Math.max(40, (ex - a.x) / 2); c1 = [a.x + dx, a.y]; c2 = [ex - dx, ty]; }
        const path = `M${a.x},${a.y} C${c1} ${c2} ${ex},${ty}`;
        const col = `var(--r-${ROLE_VAR[roleOfName(def, r)] ?? 'calc'})`;
        const bundle = bundled ? [a.node.dataset.id!, tgtId].filter((id) => collapsed.has(id)).join(' ') : '';
        let g = `<g opacity="${dim ? 0.1 : isHot ? 1 : 0.4}"><path d="${path}" fill="none" stroke="${col}" stroke-width="${isHot ? 2.4 : 1.5}"${off ? ' stroke-dasharray="5 5"' : ''}/>`;
        if (isHot && !off) g += `<path class="flowdots" d="${path}" fill="none" stroke="var(--card)" stroke-width="4"/>`;
        g += `<circle cx="${ex}" cy="${ty}" r="3.5" fill="${col}"/><path class="hit" d="${path}" fill="none" stroke="transparent" stroke-width="14" data-src="${esc(r)}" data-tgt="${esc(b.id)}"${bundle ? ` data-bundle="${esc(bundle)}"><title>Click to open these groups</title>` : `><title>${esc(r)} → ${esc(boxName(b))}. Click to remove</title>`}</path></g>`;
        if (isHot) {
          hot += g;
          if (!bundled && R.vals[r] !== undefined && (b.id === ws.sel || srcOwner === ws.sel)) {
            const t = 0.3, u = 1 - t, B = (p0: number, p1: number, p2: number, p3: number) => u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
            labels += `<span class="ev" style="left:${B(a.x, c1[0], c2[0], ex)}px;top:${B(a.y, c1[1], c2[1], ty)}px">${esc(fmt(R.vals[r], typeOfName(def, r)))}</span>`;
          }
        } else cold += g;
      });
    });
    svg.innerHTML = cold + hot;
    if (vals.current) vals.current.innerHTML = labels;
  }

  /* ---------- moving around: drag empty space, scroll, ⌘/Ctrl + scroll to zoom ---------- */
  useEffect(() => {
    const el = cvs.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) { setZoom(z.current.zoom * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.002)), e.clientX - r.left, e.clientY - r.top); return; }
      const k = e.deltaMode === 1 ? 16 : 1, p = z.current.pan;
      setPan({ x: p.x - (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k, y: p.y - (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input,textarea,select,[contenteditable]') || document.querySelector('.rb .modal-back') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.shiftKey && e.code === 'Digit1') { e.preventDefault(); fitZoom(); return; }
      if (e.shiftKey && e.code === 'Digit0') { e.preventDefault(); setZoom(1); return; }
      if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoom(Math.round(z.current.zoom * 10 + 1) / 10); return; }
      if (e.key === '-') { e.preventDefault(); setZoom(Math.round(z.current.zoom * 10 - 1) / 10); return; }
      const nudge = ({ ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] } as Record<string, [number, number]>)[e.key];
      if (nudge && !wsRef.current.sel && !wsRef.current.selField) { e.preventDefault(); const p = z.current.pan; setPan({ x: p.x + nudge[0], y: p.y + nudge[1] }); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const onStageDown = (e: RPointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    const anywhere = e.button === 1;
    if (!anywhere && (e.button !== 0 || t.closest('.node,.linkpop,.hit,.dock'))) return;
    if (anywhere) e.preventDefault();
    if (!anywhere && e.shiftKey) { startMarquee(e); return; }
    const start = { x: e.clientX, y: e.clientY, p: z.current.pan };
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true; setPanning(true);
      setPan({ x: start.p.x + dx, y: start.p.y + dy });
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setPanning(false);
      if (!moved && !anywhere) { setLinkPop(null); if (wsRef.current.picked.size) wsRef.current.setPicked(new Set()); if (wsRef.current.sel || wsRef.current.selField) wsRef.current.open(null); }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  /* ---------- picking several: Shift-drag a box round them (Shift keeps what's already picked) ---------- */
  const startMarquee = (e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const box = cvs.current!.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    const keep = new Set(wsRef.current.picked);
    const move = (ev: PointerEvent) => {
      const l = Math.min(x0, ev.clientX), t = Math.min(y0, ev.clientY), r = Math.max(x0, ev.clientX), b = Math.max(y0, ev.clientY);
      setMarquee({ x: l - box.left, y: t - box.top, w: r - l, h: b - t });
      const next = new Set(keep);
      Object.entries(els.current).forEach(([id, el]) => {
        const c = el?.getBoundingClientRect();
        if (c && c.left < r && c.right > l && c.top < b && c.bottom > t) next.add(id);
      });
      wsRef.current.setPicked(next);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setMarquee(null); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const togglePick = (id: string) => ws.setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /* ---------- dragging a card (and any others picked with it) ---------- */
  const dragged = useRef(false);
  const onCardDown = (id: string) => (e: RPointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (e.button !== 0 || t.closest('input,select,button,textarea,.port')) return;
    const shift = e.shiftKey;
    const group = ws.picked.has(id) ? [...ws.picked] : [id];
    const start = { x: e.clientX, y: e.clientY, o: Object.fromEntries(group.map((g) => [g, posOf(g)])) as Record<string, Pos> };
    const shifted = (dx: number, dy: number) => Object.fromEntries(group.map((g) => [g, { x: start.o[g]!.x + dx, y: start.o[g]!.y + dy }]));
    let moved = false;
    dragged.current = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) / z.current.zoom, dy = (ev.clientY - start.y) / z.current.zoom;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true; dragged.current = true;
      setDrag(shifted(dx, dy));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (!moved) {
        // Shift-click adds the card to the picked ones (or takes it out); a plain click starts again.
        if (shift) { togglePick(id); dragged.current = true; setTimeout(() => { dragged.current = false; }, 0); }
        else if (ws.picked.size) ws.setPicked(new Set());
        return;
      }
      const all = { ...placed, ...shifted((ev.clientX - start.x) / z.current.zoom, (ev.clientY - start.y) / z.current.zoom) };
      setDrag(null);
      const it = items.find((i) => i.id === id);
      const name = group.length > 1 ? `${group.length} cards` : it ? (it.cluster ? it.title : it.section.title) : 'card';
      ws.h.edit(`Moved ${name}`, (s) => ({ ...s, tidy: false, pos: { ...all } }));
      // A click arrives after the drag ends; ignore that one.
      setTimeout(() => { dragged.current = false; }, 0);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const clicked = () => { if (dragged.current) { dragged.current = false; return false; } return true; };

  /* ---------- connecting: drag a figure's dot onto a calculation or an action ---------- */
  const onPortDown = (src: string) => (e: RPointerEvent<HTMLSpanElement>) => {
    e.stopPropagation(); e.preventDefault();
    const ok = new Set(targetsFor(def, src).map((b) => b.id));
    setWiring({ src, ok });
    const root = cv.current!, el = root.querySelector<HTMLElement>(`[data-var="${src.replace(/"/g, '\\"')}"]`), node = el?.closest<HTMLElement>('.node');
    const p = node ? posOf(node.dataset.id!) : { x: 0, y: 0 };
    const a = { x: p.x + CARD_W, y: el && node && el !== node && !node.classList.contains('collapsed') ? p.y + el.offsetTop + el.offsetHeight / 2 : p.y + 28 };
    const sx = e.clientX, sy = e.clientY;
    const under = (ev: PointerEvent) => (document.elementFromPoint?.(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>('.mrow.drop-ok') ?? null;
    const move = (ev: PointerEvent) => {
      const r = root.getBoundingClientRect(), x = (ev.clientX - r.left) / z.current.zoom, y = (ev.clientY - r.top) / z.current.zoom;
      if (wire.current) wire.current.innerHTML = `<path d="M${a.x},${a.y} C${a.x + 60},${a.y} ${x - 60},${y} ${x},${y}" fill="none" stroke="var(--link)" stroke-width="2" stroke-dasharray="6 5"/><circle cx="${x}" cy="${y}" r="4" fill="var(--link)"/>`;
      root.querySelectorAll('.drop-hover').forEach((x2) => x2.classList.remove('drop-hover'));
      under(ev)?.classList.add('drop-hover');
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (wire.current) wire.current.innerHTML = '';
      const t = under(ev);
      setWiring(null);
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) { ws.toast(`Drag the dot onto a calculation or an email to connect ${src}`); return; }
      if (t?.dataset.id) ws.connectTo(src, t.dataset.id);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const onEdgeClick = (e: RMouseEvent<SVGSVGElement>) => {
    const hit = (e.target as Element).closest?.('.hit') as SVGPathElement | null;
    if (!hit) return;
    const bundle = hit.getAttribute('data-bundle');
    if (bundle) { ws.setCollapsed((c) => { const n = new Set(c); bundle.split(' ').forEach((id) => n.delete(id)); return n; }); return; }
    const r = cv.current!.getBoundingClientRect();
    setLinkPop({ src: hit.getAttribute('data-src')!, tgt: hit.getAttribute('data-tgt')!, x: Math.max(8, ((e.clientX || 0) - r.left) / zoom + 8), y: Math.max(8, ((e.clientY || 0) - r.top) / zoom + 8) });
  };

  const toggle = (id: string) => ws.setCollapsed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const dropClass = (id: string) => (wiring ? (wiring.ok.has(id) ? ' drop-ok' : ' drop-no') : '');
  const grid = 18 * zoom;

  let width = LANEX[3]! + CARD_W, height = 0;
  const H = heights();
  Object.entries(placed).forEach(([id, p]) => { width = Math.max(width, p.x + CARD_W); height = Math.max(height, p.y + (H[id] ?? 0)); });

  return (
    <div className="cv-wrap">
      <div className={`cv-scroll${panning ? ' panning' : ''}`} id="cvs" ref={cvs} onPointerDown={onStageDown}
        style={{ backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${Math.round(pan.x)}px ${Math.round(pan.y)}px` }}>
        <div id="cvz">
          <div className="canvas" id="cv" ref={cv} style={{ transformOrigin: '0 0', transform: `translate(${Math.round(pan.x)}px,${Math.round(pan.y)}px) scale(${zoom})`, width: width + 30, height: height + 30 }}>
            {LANES.map((_, i) => <div key={`b${i}`} className={`band ${LANE_ROLE[i]}`} style={{ left: LANEX[i]! - 14, width: CARD_W + 28 }} />)}
            <svg id="edges" ref={edges} onClick={onEdgeClick} />
            <div id="vals" ref={vals} />
            <svg id="wire" ref={wire} />
            {items.map((it) => {
              const p = posOf(it.id);
              const common = { pos: p, setRef: (el: HTMLDivElement | null) => { els.current[it.id] = el; }, onDown: onCardDown(it.id), clicked, onPortDown, dropClass, toggle };
              return it.cluster
                ? <ClusterCard key={it.id} it={it} focus={focus} {...common} />
                : <SectionCard key={it.id} s={it.section} focus={focus} values={day.values} {...common} />;
            })}
            {LANES.map((t, i) => <div key={`h${i}`} className={`lane-h ${LANE_ROLE[i]}`} style={{ left: LANEX[i] }}><span className="n">{i + 1}</span>{t}</div>)}
            {linkPop && (
              <div className="linkpop" style={{ left: linkPop.x, top: linkPop.y }}>
                <span><b>{linkPop.src}</b> feeds <b>{ws.bx.find((b) => b.id === linkPop.tgt) ? boxName(ws.bx.find((b) => b.id === linkPop.tgt)!) : ''}</b></span>
                <div className="acts">
                  <button type="button" className="danger" autoFocus onClick={() => { ws.disconnectFrom(linkPop.src, linkPop.tgt); setLinkPop(null); }}>Remove link</button>
                  <button type="button" className="lnk" onClick={() => setLinkPop(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
        {marquee && <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
      </div>
      <div className="dock">
        <div className="dock-l">
          <Legend />
        </div>
        <div className="dock-c">
          <div className="floatbar" role="toolbar" aria-label="Add to the report">
            <AddButton act="input" role="r-in" icon="input" label="Input" k="I" tip="A figure managers type in" />
            <AddButton act="section" role="r-in" icon="section" label="Section" k="S" tip="A new group of inputs" />
            <span className="sep" />
            <AddButton act="calc" role="r-calc" icon="calc" label="Calculation" k="C" tip="Works something out from other figures" />
            <AddButton act="check" role="r-act" icon="check" label="Check" k="K" tip="A yes or no, for alerts" />
            <AddButton act="setting" role="r-set" icon="setting" label="Setting" k="T" tip="A rate or limit head office sets" />
          </div>
        </div>
        <div className="dock-r">
          <div className="zoombar" role="group" aria-label="Zoom">
            <button type="button" id="zOut" aria-label="Zoom out" onClick={() => setZoom(Math.round(zoom * 10 - 1) / 10)}>−</button>
            <button type="button" id="zPct" aria-label="Reset zoom to 100%" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
            <button type="button" id="zIn" aria-label="Zoom in" onClick={() => setZoom(Math.round(zoom * 10 + 1) / 10)}>+</button>
            <button type="button" id="zFit" onClick={fitZoom}>Fit</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The colour dots. Click one to give that type of box another colour. */
function Legend() {
  const ws = useWs();
  const { colours, set } = ws.colours;
  const [open, setOpen] = useState<Role | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(null); } };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc, true); };
  }, [open]);
  const label = (r: Role) => ROLES.find(([k]) => k === r)![1];
  const pick = (role: Role, id: ColourId) => {
    const { colours: next, swapped } = pickColour(colours, role, id);
    set(next);
    ws.toast(swapped ? `Swapped colours with ${label(swapped)}` : `${label(role)} are now ${PALETTE[id].name}`);
  };
  return (
    <div className="cv-legend"><div className="legwrap" ref={wrap}>
      {ROLES.map(([k, l]) => (
        <button key={k} type="button" className={`swbtn r-${k}`} aria-haspopup="dialog" aria-expanded={open === k} title={`${l}: change its colour`}
          onClick={() => setOpen(open === k ? null : k)}><span className="sw" /><span className="swl">{l}</span></button>
      ))}
      {open && (
        <div className="palette" role="dialog" aria-label={`Colour for ${label(open)}`}>
          <div className="ph"><b>Colour for {label(open)}</b><button type="button" className="lnk small" onClick={() => setOpen(null)}>Done</button></div>
          <div className="grid">
            {(Object.keys(PALETTE) as ColourId[]).map((id) => {
              const user = ROLES.find(([k]) => k !== open && colours[k] === id);
              return (
                <button key={id} type="button" aria-pressed={colours[open] === id} onClick={() => pick(open, id)}
                  style={{ '--pl': PALETTE[id].l, '--pd': PALETTE[id].d } as CSSProperties} title={`${PALETTE[id].name}${user ? ` (swaps with ${user[1]})` : ''}`}>
                  <i />{PALETTE[id].name}
                </button>
              );
            })}
          </div>
          <p className="why">Green, amber and red aren’t offered, because they mean good, watch and wrong. Picking a colour another type uses swaps the two.</p>
          <button type="button" className="lnk small" style={{ alignSelf: 'flex-start' }} onClick={() => { set({ ...DEFAULT_COLOURS }); ws.toast('Colours reset'); }}>Reset all colours</button>
        </div>
      )}
    </div></div>
  );
}

function AddButton({ act, role, icon, label, k, tip }: { act: string; role: string; icon: string; label: string; k: string; tip: string }) {
  const ws = useWs();
  return (
    <button type="button" data-act={act} className={role} title={`${tip} (${k})`} onClick={() => ws.addByKey(act)}>
      <span className="ic"><Ic name={icon} /></span><span className="lbl">{label}</span><kbd>{k}</kbd>
    </button>
  );
}

interface CardProps {
  pos: Pos;
  focus: Set<string> | null;
  setRef: (el: HTMLDivElement | null) => void;
  onDown: (e: RPointerEvent<HTMLDivElement>) => void;
  clicked: () => boolean;
  onPortDown: (src: string) => (e: RPointerEvent<HTMLSpanElement>) => void;
  dropClass: (id: string) => string;
  toggle: (id: string) => void;
}

/** Rename in place: Enter or clicking away saves, Escape cancels. A problem shows as a message and editing carries on. */
function InlineName({ value, label = 'Name', onCommit }: { value: string; label?: string; onCommit: (v: string) => boolean }) {
  const ws = useWs();
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const finish = () => {
    if (done.current) return;
    const v = ref.current?.value.trim() ?? '';
    if (v === value) { done.current = true; ws.setInline(null); return; }
    if (onCommit(v)) { done.current = true; ws.setInline(null); } else setTimeout(() => ref.current?.focus());
  };
  return (
    <input className="inl" ref={ref} defaultValue={value} aria-label={label}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); finish(); } if (e.key === 'Escape') { done.current = true; ws.setInline(null); } }}
      onBlur={() => setTimeout(finish, 0)} onPointerDown={(e) => e.stopPropagation()} />
  );
}

function SectionCard({ s, pos, focus, values, setRef, onDown, clicked, onPortDown, dropClass, toggle }: CardProps & { s: Section; values: Record<string, number> }) {
  const ws = useWs();
  const isSet = s.kind === 'setting', role = ROLE_OF[s.kind];
  const holds = (id: string | null) => !!id && s.fields.some((f) => f.id === id);
  const closed = ws.collapsed.has(s.id) && !holds(ws.selField) && !holds(ws.inline);
  const editable = !isSet;
  const isNew = !ws.baseIds.has(s.id);
  const renameFigure = (id: string, old: string) => (v: string) => {
    const p = validateName(ws.def, v, id);
    if (p) { ws.toast(p, { bad: true }); return false; }
    return ws.renameFig(id, old, v);
  };
  const select = (target: HTMLElement) => {
    if (target.closest('.addrow')) { ws.addInput(s.id); return; }
    const row = target.closest<HTMLElement>('.frow');
    ws.open(s.id, row?.dataset.fid ?? null);
  };
  return (
    <div ref={setRef} data-id={s.id} style={{ left: pos.x, top: pos.y }} onPointerDown={onDown}
      onClick={(e) => { const t = e.target as HTMLElement; if (!clicked() || t.closest('input,select,button:not(.addrow),.port')) return; select(t); }}
      className={`node ${role}${ws.picked.has(s.id) ? ' picked' : ''}${closed ? ' collapsed' : ''}${isNew ? ' isnew' : ''}${ws.sel === s.id ? ' sel' : ''}${focus && !focus.has(s.id) ? ' dim' : ''}${dropClass(s.id)}`}>
      <div className="nh" tabIndex={0} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ws.open(s.id); } }}>
        <button type="button" className="chev" aria-expanded={!closed} aria-label={`${closed ? 'Show' : 'Hide'} the ${s.title} ${isSet ? 'settings' : 'inputs'}`}
          onClick={(e) => { e.stopPropagation(); if (!closed && holds(ws.selField)) ws.setSelField(null); toggle(s.id); }}><Ic name="chev" /></button>
        <span className="ic"><Ic name={s.kind} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="nk">{KIND_LABEL[s.kind]}</div>
          <div className="nt" title={editable ? `${s.title}. Double-click to rename` : undefined} onDoubleClick={(e) => { if (!editable) return; e.stopPropagation(); ws.setInline(`node:${s.id}`); }}>
            {ws.inline === `node:${s.id}` ? <InlineName value={s.title} onCommit={(v) => ws.renameSection(s.id, v)} /> : s.title}
          </div>
        </div>
        {isNew && <span className="pill ok newtag">New</span>}
        {editable && (
          <span className="nact">
            <button type="button" aria-label={`Rename ${s.title}`} title="Rename" onClick={(e) => { e.stopPropagation(); ws.setInline(`node:${s.id}`); }}><Ic name="pen" /></button>
            <button type="button" className="rm" aria-label={`Delete ${s.title}`} title="Delete" onClick={(e) => { e.stopPropagation(); ws.deleteSection(s.id); }}><Ic name="trash" /></button>
          </span>
        )}
      </div>
      <div className="nb">
        {s.fields.map((f) => (
          <div key={f.id} className={`frow${ws.selField === f.id ? ' on' : ''}`} data-var={f.name} data-fid={f.id} tabIndex={0}
            onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === 'Enter') { e.preventDefault(); ws.open(s.id, f.id); } }}>
            {ws.inline === f.id
              ? <InlineName value={f.name} onCommit={renameFigure(f.id, f.name)} />
              : <span className="fname" title={`${f.name}. Double-click to rename`} onDoubleClick={(e) => { e.stopPropagation(); ws.setInline(f.id); }}>
                  {shortName(f.name, s.title)}{!ws.baseIds.has(f.id) && <> <span className="pill ok" style={{ padding: '0 6px', fontSize: 11 }}>New</span></>}
                </span>}
            <span className="fval">{fmt(values[f.id], f.type)}</span>
            <select className="tychip" aria-label={`Type of ${f.name}`} title="Money, percent or number" value={f.type}
              onChange={(e) => ws.setType(f, e.target.value as FigureType)} onClick={(e) => e.stopPropagation()}>
              {(['money', 'percent', 'number'] as const).map((t) => <option key={t} value={t}>{TYPE_CHIP[t]}</option>)}
            </select>
            <button type="button" className="fdel" aria-label={`Delete ${f.name}`} title="Delete" onClick={(e) => { e.stopPropagation(); ws.deleteFig(f.id); }}>×</button>
            <span className="port" data-src={f.name} title={`Drag onto a calculation to use ${f.name}`} onPointerDown={onPortDown(f.name)} />
          </div>
        ))}
        <button type="button" className="addrow">+ Add {isSet ? 'setting' : 'input'}</button>
        <button type="button" className="csum" onClick={(e) => { e.stopPropagation(); toggle(s.id); }}>
          {s.fields.length} {isSet ? 'setting' : 'input'}{s.fields.length === 1 ? '' : 's'}<span className="cap small">Show</span>
        </button>
      </div>
    </div>
  );
}

function ClusterCard({ it, pos, focus, setRef, onDown, clicked, onPortDown, dropClass, toggle }: CardProps & { it: Extract<Item, { cluster: true }> }) {
  const ws = useWs();
  const { R, def } = ws;
  const closed = ws.collapsed.has(it.id), m = it.members, role = clusterRole(it.id);
  const live = !focus || m.some((x) => focus.has(x.id));
  const nameOf = boxName;
  const errs = m.filter((x) => R.errs[nameOf(x)]).length;
  let summary: ReactNode;
  if (it.id === 'c-checks') {
    const yes = m.filter((x) => R.vals[nameOf(x)]);
    summary = <div className="line"><span>On the test day</span>{yes.length ? <span className="pill warn">{yes.length} flagged</span> : <span className="pill ok">All clear</span>}</div>;
  } else if (it.id === 'c-actions') {
    const run = m.filter((x) => x.kind === 'output' && (!x.act.when || R.vals[x.act.when])).length;
    summary = <div className="line"><span>Run on the test day</span><span>{run} of {m.length}</span></div>;
  } else {
    const keys = clusterKeys(it.id).map((id) => m.find((x) => x.id === id)).filter((x): x is Box => !!x);
    summary = (keys.length ? keys : m.slice(0, 2)).slice(0, 2).map((x) => (
      <div key={x.id} className="line"><span>{it.prefix ? shortName(nameOf(x), it.prefix) : nameOf(x)}</span><span>{R.errs[nameOf(x)] ? <span className="pill bad">Problem</span> : x.kind !== 'output' ? fmt(R.vals[x.fig.name], x.fig.type) : ''}</span></div>
    ));
  }
  const value = (x: Box) => {
    const name = nameOf(x);
    if (R.errs[name]) return <span className="pill bad">Problem</span>;
    if (x.kind === 'output') {
      if (x.act.when) { const off = !R.vals[x.act.when]; return <span className={`pill ${off ? 'plain' : 'warn'}`}>{off ? 'Won’t run' : 'Will run'}</span>; }
      return <span className="cap small">{x.act.shows.length} figure{x.act.shows.length === 1 ? '' : 's'}</span>;
    }
    if (x.fig.type === 'yesno') return <span className={`pill ${R.vals[name] ? 'warn' : 'ok'}`}>{fmt(R.vals[name], 'yesno')}</span>;
    return fmt(R.vals[name], x.fig.type);
  };
  const renameBox = (x: Box) => (v: string) => {
    if (x.kind === 'output') return true;
    const p = validateName(def, v, x.id);
    if (p) { ws.toast(p, { bad: true }); return false; }
    return ws.renameFig(x.id, x.fig.name, v);
  };
  return (
    <div ref={setRef} data-id={it.id} style={{ left: pos.x, top: pos.y }} onPointerDown={onDown}
      className={`node cluster ${role}${ws.picked.has(it.id) ? ' picked' : ''}${closed ? ' collapsed' : ' open'}${live ? '' : ' dim'}${m.some((x) => x.id === ws.sel) ? ' sel' : ''}`}>
      <div className="nh" tabIndex={0}
        onClick={(e) => { if (!clicked() || (e.target as HTMLElement).closest('button')) return; toggle(it.id); }}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(it.id); } }}>
        <button type="button" className="chev" aria-expanded={!closed} aria-label={`${closed ? 'Show' : 'Hide'} ${it.title}`} onClick={(e) => { e.stopPropagation(); toggle(it.id); }}><Ic name="chev" /></button>
        <span className="ic"><Ic name={role === 'r-act' ? 'check' : 'calc'} /></span>
        <div style={{ minWidth: 0, flex: 1 }}><div className="nk">{role === 'r-act' ? 'Group' : 'Calculations'}</div><div className="nt">{it.title}</div></div>
        {errs > 0 && <span className="pill bad">{errs} to fix</span>}
      </div>
      <div className="nb">
        {closed ? <>
          {summary}
          <button type="button" className="csum" onClick={(e) => { e.stopPropagation(); toggle(it.id); }}>
            {m.length} {it.id === 'c-checks' ? 'check' : it.id === 'c-actions' ? 'action' : 'figure'}{m.length === 1 ? '' : 's'}<span className="cap small">Show</span>
          </button>
          {m.map((x) => <i key={x.id} hidden data-var={nameOf(x)} />)}
        </> : (
          <div className="mrows">
            {m.map((x) => {
              const name = nameOf(x), shown = it.prefix ? shortName(name, it.prefix) : name, editable = x.kind !== 'output';
              const desc = x.kind !== 'output' ? x.fig.description : undefined;
              return (
                <div key={x.id} className={`mrow ${ROLE_OF[x.kind]}${ws.sel === x.id ? ' on' : ''}${focus && !focus.has(x.id) ? ' dim' : ''}${dropClass(x.id)}`}
                  data-id={x.id} data-var={name} tabIndex={0} title={`${name}${desc ? `: ${desc}` : ''}`}
                  onClick={(e) => { if (!clicked() || (e.target as HTMLElement).closest('button,input,.port')) return; ws.open(x.id); }}
                  onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === 'Enter') { e.preventDefault(); ws.open(x.id); } }}>
                  {ws.inline === `node:${x.id}`
                    ? <InlineName value={name} onCommit={renameBox(x)} />
                    : <span className="mn" onDoubleClick={(e) => { if (!editable) return; e.stopPropagation(); ws.setInline(`node:${x.id}`); }}>
                        {shown}{!ws.baseIds.has(x.id) && x.kind !== 'output' && <> <span className="pill ok" style={{ padding: '0 6px', fontSize: 11 }}>New</span></>}
                      </span>}
                  <span className="mv">{value(x)}</span>
                  {editable && (
                    <span className="mact">
                      <button type="button" aria-label={`Rename ${name}`} title="Rename" onClick={(e) => { e.stopPropagation(); ws.setInline(`node:${x.id}`); }}><Ic name="pen" /></button>
                      <button type="button" className="rm" aria-label={`Delete ${name}`} title="Delete" onClick={(e) => { e.stopPropagation(); ws.deleteFig(x.id); }}><Ic name="trash" /></button>
                    </span>
                  )}
                  {x.kind !== 'output' && <span className="port" data-src={name} title={`Drag onto another box to use ${name}`} onPointerDown={onPortDown(name)} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
