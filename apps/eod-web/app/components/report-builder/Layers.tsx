/** Layers mirror the map: columns, then cards (sections and groups), then their figures. Everything folds. Search sits on top. */
import { useState } from 'react';
import { CLUSTERS, LANES, LANE_ROLE, ROLE_OF, boxName, clusterOf, clusterRole, search, type SearchHit } from '../../lib/report-builder/model';
import { Ic } from './icons';
import { useWs } from './workspace-helpers';

export function Layers() {
  const ws = useWs();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [closedLanes, setClosedLanes] = useState<Set<string>>(new Set());
  const flip = (set: Set<string>, id: string) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); return n; };
  const cards = [
    ...[...ws.secs].sort((a, b) => Number(a.kind === 'setting') - Number(b.kind === 'setting')).map((s) => ({ id: s.id, lane: 0, label: s.title, role: ROLE_OF[s.kind], kids: s.fields.map((f) => ({ id: s.id, fid: f.id as string | undefined, name: f.name, role: ROLE_OF[s.kind] })) })),
    ...CLUSTERS.map((c) => ({ id: c.id, lane: c.lane, label: c.title, role: clusterRole(c.id), kids: ws.bx.filter((b) => clusterOf(b) === c.id).map((b) => ({ id: b.id, fid: undefined as string | undefined, name: boxName(b), role: ROLE_OF[b.kind] })) })).filter((c) => c.kids.length),
  ];
  const chev = (isOpen: boolean, label: string, onClick: () => void) => (
    <button type="button" className="lchev" aria-expanded={isOpen} aria-label={`${isOpen ? 'Fold' : 'Unfold'} ${label}`} onClick={onClick}><Ic name="chev" /></button>
  );
  // A card opens on the map and moves into view; a figure opens its editor.
  const showCard = (id: string) => {
    ws.setCollapsed((c) => { const n = new Set(c); n.delete(id); return n; });
    setOpen((o) => new Set(o).add(id));
    ws.setFlash(id);
    ws.setVw('map');
  };
  const openFigure = (id: string, fid?: string) => {
    ws.open(id, fid ?? null);
    if (fid || !ws.secs.some((s) => s.id === id)) ws.reveal(id);
    ws.setFlash(id);
    if (typeof window !== 'undefined' && window.innerWidth < 900) ws.setShowLayers(false);
  };
  return (
    <aside className="layers" aria-label="Layers">
      <div className="lyr-head"><Find /></div>
      <nav className="lyr-list" id="layerList" aria-label="Everything in the report">
        {LANES.map((t, i) => {
          const laneOpen = !closedLanes.has(`lane${i}`), inLane = cards.filter((c) => c.lane === i);
          return (
            <div key={t}>
              <div className={`lyr-lane ${LANE_ROLE[i]}`}>{chev(laneOpen, t, () => setClosedLanes(flip(closedLanes, `lane${i}`)))}<span className="sw" />{t}<span className="lcount">{inLane.length}</span></div>
              <div className="lyr-group" hidden={!laneOpen}>
                {inLane.map((c) => (
                  <div key={c.id}>
                    <div className={`lyr-card ${c.role}`}>
                      {chev(open.has(c.id), c.label, () => setOpen(flip(open, c.id)))}
                      <button type="button" className={`lyr ${c.role}${ws.sel === c.id && !ws.selField ? ' on' : ''}`} data-lcard={c.id} onClick={() => showCard(c.id)}>
                        <span className="sw" /><span className="nm">{c.label}</span><span className="lcount">{c.kids.length}</span>
                      </button>
                    </div>
                    <div className="lyr-kids" hidden={!open.has(c.id)}>
                      {c.kids.map((k) => (
                        <button type="button" key={k.fid ?? k.id} className={`lyr sub ${k.role}${(k.fid ? ws.selField === k.fid : ws.sel === k.id && !ws.selField) ? ' on' : ''}`} onClick={() => openFigure(k.id, k.fid)}>
                          <span className="sw" /><span className="nm">{k.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

/** Find a figure: exact name first, arrow keys move, Enter opens it. ⌘K, Ctrl K or / gets you here. */
function Find() {
  const ws = useWs();
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const [shown, setShown] = useState(false);
  const hits = search(ws.def, q);
  const choose = (h?: SearchHit) => {
    if (!h) return;
    ws.open(h.id, h.fid ?? null);
    if (h.fid || !ws.secs.some((s) => s.id === h.id)) ws.reveal(h.id);
    ws.setFlash(h.id);
    if (ws.vw === 'list') ws.setVw('map');
    setShown(false);
  };
  return (
    <div className="findwrap">
      <input className="in find" id="find" type="search" placeholder="Find a figure  ⌘K" autoComplete="off" aria-label="Find a figure" aria-controls="results"
        value={q} onChange={(e) => { setQ(e.target.value); setAt(0); setShown(true); }} onFocus={() => setShown(true)} onBlur={() => setTimeout(() => setShown(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setAt(Math.min(at + 1, hits.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setAt(Math.max(at - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); choose(hits[at]); }
          else if (e.key === 'Escape') { e.stopPropagation(); setQ(''); setShown(false); e.currentTarget.blur(); }
        }} />
      {shown && q.trim() && (
        <div className="results" id="results" role="listbox">
          {hits.length ? hits.map((h, i) => (
            <button type="button" key={`${h.id}-${h.fid ?? ''}`} role="option" className={`${h.role}${i === at ? ' on' : ''}`} aria-selected={i === at}
              onMouseDown={(e) => e.preventDefault()} onClick={() => choose(h)}>
              <span className="sw" /><span>{h.label}<small>{h.kind}</small></span>
            </button>
          )) : <p className="cap small" style={{ padding: '8px 10px' }}>Nothing called “{q.trim()}”</p>}
        </div>
      )}
    </div>
  );
}
