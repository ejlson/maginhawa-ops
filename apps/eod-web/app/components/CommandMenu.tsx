/**
 * Search and do. On desktop, ⌘K (Ctrl+K) opens it as a box over the page; ↑ ↓ to move, ↵ to open, Esc to close.
 * On phones it is a full screen (design P6): the field with Cancel, filter chips, quick actions, and results
 * with the matching words marked.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { can, canDoEod, useAuth } from '../lib/auth';
import { runPath, useChecklists } from '../lib/checklists';
import { Chevron, Icon } from './ui';
import { useWide } from '../lib/wide';
import { useDraft } from '../lib/draft';
import { isEditable, sectionStatus } from '@maginhawa/core';
import { ICONS } from './ui-helpers';
import type { Item } from './command-menu-helpers';

export function CommandMenu({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tasks } = useChecklists();
  const { draft, status } = useDraft();
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<string | null>(null);
  const wide = useWide();
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
      ...(user && canDoEod(user) ? [{ id: 'eod', group: 'Actions', label: "Continue today's EOD", icon: ICONS.list, to: '/close', words: 'end of day report close' }] : []),
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
    const inGroup = only ? items.filter((i) => i.group === only) : items;
    return words.length ? inGroup.filter((i) => { const hay = `${i.label} ${i.sub ?? ''} ${i.group} ${i.words ?? ''}`.toLowerCase(); return words.every((w) => hay.includes(w)); }) : inGroup;
  }, [items, q, only]);
  const groups = [...new Set(items.map((i) => i.group))];
  // The words typed, marked where they appear (P6).
  const mark = (text: string) => {
    const w = q.trim().split(/\s+/).filter(Boolean).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!w.length) return text;
    return text.split(new RegExp(`(${w.join('|')})`, 'ig')).map((part, n) => (n % 2 ? <mark key={n}>{part}</mark> : part));
  };
  const quick: { label: string; to: string; icon: string }[] = [
    { label: 'Log a temp', to: '/food-safety/probes', icon: ICONS.thermo },
    ...(user && canDoEod(user) && isEditable(status) ? [{ label: 'Count cash', to: `/close/${sectionStatus(draft, 'lunch') === 'done' ? 'dinner' : 'lunch'}/cash`, icon: ICONS.cash }] : []),
    { label: 'Report a problem', to: '/report', icon: ICONS.wrench },
  ];
  const pick = Math.min(at, Math.max(0, shown.length - 1));

  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [pick]);

  const go = (i: Item | undefined) => { if (!i) return; onClose(); navigate(i.to); };
  const input = useRef<HTMLInputElement>(null);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    // Moving and opening results is for the search field; Enter on a button presses that button.
    if (e.target !== input.current) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt((pick + 1) % Math.max(1, shown.length)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((pick - 1 + shown.length) % Math.max(1, shown.length)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(shown[pick]); }
  };

  return (
    <div className="cmdk-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search or jump to" onKeyDown={onKey}>
        <div className="cmdk-top">
          <label className="cmdk-q">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input ref={input} autoFocus placeholder="Search checklists, screens and actions" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="cmdk-list"
              aria-activedescendant={shown[pick] ? `cmdk-${shown[pick]!.id}` : undefined} value={q} onChange={(e) => { setQ(e.target.value); setAt(0); }} />
            {q && <button type="button" className="cmdk-clear" aria-label="Clear" onClick={() => { setQ(''); setAt(0); input.current?.focus(); }}><Icon d="M5 5l8 8M13 5l-8 8" size={11} /></button>}
            {wide && <span className="kbd">esc</span>}
          </label>
          {!wide && <button type="button" className="cmdk-cancel" onClick={onClose}>Cancel</button>}
        </div>
        {!wide && (
          <div className="cmdk-chips" role="group" aria-label="Show">
            {[null, ...groups].map((g) => (
              <button key={g ?? 'all'} type="button" className="cmdk-chip" aria-pressed={only === g} onClick={() => { setOnly(g); setAt(0); }}>{g ?? 'All'}</button>
            ))}
          </div>
        )}
        {!wide && !q && !only && (
          <section className="cmdk-quick" aria-label="Quick actions">
            <div className="cmdk-grp">Quick actions</div>
            <div className="cmdk-tiles">
              {quick.map((a) => <button key={a.to} type="button" onClick={() => { onClose(); navigate(a.to); }}><span aria-hidden="true"><Icon d={a.icon} /></span>{a.label}</button>)}
            </div>
          </section>
        )}
        <div className="cmdk-list" id="cmdk-list" role="listbox" ref={list}>
          {shown.map((i, n) => (
            <div key={i.id}>
              {(n === 0 || shown[n - 1]!.group !== i.group) && <div className="cmdk-grp">{i.group}</div>}
              <div id={`cmdk-${i.id}`} role="option" aria-selected={n === pick} className="cmdk-row" onMouseMove={() => setAt(n)} onClick={() => go(i)}>
                <span className={`av${i.tone ? ` ${i.tone}` : ''}`}><Icon d={i.tone ? ICONS.bang : i.icon} size={16} /></span>
                <span className="tx"><span>{mark(i.label)}</span>{i.sub && <small>{mark(i.sub)}</small>}</span>
                {wide ? n === pick && <span className="kbd">↵</span> : <Chevron />}
              </div>
            </div>
          ))}
          {!shown.length && <p className="note" style={{ margin: 0, padding: '16px 12px' }}>Nothing matches “{q}”.</p>}
        </div>
        {wide && <div className="cmdk-foot"><span><span className="kbd">↑</span> <span className="kbd">↓</span> Move</span><span><span className="kbd">↵</span> Open</span><span><span className="kbd">⌘K</span> Close</span></div>}
      </div>
    </div>
  );
}
