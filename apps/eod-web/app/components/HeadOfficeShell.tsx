/**
 * Head office's frame: a sidebar on desktop and iPad, a bottom tab bar on phones. Sites and Trends are
 * sections of the Head office page for now, so they scroll to it.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { SITES } from '@maginhawa/core';
import { Icon } from './ui';
import { ICONS } from './ui-helpers';
import { useWide } from '../lib/wide';
import { WhoMenu } from './home/WhoMenu';
import type { Tone } from '../lib/ho-today';

const SEARCH = 'M8.5 3.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12.2 12.2L16.5 16.5';
const SITES_ICON = 'M3 17V8l7-4 7 4v9M8 17v-5h4v5';
const BUILDER_ICON = 'M3 4h5v5H3zM12 11h5v5h-5zM8 6.5h2.5a1.5 1.5 0 0 1 1.5 1.5v3';
const CART_ICON = 'M2 3h2.2l1.6 8.5h8.4l1.6-6H5.1M7 15h.01M13.5 15h.01';
/** A window with its left pane: the button that folds the sidebar into a rail and back. */
const PANE_ICON = 'M2.5 3.5h13v11h-13zM7 3.5v11';
const COG_ICON = 'M9 11.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6zM14.4 11.1a1.2 1.2 0 0 0 .2 1.3l.1.1a1.5 1.5 0 1 1-2.1 2.1l-.1-.1a1.2 1.2 0 0 0-2.1.9v.1a1.5 1.5 0 1 1-3 0v-.1a1.2 1.2 0 0 0-2.1-.9l-.1.1a1.5 1.5 0 1 1-2.1-2.1l.1-.1a1.2 1.2 0 0 0-.9-2.1h-.1a1.5 1.5 0 1 1 0-3h.1a1.2 1.2 0 0 0 .9-2.1l-.1-.1a1.5 1.5 0 1 1 2.1-2.1l.1.1a1.2 1.2 0 0 0 2.1-.9v-.1a1.5 1.5 0 1 1 3 0v.1a1.2 1.2 0 0 0 2.1.9l.1-.1a1.5 1.5 0 1 1 2.1 2.1l-.1.1a1.2 1.2 0 0 0 .9 2.1h.1a1.5 1.5 0 1 1 0 3h-.1a1.2 1.2 0 0 0-1.1.6z';

/** Phones get four tabs, like the sites' Today · EOD · Checklists · More; everything else is in More. */
const PHONE_TABS = [
  { to: '/head-office', label: 'Today', icon: ICONS.home },
  { to: '/head-office/days', label: 'Days', icon: ICONS.cal },
  { to: '/head-office/reports', label: 'Reports', icon: SEARCH },
  { to: '/head-office/more', label: 'More', icon: ICONS.grid },
] as const;

export const BUILDER = BUILDER_ICON;

export const LINKS = [
  { to: '/head-office', label: 'Today', icon: ICONS.home },
  { to: '/head-office#sites', label: 'Sites', icon: SITES_ICON },
  { to: '/head-office/days', label: 'Days', icon: ICONS.cal },
  { to: '/head-office/reports', label: 'Reports', icon: SEARCH },
  { to: '/head-office#trends', label: 'Trends', icon: ICONS.chart },
  { to: '/food-safety', label: 'Food safety', icon: ICONS.thermo },
  { to: '/head-office/stock', label: 'Stock', icon: ICONS.box },
  { to: '/head-office/ordering', label: 'Ordering and waste', icon: CART_ICON },
  { to: '/head-office/menu', label: 'Menu costing', icon: ICONS.list },
  { to: '/head-office/safety', label: 'Health and safety', icon: ICONS.bang },
  { to: '/head-office/maintenance', label: 'Maintenance', icon: ICONS.wrench },
  { to: '/head-office/records', label: 'Records and exports', icon: ICONS.list },
] as const;

type HoItem = { to: string; label: string; icon: string; on?: (path: string) => boolean };
const byLabel = (label: string) => LINKS.find((l) => l.label === label)!;
/** The sidebar in sections (design H3, with "Overview" for its "Tonight": it's used all day), the site records in their own section. */
const HO_GROUPS: { title: string; items: HoItem[] }[] = [
  { title: 'Overview', items: [byLabel('Today'), byLabel('Sites'), { ...byLabel('Days'), label: 'Checklists & EODs' }] },
  { title: 'Operations', items: ['Food safety', 'Stock', 'Ordering and waste', 'Menu costing', 'Health and safety', 'Maintenance'].map(byLabel) },
  { title: 'Reports', items: [byLabel('Reports'), { ...byLabel('Trends'), label: 'Trends & forecast' }, byLabel('Records and exports'),
    { to: '/head-office/report-builder', label: 'Report builder', icon: BUILDER_ICON, on: (p) => p.startsWith('/head-office/report-builder') }] },
  { title: 'Settings', items: [
    { to: '/people', label: 'People', icon: ICONS.people, on: (p) => p.startsWith('/people') },
    { to: '/head-office/sites', label: 'Sites and colours', icon: ICONS.palette, on: (p) => p === '/head-office/sites' },
    // Set-up moved here from the bottom of Today (layout A, Nov 2026).
    { to: '/checklists/edit', label: 'Checklists', icon: ICONS.check, on: (p) => p.startsWith('/checklists/edit') },
    { to: '/food-safety/records', label: 'Records for an inspector', icon: ICONS.doc, on: (p) => p === '/food-safety/records' },
    { to: '/food-safety/keep', label: 'How long we keep records', icon: ICONS.lock, on: (p) => p === '/food-safety/keep' },
  ] },
];

/** Which sidebar sections are folded away, remembered on this device. Only Overview starts open (layout A). */
const FOLDED_KEY = 'mgh.ho-nav.folded.v2';
const FOLDED_START = ['Operations', 'Reports', 'Settings'];
function useFolded() {
  const [folded, setFolded] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(FOLDED_KEY);
      if (raw === null) return FOLDED_START;
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : FOLDED_START;
    } catch { return FOLDED_START; }
  });
  const toggle = (title: string) => setFolded((f) => {
    const next = f.includes(title) ? f.filter((x) => x !== title) : [...f, title];
    try { localStorage.setItem(FOLDED_KEY, JSON.stringify(next)); } catch { /* storage off: still folds for now */ }
    return next;
  });
  return { folded, toggle };
}

/** Whether the desktop sidebar is folded into a slim icon rail (design C · Review queue), remembered on this device. */
export const RAIL_KEY = 'mgh.ho-nav.rail.v1';
function useRail(wide: boolean) {
  const [rail, setRail] = useState(() => {
    try { return localStorage.getItem(RAIL_KEY) === '1'; } catch { return false; }
  });
  // The toggle that was pressed goes away with the sidebar it was in, so focus moves to the one that replaces it.
  const moved = useRef(false);
  const toggle = () => {
    moved.current = true;
    setRail((r) => !r);
  };
  useEffect(() => {
    try { localStorage.setItem(RAIL_KEY, rail ? '1' : '0'); } catch { /* storage off: still folds for now */ }
    if (moved.current) { moved.current = false; document.querySelector<HTMLElement>('.ho-side [data-rail-toggle]')?.focus(); }
  }, [rail]);
  // ⌘\ (Ctrl+\ elsewhere) folds and unfolds it, as in Mail and Notes.
  useEffect(() => {
    if (!wide) return;
    const key = (e: KeyboardEvent) => {
      if (e.repeat || e.isComposing) return;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key === '\\') {
        e.preventDefault();
        // If focus was in the sidebar, it would go with it: keep it on the toggle that replaces it.
        moved.current = document.activeElement?.closest('.ho-side') != null;
        setRail((r) => !r);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [wide]);
  return { rail, toggle };
}

/** An operations area's state for the rail's dots: the tile's tone, and its words (e.g. "2 counts late"). */
export type OpsTones = Partial<Record<string, { tone: Tone; note: string }>>;
const TONE_WORDS: Record<Tone, string> = { bad: 'urgent', warn: 'needs a look' };
const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** `opsCount`: how many operations areas need a look, shown on the Operations heading while it's folded.
 *  `opsTones`: per area (keyed by its link), a red or amber dot on the rail's icon. */
export function HeadOfficeShell({ inToday, opsCount, opsBad, opsTones, children }: { inToday?: string; opsCount?: number; opsBad?: boolean; opsTones?: OpsTones; children: ReactNode }) {
  const { pathname, hash, search } = useLocation();
  const saved = new URLSearchParams(search).get('saved');
  const wide = useWide();
  const { folded, toggle } = useFolded();
  const { rail, toggle: toggleRail } = useRail(wide);
  const shortcut = isMac() ? '⌘\\' : 'Ctrl+\\';

  // Sites and Trends are on the Head office page: scroll to them once it has drawn.
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [pathname, hash]);

  const isOn = (to: string) => {
    const [path, h] = to.split('#');
    if (path === '/head-office' && h === 'sites' && /^\/head-office\/(?!reports$|days$|report-builder$|sites$|more$|stock(\/|$)|ordering$|menu$|safety$|maintenance$|records$)[^/]+(\/|$)/.test(pathname)) return true;
    if (path === '/head-office/stock') return pathname.startsWith(path);
    if (path !== pathname) return false;
    if (path === '/head-office/reports') return !saved;
    return h ? hash === `#${h}` : !hash;
  };

  // Phones: one tab lights up. Today covers the group page and each site; Days and Reports their pages;
  // everything else lives under More.
  const phoneTab = pathname === '/head-office' || isOn('/head-office#sites') ? 'Today'
    : pathname === '/head-office/days' ? 'Days'
    : pathname === '/head-office/reports' && !saved ? 'Reports'
    : 'More';

  const settingsOn = pathname === '/head-office/more' || HO_GROUPS.find((g) => g.title === 'Settings')!.items.some((l) => l.on?.(pathname));

  return (
    <div className="ho-shell">
      {wide && rail && <nav className="ho-side rail" aria-label="Head office">
        <button type="button" className="rail-logo" data-rail-toggle aria-expanded={false} aria-label="Expand sidebar" title={`Expand sidebar (${shortcut})`} onClick={toggleRail}>
          <span className="rail-m" aria-hidden="true">M</span><span className="rail-pane"><Icon d={PANE_ICON} size={20} /></span>
        </button>
        {/* Icons only, in the sidebar's sections (Settings at the foot). Each keeps its name for screen readers and as a tooltip. */}
        {/* Only the links scroll on a short window, so the name menu at the foot can still open out beside the rail. */}
        <div className="rail-links">
        {HO_GROUPS.slice(0, 3).map((g, i) => (
          <div key={g.title} className="rail-grp" role="group" aria-label={g.title}>
            {i > 0 && <span className="rail-div" aria-hidden="true" />}
            {g.items.map((l) => {
              const on = l.on ? l.on(pathname) : isOn(l.to);
              const st = opsTones?.[l.to];
              const name = l.to === '/head-office' && inToday ? `${l.label}, ${inToday}` : st ? `${l.label}, ${TONE_WORDS[st.tone]}: ${st.note}` : l.label;
              return (
                <Link key={l.to} to={l.to} className={`ri${on ? ' on' : ''}`} aria-label={name} title={name} aria-current={on ? 'page' : undefined}
                  data-tour={l.to === '/head-office/days' ? 'ho-days' : undefined}>
                  <Icon d={l.icon} size={20} />
                  {st && <span className={`rail-dot ${st.tone}`} aria-hidden="true" />}
                </Link>
              );
            })}
          </div>
        ))}
        </div>
        <Link to="/head-office/more" className={`ri${settingsOn ? ' on' : ''}`} aria-label="Settings" title="Settings" aria-current={settingsOn ? 'page' : undefined}>
          <Icon d={COG_ICON} size={20} />
        </Link>
        <div className="ho-me"><WhoMenu /></div>
      </nav>}
      {wide && !rail && <nav className="ho-side" aria-label="Head office">
        <div className="ho-brand-row">
          <div className="ho-brand"><span>Maginhawa · {SITES.length} sites</span><b>Head office</b></div>
          <button type="button" className="rail-btn" data-rail-toggle aria-expanded={true} aria-label="Collapse sidebar" title={`Collapse sidebar (${shortcut})`} onClick={toggleRail}>
            <Icon d={PANE_ICON} size={18} />
          </button>
        </div>
        <div className="ho-links">
          {/* Grouped like the site sidebar and the H3 board: tonight first, then the records, reports, and the group. */}
          {/* Each heading folds its section away. The section you're in stays open, so you never lose your place. */}
          {HO_GROUPS.map((g) => {
            const hasPage = g.items.some((l) => (l.on ? l.on(pathname) : isOn(l.to)));
            const open = hasPage || !folded.includes(g.title);
            const id = `ho-nav-${g.title}`;
            return (
              <div key={g.title} className={`ho-grp${open ? '' : ' folded'}`}>
                <button type="button" className="sgh" id={`${id}-h`} aria-expanded={open} aria-controls={id}
                  disabled={hasPage} title={hasPage ? "You're in this section" : undefined} onClick={() => toggle(g.title)}>
                  {g.title}
                  {!open && g.title === 'Operations' && opsCount ? <span className={`sgh-cnt${opsBad ? ' bad' : ''}`}><span aria-hidden="true">{opsCount}</span><span className="vh">, {opsCount} {opsCount === 1 ? 'needs' : 'need'} a look</span></span> : null}
                  <svg className="sgh-chev" width="10" height="10" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <div id={id} role="group" aria-labelledby={`${id}-h`} className="ho-grp-items" hidden={!open}>
                  {g.items.map((l) => {
                    const on = l.on ? l.on(pathname) : isOn(l.to);
                    return (
                      <Link key={l.to} to={l.to} className={`si${on ? ' on' : ''}`} data-tour={l.to === '/head-office/days' ? 'ho-days' : undefined} aria-current={on ? 'page' : undefined}>
                        <Icon d={l.icon} size={20} />{l.label}
                        {l.to === '/head-office' && inToday && <small>{inToday}</small>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="ho-me"><WhoMenu /></div>
      </nav>}
      <div className="ho-main">{children}</div>
      {!wide && <nav className="tabbar ho-tabs" aria-label="Head office">
        {PHONE_TABS.map((l) => {
          const on = phoneTab === l.label;
          return (
          <Link key={l.to} to={l.to} data-tour={l.label === 'Days' ? 'ho-days' : undefined} className={`tab${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined}>
            <Icon d={l.icon} size={22} />
            <span className="tab-l">{l.label}</span>
          </Link>
          );
        })}
      </nav>}
    </div>
  );
}
