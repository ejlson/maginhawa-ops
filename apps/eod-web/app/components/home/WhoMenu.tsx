/**
 * The name menu at the top right, for every role. On the shared iPad it lists the people who use it
 * (one tap to their PIN). In demo mode it switches role on the spot. Managers reach staff PINs, and
 * everyone can sign out. Closes on Escape, on a tap outside, or after a choice.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { hasLeft, SITES, tradingDate } from '@maginhawa/core';
import { can, homeFor, recentPeople, ROLE_LABELS, useAuth, type Role } from '../../lib/auth';
import { isConnected, isSharedDev } from '../../lib/config';
import { pins } from '../../lib/pins';
import { resetDemoChecklists, resetDemoEod } from '../../lib/store';
import { people } from '../../lib/people';
import { settingsFor } from '../../lib/draft';
import { now } from '../../lib/clock';
import { Icon, ICONS } from '../ui';

export function WhoMenu() {
  const navigate = useNavigate();
  const { user, signIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus();
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!user) return null;
  const shared = user.role === 'staff';
  const others = shared ? recentPeople(user.siteCode).filter((p) => p.name !== user.name && p.role === 'staff' && !hasLeft(people.at(user.siteCode), user.siteCode, p.name)).slice(0, 5) : [];
  const site = SITES.find((s) => s.code === user.siteCode)?.name ?? user.siteCode;
  const go = (to: string) => { setOpen(false); navigate(to); };
  const asRole = (r: Role) => { setOpen(false); if (r !== user.role) { signIn({ ...user, role: r }); navigate(homeFor(r)); } };
  // Demo mode: start today's checklists again, to try them from scratch.
  const resetChecklists = () => {
    setOpen(false);
    resetDemoChecklists(user.siteCode, tradingDate(now(), settingsFor(user.siteCode)));
    window.location.reload();
  };
  const resetEod = () => {
    setOpen(false);
    resetDemoEod(user.siteCode, tradingDate(now(), settingsFor(user.siteCode)));
    window.location.reload();
  };

  return (
    <div className="whomenu" ref={box}>
      <button type="button" className="who" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}
        aria-label={shared ? `${user.name} is using this device. Switch person` : `Signed in as ${user.name}. Menu`}>
        <span className="av ink" style={{ width: 30, height: 30, fontSize: 11 }}>{user.initials}</span>{user.name}
        <svg className="caret" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
      </button>
      {open && (
        <div className="menu" role="menu" aria-label={shared ? "Who's using the iPad" : 'Your account'}>
          {shared ? <>
            <div className="menuhead">Using the iPad</div>
            <button ref={firstItem} type="button" role="menuitem" className="menuitem" onClick={() => setOpen(false)}>
              <span className="av ink">{user.initials}</span><span className="tx"><span>{user.name}</span><small>Using it now</small></span>
              <Icon d={ICONS.check} size={18} />
            </button>
            {others.map((p) => (
              <button key={p.name} type="button" role="menuitem" className="menuitem" onClick={() => go(`/switch?who=${encodeURIComponent(p.name)}`)}>
                <span className="av">{p.initials}</span><span className="tx"><span>{p.name}</span>{!pins.has(user.siteCode, p.name) && <small>No PIN yet</small>}</span>
              </button>
            ))}
            <button type="button" role="menuitem" className="menuitem" onClick={() => go('/switch')}>
              <span className="av dash"><Icon d={ICONS.plus} size={16} /></span><span className="tx"><span>Someone else…</span></span>
            </button>
          </> : (
            <button ref={firstItem} type="button" role="menuitem" className="menuitem" onClick={() => go('/account')}>
              <span className="av ink">{user.initials}</span><span className="tx"><span>{user.name}</span><small>{ROLE_LABELS[user.role]} · {user.role === 'headoffice' ? 'All sites' : site}</small></span>
            </button>
          )}

          {!isConnected() && <>
            <div className="menusep" role="separator" />
            <div className="menuhead">See the app as</div>
            {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => (
              <button key={r} type="button" role="menuitemradio" aria-checked={user.role === r} className="menuitem small plain" onClick={() => asRole(r)}>
                {label}{user.role === r && <Icon d={ICONS.check} size={18} />}
              </button>
            ))}
            {user.role !== 'headoffice' && !isSharedDev() && <>
              <div className="menusep" role="separator" />
              <button type="button" role="menuitem" className="menuitem small" onClick={resetChecklists}>
                <span className="tx"><span>Reset today's checklists</span><small>Demo only. Clears {site}'s answers for today</small></span>
              </button>
              {can.doEod(user.role) && (
                <button type="button" role="menuitem" className="menuitem small" onClick={resetEod}>
                  <span className="tx"><span>Reset today's EOD</span><small>Demo only. Clears {site}'s figures for today, even if sent</small></span>
                </button>
              )}
            </>}
          </>}

          <div className="menusep" role="separator" />
          {(user.role === 'manager' || user.role === 'headoffice') && (
            <button type="button" role="menuitem" className="menuitem small" onClick={() => go('/people')}>People</button>
          )}
          <button type="button" role="menuitem" className="menuitem small" style={{ color: 'var(--bad)' }} onClick={() => { setOpen(false); signOut(); navigate('/sign-in'); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}
