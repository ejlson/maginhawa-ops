/**
 * The frame for site roles (staff, supervisors, managers) on desktop and iPad: a sidebar with the
 * site and trading day, the main screens, and, while closing the day, every EOD section with its
 * progress circle. Phones keep the bottom tab bar; the sidebar is hidden below 900px.
 */
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { formatPounds, SECTION_LABELS, sectionStatus, type SectionKey } from '@maginhawa/core';
import { can, useAuth } from '../lib/auth';
import { formatDay, useDraft } from '../lib/draft';
import { Icon, ICONS, Pie } from './ui';
import { useWide } from '../lib/wide';
import { useChecklists } from '../lib/checklists';
import { useSite } from '../lib/site';
import { useFoodSafety } from '../lib/food-safety';
import { attentionFor } from '../lib/food-safety-attention';
import { now } from '../lib/clock';
import { WhoMenu } from './home/WhoMenu';
import { CommandMenu, useCommandMenu } from './CommandMenu';

export const EOD_SALES: SectionKey[] = ['lunch', 'dinner', 'delivery', 'promotions'];
export const EOD_TEAM: SectionKey[] = ['wages', 'tips', 'feedback', 'handover'];

export function SiteShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { draft, settings, progress } = useDraft();
  const wide = useWide();
  const counts = useCounts();
  const menu = useCommandMenu();
  if (!user || !wide) return <>{children}</>;

  const links = [
    { to: '/', label: 'Home', icon: ICONS.home, on: pathname === '/' },
    { to: '/day', label: 'Timeline', icon: ICONS.clock, on: pathname === '/day' },
    { to: '/checklists', label: 'Checklists', icon: ICONS.check, on: pathname.startsWith('/checklists'), badge: counts.checklists },
    ...(can.doEod(user.role) ? [{ to: '/close', label: "Today's EOD", icon: ICONS.list, on: pathname.startsWith('/close'), meta: `${progress.done} of ${progress.active}` }] : []),
    ...(can.fixRepairs(user.role) ? [{ to: '/repairs', label: 'Repairs', icon: ICONS.wrench, on: pathname.startsWith('/repairs'), badge: counts.repairs }] : []),
    { to: '/handover', label: 'Handover', icon: ICONS.handover, on: pathname.startsWith('/handover'), badge: counts.handover },
    { to: '/food-safety', label: 'Food safety', icon: ICONS.thermo, on: pathname.startsWith('/food-safety'), badge: counts.foodSafety },
  ];
  const inEod = pathname.startsWith('/close') && can.doEod(user.role);

  return (
    <div className="ho-shell site-shell">
      <nav className="ho-side" aria-label="Main">
        <div className="ho-brand"><span>{settings.siteName} · {formatDay(draft.businessDate, { weekday: 'short', day: 'numeric', month: 'short' })}</span><b>{inEod ? "Today's close" : settings.siteName}</b></div>
        <button type="button" className="ho-search" onClick={() => menu.setOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          Search or jump to<span className="kbd">⌘K</span>
        </button>
        <div className="ho-links">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={`si${l.on ? ' on' : ''}`} aria-current={l.on ? 'page' : undefined}>
              <Icon d={l.icon} size={20} />{l.label}{'meta' in l && l.meta && <small>{l.meta}</small>}{'badge' in l && l.badge && <Badge b={l.badge} />}
            </Link>
          ))}
        </div>
        {inEod && <EodSections />}
        {/* Switch person, staff PINs, sign out (and, in demo mode, see the app as another role). */}
        <div className="ho-me"><WhoMenu /></div>
      </nav>
      <div className="ho-main">{children}</div>
      {menu.open && <CommandMenu onClose={() => menu.setOpen(false)} />}
    </div>
  );
}

/** What each sidebar item is waiting on: a red count when something is late or urgent, an orange dot when it needs a look. */
type Count = { n: number; level: 'bad' | 'warn'; label: string } | null;

function useCounts(): Record<'checklists' | 'repairs' | 'handover' | 'foodSafety', Count> {
  const { user } = useAuth();
  const { tasks, businessDate } = useChecklists();
  const { open, handover, handoverRead } = useSite();
  const { site, data, siteCode } = useFoodSafety();
  const late = tasks.filter((t) => t.status === 'late' || t.status === 'missed').length;
  const due = tasks.filter((t) => t.status === 'due').length;
  const urgent = open.filter((r) => r.urgent).length;
  const fs = user ? attentionFor(site, data, siteCode, { today: businessDate, now: now(), role: user.role, person: user.name }) : [];
  const fsBad = fs.some((i) => i.level === 'bad');
  return {
    checklists: late ? { n: late, level: 'bad', label: `${late} late or missed` } : due ? { n: due, level: 'warn', label: `${due} due now` } : null,
    repairs: urgent ? { n: urgent, level: 'bad', label: `${urgent} urgent` } : open.length ? { n: open.length, level: 'warn', label: `${open.length} open` } : null,
    handover: handover.length && !handoverRead ? { n: 0, level: 'warn', label: 'Not read yet' } : null,
    foodSafety: fs.length ? { n: fs.length, level: fsBad ? 'bad' : 'warn', label: `${fs.length} need${fs.length === 1 ? 's' : ''} you` } : null,
  };
}

function Badge({ b }: { b: Count }) {
  if (!b) return null;
  return b.n ? <span className={`cnt ${b.level}`} aria-label={b.label}>{b.n}</span> : <span className="cdot" role="img" aria-label={b.label} />;
}

/** Every EOD section with its Things-style circle, so you can jump between them. */
function EodSections() {
  const { pathname } = useLocation();
  const { draft, result, status } = useDraft();
  const locked = status === 'submitted' || status === 'approved';
  const amount = (k: SectionKey) => {
    if (sectionStatus(draft, k) !== 'done') return null;
    if (k === 'lunch' || k === 'dinner') return formatPounds(result.sessions[k].net);
    if (k === 'delivery') return formatPounds(result.deliveryNet);
    return null;
  };
  const group = (title: string, keys: SectionKey[]) => (
    <div className="eod-side-grp">
      <div className="sg">{title}</div>
      {keys.map((k) => {
        const st = sectionStatus(draft, k);
        const on = pathname === `/close/${k}` || pathname.startsWith(`/close/${k}/`);
        const inner = <><Pie status={st} size={20} /><span className={st === 'skipped' ? 'muted' : ''}>{SECTION_LABELS[k]}</span>{amount(k) && <small>{amount(k)}</small>}</>;
        return locked || st === 'skipped'
          ? <span key={k} className="si off">{inner}</span>
          : <Link key={k} to={`/close/${k}`} className={`si${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined}>{inner}</Link>;
      })}
    </div>
  );
  return (
    <div className="eod-side" aria-label="EOD sections">
      {group('Sales', EOD_SALES)}
      {group('Team & notes', EOD_TEAM)}
      {!locked && <Link to="/close/review" className={`si${pathname === '/close/review' ? ' on' : ''}`}><Icon d={ICONS.check} size={20} />Review and submit</Link>}
    </div>
  );
}
