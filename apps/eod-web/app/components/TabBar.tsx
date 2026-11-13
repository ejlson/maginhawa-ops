/** The bottom tab bar on the main phone screens: Today · Close · Checks · More. The selected tab wears the site colour. */
import { NavLink } from 'react-router';
import { canDoEod, useAuth } from '../lib/auth';
import { Icon } from './ui';
import { ICONS } from './ui-helpers';

const TABS = [
  { to: '/', label: 'Today', icon: ICONS.home, end: true },
  { to: '/close', label: 'Close', icon: ICONS.list, end: false },
  { to: '/checklists', label: 'Checks', icon: ICONS.check, end: false },
  { to: '/more', label: 'More', icon: ICONS.grid, end: false },
] as const;

export function TabBar() {
  const { user } = useAuth();
  const tabs = TABS.filter((t) => t.to !== '/close' || (user && canDoEod(user)));
  return (
    <nav className="tabbar" aria-label="Main" data-tour="tabs">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>
          <span className="pillbg"><Icon d={t.icon} size={22} /></span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
