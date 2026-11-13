/**
 * Head office's frame: a sidebar on desktop and iPad, a bottom tab bar on phones. Sites and Trends are
 * sections of the Head office page for now, so they scroll to it. Saved searches open Reports pre-filtered.
 */
import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { SITES } from '@maginhawa/core';
import { Icon } from './ui';
import { ICONS } from './ui-helpers';
import { useWide } from '../lib/wide';
import { WhoMenu } from './home/WhoMenu';

const SEARCH = 'M8.5 3.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12.2 12.2L16.5 16.5';
const SITES_ICON = 'M3 17V8l7-4 7 4v9M8 17v-5h4v5';
const BUILDER_ICON = 'M3 4h5v5H3zM12 11h5v5h-5zM8 6.5h2.5a1.5 1.5 0 0 1 1.5 1.5v3';

const LINKS = [
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

/** Fixed presets for now. Each person's own saved searches need storing in SharePoint first. */
const SAVED_SEARCHES = [
  { id: 'wages', label: 'Wages 30% or more, last 30 days' },
  { id: 'cash', label: 'Cash short or over, last 30 days' },
  { id: 'refund', label: 'Refunds, any date' },
] as const;

export function HeadOfficeShell({ inToday, children }: { inToday?: string; children: ReactNode }) {
  const { pathname, hash, search } = useLocation();
  const saved = new URLSearchParams(search).get('saved');
  const wide = useWide();

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

  return (
    <div className="ho-shell">
      {wide && <nav className="ho-side" aria-label="Head office">
        <div className="ho-brand"><span>Maginhawa · {SITES.length} sites</span><b>Head office</b></div>
        <div className="ho-links">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className={`si${isOn(l.to) ? ' on' : ''}`} data-tour={l.label === 'Days' ? 'ho-days' : undefined} aria-current={isOn(l.to) ? 'page' : undefined}>
              <Icon d={l.icon} size={20} />{l.label === 'Trends' ? 'Trends & forecast' : l.label === 'Days' ? 'Checklists & EODs' : l.label}
              {l.label === 'Today' && inToday && <small>{inToday}</small>}
            </Link>
          ))}
          <Link to="/people" className={`si${pathname.startsWith('/people') ? ' on' : ''}`} aria-current={pathname.startsWith('/people') ? 'page' : undefined}>
            <Icon d={ICONS.people} size={20} />People
          </Link>
          <Link to="/head-office/report-builder" className="si">
            <Icon d={BUILDER_ICON} size={20} />Report builder
          </Link>
          <Link to="/head-office/sites" className={`si${pathname === '/head-office/sites' ? ' on' : ''}`} aria-current={pathname === '/head-office/sites' ? 'page' : undefined}>
            <Icon d={ICONS.palette} size={20} />Sites and colours
          </Link>
        </div>
        <div className="ho-saved">
          <span>Saved searches</span>
          {SAVED_SEARCHES.map((s) => (
            <Link key={s.id} to={`/head-office/reports?saved=${s.id}`} className={saved === s.id ? 'on' : ''} aria-current={saved === s.id ? 'page' : undefined}>{s.label}</Link>
          ))}
        </div>
        <div className="ho-me"><WhoMenu /></div>
      </nav>}
      <div className="ho-main">{children}</div>
      {!wide && <nav className="tabbar ho-tabs" aria-label="Head office">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end data-tour={l.label === 'Days' ? 'ho-days' : undefined} className={() => `tab${isOn(l.to) ? ' on' : ''}`}>
            <span className="pillbg"><Icon d={l.icon} size={22} /></span>
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>}
    </div>
  );
}
