/** The bottom tab bar on the three main screens, so you always know where you are. */
import { NavLink } from 'react-router';
import { Icon, ICONS } from './ui';

const TABS = [
  { to: '/', label: 'Home', icon: ICONS.home, end: true },
  { to: '/checklists', label: 'Checklists', icon: ICONS.check, end: false },
  { to: '/close', label: 'EOD', icon: ICONS.list, end: false },
] as const;

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>
          <Icon d={t.icon} size={22} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
