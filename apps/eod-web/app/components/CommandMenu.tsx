/**
 * Search and do, for people at a desk: ⌘K (Ctrl+K) opens it from any site screen on desktop.
 * Finds screens, today's checklists and common actions; ↑ ↓ to move, ↵ to open, Esc to close.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { can, useAuth } from '../lib/auth';
import { runPath, useChecklists } from '../lib/checklists';
import { Icon, ICONS } from './ui';

interface Item { id: string; group: string; label: string; sub?: string; icon: string; tone?: 'bad'; to: string; words?: string }

export function useCommandMenu() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen };
}

export function CommandMenu({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tasks } = useChecklists();
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    const role = user?.role;
    const rank = { late: 0, due: 1, missed: 2, upcoming: 3, anytime: 4 } as Record<string, number>;
    const open = tasks.filter((t) => t.status !== 'done' && t.status !== 'failed').sort((a, b) => (rank[a.status] ?? 5) - (rank[b.status] ?? 5));
    return [
      ...open.map((t): Item => ({
        id: t.key, group: 'Checklists', to: runPath(t.key), icon: ICONS.check, tone: t.status === 'missed' || t.status === 'late' ? 'bad' : undefined,
        label: t.status === 'missed' ? t.title : `Start ${t.title}`,
        sub: t.status === 'missed' ? 'Missed, still worth doing' : t.status === 'late' ? 'Late' : t.status === 'anytime' ? 'When needed' : t.template.who,
        words: t.template.who,
      })),
      { id: 'probe', group: 'Food safety', label: 'Log a probe reading', icon: ICONS.thermo, to: '/food-safety/probes', words: 'temperature calibrate' },
      { id: 'delivery', group: 'Food safety', label: 'Check in a delivery', icon: ICONS.box, to: '/food-safety/deliveries/new', words: 'supplier' },
      { id: 'allergens', group: 'Food safety', label: 'Allergen matrix', icon: ICONS.list, to: '/food-safety/allergens', words: 'dish' },
      { id: 'report', group: 'Actions', label: 'Report a problem', icon: ICONS.wrench, to: '/report', words: 'repair broken' },
      ...(role && can.doEod(role) ? [{ id: 'eod', group: 'Actions', label: "Continue today's EOD", icon: ICONS.list, to: '/close', words: 'end of day report close' }] : []),
      { id: 'go-home', group: 'Go to', label: 'Home', icon: ICONS.home, to: '/' },
      { id: 'go-day', group: 'Go to', label: 'Timeline', icon: ICONS.clock, to: '/day', words: 'hour' },
      { id: 'go-checklists', group: 'Go to', label: 'Checklists', icon: ICONS.check, to: '/checklists' },
      ...(role && can.fixRepairs(role) ? [{ id: 'go-repairs', group: 'Go to', label: 'Repairs', icon: ICONS.wrench, to: '/repairs' }] : []),
      { id: 'go-handover', group: 'Go to', label: 'Handover', icon: ICONS.handover, to: '/handover', words: 'note last night' },
      { id: 'go-fs', group: 'Go to', label: 'Food safety', icon: ICONS.thermo, to: '/food-safety' },
    ];
  }, [tasks, user]);

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return words.length ? items.filter((i) => { const hay = `${i.label} ${i.sub ?? ''} ${i.group} ${i.words ?? ''}`.toLowerCase(); return words.every((w) => hay.includes(w)); }) : items;
  }, [items, q]);
  const pick = Math.min(at, Math.max(0, shown.length - 1));

  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [pick]);

  const go = (i: Item | undefined) => { if (!i) return; onClose(); navigate(i.to); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt((pick + 1) % Math.max(1, shown.length)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((pick - 1 + shown.length) % Math.max(1, shown.length)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(shown[pick]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <div className="cmdk-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search or jump to" onKeyDown={onKey}>
        <label className="cmdk-q">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input autoFocus placeholder="Search checklists, screens and actions" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="cmdk-list"
            aria-activedescendant={shown[pick] ? `cmdk-${shown[pick]!.id}` : undefined} value={q} onChange={(e) => { setQ(e.target.value); setAt(0); }} />
          <span className="kbd">esc</span>
        </label>
        <div className="cmdk-list" id="cmdk-list" role="listbox" ref={list}>
          {shown.map((i, n) => (
            <div key={i.id}>
              {(n === 0 || shown[n - 1]!.group !== i.group) && <div className="cmdk-grp">{i.group}</div>}
              <div id={`cmdk-${i.id}`} role="option" aria-selected={n === pick} className="cmdk-row" onMouseMove={() => setAt(n)} onClick={() => go(i)}>
                <span className={`av${i.tone ? ` ${i.tone}` : ''}`}><Icon d={i.tone ? ICONS.bang : i.icon} size={16} /></span>
                <span className="tx"><span>{i.label}</span>{i.sub && <small>{i.sub}</small>}</span>
                {n === pick && <span className="kbd">↵</span>}
              </div>
            </div>
          ))}
          {!shown.length && <p className="note" style={{ margin: 0, padding: '16px 12px' }}>Nothing matches “{q}”.</p>}
        </div>
        <div className="cmdk-foot"><span><span className="kbd">↑</span> <span className="kbd">↓</span> Move</span><span><span className="kbd">↵</span> Open</span><span><span className="kbd">⌘K</span> Close</span></div>
      </div>
    </div>
  );
}
