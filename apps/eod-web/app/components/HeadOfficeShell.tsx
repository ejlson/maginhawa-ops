/**
 * Head office's frame: a sidebar on desktop and iPad, a bottom tab bar on phones. Sites and Trends are
 * sections of the Head office page for now, so they scroll to it. Saved searches open Reports pre-filtered.
 */
import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { SITES } from '@maginhawa/core';
import { Icon, ICONS } from './ui';
import { useWide } from '../lib/wide';
import { WhoMenu } from './home/WhoMenu';

const SEARCH = 'M8.5 3.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12.2 12.2L16.5 16.5';
const SITES_ICON = 'M3 17V8l7-4 7 4v9M8 17v-5h4v5';

const LINKS = [
  { to: '/head-office', label: 'Today', icon: ICONS.home },
  { to: '/head-office#sites', label: 'Sites', icon: SITES_ICON },
  { to: '/head-office/reports', label: 'Reports', icon: SEARCH },
  { to: '/head-office#trends', label: 'Trends', icon: ICONS.chart },
  { to: '/food-safety', label: 'Food safety', icon: ICONS.thermo },
] as const;

/** Fixed presets for now. Each person's own saved searches need storing in SharePoint first. */
export const SAVED_SEARCHES = [
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
    if (path === '/head-office' && h === 'sites' && /^\/head-office\/(?!reports)[^/]+$/.test(pathname)) return true;
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
            <Link key={l.to} to={l.to} className={`si${isOn(l.to) ? ' on' : ''}`} aria-current={isOn(l.to) ? 'page' : undefined}>
              <Icon d={l.icon} size={20} />{l.label === 'Trends' ? 'Trends & forecast' : l.label}
              {l.label === 'Today' && inToday && <small>{inToday}</small>}
            </Link>
          ))}
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
          <NavLink key={l.to} to={l.to} end className={() => `tab${isOn(l.to) ? ' on' : ''}`}>
            <Icon d={l.icon} size={22} />
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>}
    </div>
  );
}
