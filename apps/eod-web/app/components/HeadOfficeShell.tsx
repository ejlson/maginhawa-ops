/**
 * Head office's frame: a sidebar on desktop and iPad, a bottom tab bar on phones. Sites and Trends are
 * sections of the Head office page for now, so they scroll to it.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { SITES } from '@maginhawa/core';
import { Icon } from './ui';
import { ICONS } from './ui-helpers';
import { useWide } from '../lib/wide';
import { WhoMenu } from './home/WhoMenu';

const SEARCH = 'M8.5 3.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12.2 12.2L16.5 16.5';
const SITES_ICON = 'M3 17V8l7-4 7 4v9M8 17v-5h4v5';
const BUILDER_ICON = 'M3 4h5v5H3zM12 11h5v5h-5zM8 6.5h2.5a1.5 1.5 0 0 1 1.5 1.5v3';

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
  { to: '/head-office/ordering', label: 'Ordering and waste', icon: ICONS.box },
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
  ] },
];

/** Which sidebar sections are folded away, remembered on this device. */
const FOLDED_KEY = 'mgh.ho-nav.folded.v1';
function useFolded() {
  const [folded, setFolded] = useState<string[]>(() => {
    try { const v = JSON.parse(localStorage.getItem(FOLDED_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
  });
  const toggle = (title: string) => setFolded((f) => {
    const next = f.includes(title) ? f.filter((x) => x !== title) : [...f, title];
    try { localStorage.setItem(FOLDED_KEY, JSON.stringify(next)); } catch { /* storage off: still folds for now */ }
    return next;
  });
  return { folded, toggle };
}

export function HeadOfficeShell({ inToday, children }: { inToday?: string; children: ReactNode }) {
  const { pathname, hash, search } = useLocation();
  const saved = new URLSearchParams(search).get('saved');
  const wide = useWide();
  const { folded, toggle } = useFolded();

  // Sites and Trends are on the Head office page: scroll to them once it has drawn.
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [pathname, hash]);

  const isOn = (to: string) => {
    const [path, h] = to.split('#');
    if (path === '/head-office' && h === 'sites' && /^\/head-office\/(?!reports$|days$|report-builder$|sites$|stock(\/|$)|ordering$|menu$|safety$|maintenance$|records$)[^/]+(\/|$)/.test(pathname)) return true;
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

  return (
    <div className="ho-shell">
      {wide && <nav className="ho-side" aria-label="Head office">
        <div className="ho-brand"><span>Maginhawa · {SITES.length} sites</span><b>Head office</b></div>
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
                  {g.title}<svg className="sgh-chev" width="10" height="10" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
