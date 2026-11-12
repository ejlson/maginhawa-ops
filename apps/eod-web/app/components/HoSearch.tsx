/**
 * Head office search (design/redesign-canvas, Option C): one box in the header that finds a site
 * (opening its details) or a screen. ⌘K / Ctrl+K focuses it; ↑ ↓ move, ↵ opens, Esc closes.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from './ui';
import { ICONS } from './ui-helpers';
import { SiteMono } from '../lib/site-colours';

export interface SearchSite { code: string; name: string; sub: string }
type Hit = { id: string; group: string; label: string; sub: string; site?: string; to?: string; icon?: string };

const SCREENS: Omit<Hit, 'group'>[] = [
  { id: 's-days', label: 'Past days', sub: 'Checklists and EODs by day', to: '/head-office/days', icon: ICONS.cal },
  { id: 's-reports', label: 'Reports', sub: 'Search closes, saved searches', to: '/head-office/reports', icon: ICONS.list },
  { id: 's-builder', label: 'Report builder', sub: 'What finance receives', to: '/head-office/report-builder', icon: ICONS.list },
  { id: 's-people', label: 'People and access', sub: 'Who works where', to: '/people', icon: ICONS.people },
  { id: 's-colours', label: 'Sites and colours', sub: "Each site's colour", to: '/head-office/sites', icon: ICONS.palette },
  { id: 's-checklists', label: 'Checklists', sub: 'Group and site lists', to: '/checklists/edit', icon: ICONS.check },
  { id: 's-records', label: 'Records for an inspector', sub: 'One PDF for any site and dates', to: '/food-safety/records', icon: ICONS.thermo },
];

export function HoSearch({ sites, onSite, screens = true }: { sites: SearchSite[]; onSite: (code: string) => void; screens?: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); input.current?.focus(); setOpen(true); }
    };
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', away);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', away); };
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const has = (s: string) => s.toLowerCase().includes(t);
    return [
      ...sites.filter((s) => has(s.name) || has(s.code)).map((s): Hit => ({ id: `site-${s.code}`, group: 'Sites', label: s.name, sub: s.sub, site: s.code })),
      ...(screens ? SCREENS.filter((s) => has(s.label) || has(s.sub)).map((s): Hit => ({ ...s, group: 'Screens' })) : []),
    ];
  }, [q, sites, screens]);

  const go = (h: Hit) => {
    setOpen(false);
    setQ('');
    if (h.site) onSite(h.site);
    else if (h.to) navigate(h.to);
  };

  const showing = open && q.trim().length > 0;
  return (
    <div className="hosearch" ref={box}>
      <label className="hosearch-box">
        <Icon d={ICONS.search} size={17} />
        <input ref={input} value={q} placeholder="Search sites and screens" aria-label="Search sites and screens"
          role="combobox" aria-expanded={showing} aria-controls="hosearch-list" aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setAt(0); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAt((i) => Math.min(i + 1, hits.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => Math.max(i - 1, 0)); }
            else if (e.key === 'Enter' && hits[at]) { e.preventDefault(); go(hits[at]); }
            else if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
          }} />
        <span className="kbd">⌘K</span>
      </label>
      {showing && (
        <div className="hosearch-list" id="hosearch-list" role="listbox" aria-label="Search results">
          {hits.length ? hits.map((h, i) => (
            <div key={h.id}>
              {(i === 0 || hits[i - 1]!.group !== h.group) && <div className="hosearch-gh">{h.group}</div>}
              <button type="button" role="option" aria-selected={i === at} className={`hosearch-item${i === at ? ' on' : ''}`}
                onMouseEnter={() => setAt(i)} onClick={() => go(h)}>
                {h.site ? <SiteMono code={h.site} /> : <span className="hosearch-ic"><Icon d={h.icon ?? ICONS.list} size={16} /></span>}
                <span className="tx"><span>{h.label}</span><small>{h.sub}</small></span>
              </button>
            </div>
          )) : <p className="hosearch-none">Nothing called “{q.trim()}”.</p>}
          <div className="hosearch-foot">↑ ↓ to move · ↵ to open · Esc to close</div>
        </div>
      )}
    </div>
  );
}
