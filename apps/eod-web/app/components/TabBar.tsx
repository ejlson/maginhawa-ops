/**
 * The bottom tab bar on the main phone screens: Today · EOD · Checklists · More.
 * A floating capsule of icons. The selected tab shows its name in a site-coloured pill; the others keep
 * their names for screen readers. A red dot on Checklists means one is late or missed.
 */
import { Link, useLocation } from 'react-router';
import { canDoEod, useAuth } from '../lib/auth';
import { isOverdue, useChecklists } from '../lib/checklists';
import { Icon } from './ui';
import { ICONS } from './ui-helpers';

const TABS = [
  { to: '/', label: 'Today', icon: ICONS.home, end: true },
  { to: '/close', label: 'EOD', icon: ICONS.list, end: false },
  { to: '/checklists', label: 'Checklists', icon: ICONS.check, end: false },
  { to: '/more', label: 'More', icon: ICONS.grid, end: false },
] as const;

export function TabBar() {
  const { user } = useAuth();
  const { tasks } = useChecklists();
  const overdue = tasks.filter(isOverdue).length;
  const { pathname } = useLocation();
  // Everything that opens from More (Stock, Health and safety, Recipes…) keeps More lit, as on the boards.
  const inMore = !['/', '/close', '/checklists'].some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)));
  const isOn = (to: string) => (to === '/' ? pathname === '/' : to === '/more' ? pathname.startsWith('/more') || inMore : pathname.startsWith(to));
  const tabs = TABS.filter((t) => t.to !== '/close' || (user && canDoEod(user)));
  return (
    <nav className="tabbar" aria-label="Main" data-tour="tabs">
      {tabs.map((t) => (
        <Link key={t.to} to={t.to} className={`tab${isOn(t.to) ? ' on' : ''}`} aria-current={isOn(t.to) ? 'page' : undefined}>
          <Icon d={t.icon} size={22} />
          <span className="tab-l">{t.label}</span>
          {t.to === '/checklists' && overdue > 0 && <><span className="vh">, {overdue} late or missed</span><span className="tab-dot" aria-hidden="true" /></>}
        </Link>
      ))}
    </nav>
  );
}
