/**
 * Switching site. Managers who work at more than one site pick between theirs; head office, once
 * they've opened a site, can jump to any open site or go back to head office. Managers with two or
 * more sites also get "My sites", tonight at all of theirs. In the sidebar it's
 * a menu under the site name; on phones the site name at the top opens a sheet. Someone with one
 * site can still tap the name: the same menu shows their one site and says head office adds more. Design: design/eod-canvas/s01–s03 and a05.
 */
import { useEffect, useRef, useState } from 'react';
import { SiteMono, useSiteColourChoices } from '../lib/site-colours';
import { service } from '../lib/service';
import { now } from '../lib/clock';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import { SECTION_KEYS, sectionStatus, siteName, SITES, type EodDraft, type StoredReport } from '@maginhawa/core';
import { useAuth, useHasMySites, useMySites } from '../lib/auth';
import { formatDay, useDraft } from '../lib/draft';
import { isOverdue, useChecklists } from '../lib/checklists';
import { deviceStore } from '../lib/store';
import { showExampleData } from '../lib/config';
import { demoReports } from '../lib/demo';
import { Chevron, Icon } from './ui';
import { ICONS } from './ui-helpers';
import { tour } from '../lib/tour';
import { useCanSwitch } from './site-picker-helpers';

const nameOf = siteName;
const HO_ICON = 'M3 17V8l7-4 7 4v9M8 17v-5h4v5';
const UPDOWN = 'M6 7l3-3 3 3M6 11l3 3 3-3';

/** The last switch, so the next site's screens can offer a way back. Lives until it's shown once. */
let lastSwitch: { from: string; to: string } | null = null;

/** Tonight's EOD at each site, for the line under each name. */
function useTonight(date: string): Map<string, StoredReport> {
  const [reports, setReports] = useState<Map<string, StoredReport>>(new Map());
  useEffect(() => {
    let live = true;
    void deviceStore().listByDate(date).then((real) => {
      const examples = showExampleData() ? demoReports(date, new Set(real.map((r) => r.draft.siteCode))) : [];
      if (live) setReports(new Map([...real, ...examples].map((r) => [r.draft.siteCode, r])));
    });
    return () => { live = false; };
  }, [date]);
  return reports;
}

/** The site name: in the sidebar (desktop and iPad) or the top bar (phones). A button, with a chevron when there's somewhere to switch to. */
export function SitePicker({ place, title }: { place: 'side' | 'top'; title?: string }) {
  const { user } = useAuth();
  const { settings, draft } = useDraft();
  const canSwitch = useCanSwitch();
  // One site: no chevron, but a tap still says why there's nowhere to go. Head office on its own overview just sees the name.
  const tappable = canSwitch || Boolean(user && user.role !== 'headoffice');
  const tourId = canSwitch ? 'site' : undefined;
  const label = canSwitch ? 'Switch site' : 'Your site';
  const [open, setOpen] = useState(false);
  // The sidebar scrolls, which would clip the menu, so it's placed against the window under the name.
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const day = formatDay(draft.businessDate, { weekday: 'short', day: 'numeric', month: 'short' });
  const dayLine = `${user?.inSite ? 'Head office · ' : ''}${day}${service(now(), settings.timezone).replace(' service', '')}`;

  useEffect(() => {
    if (!open || place !== 'side') return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open, place]);

  if (place === 'side') {
    // D1: the site as a small white card: badge, name, the trading day, and the switch chevron.
    const card = <><SiteMono code={settings.siteCode} /><span className="sitecard-tx"><b>{title ?? settings.siteName}</b><small>{dayLine}</small></span></>;
    if (!tappable) return <div className="sitecard">{card}</div>;
    return (
      <div className="sitepick" ref={box} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
        <button type="button" className="sitecard" data-tour={tourId} aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}. Now ${settings.siteName}, ${dayLine}`} onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt({ top: r.bottom + 8, left: r.left });
          setOpen(!open);
        }}>
          {card}{canSwitch && <Icon d={UPDOWN} size={16} />}
        </button>
        {open && <div className="sitepop" role="dialog" aria-label={label} style={at ?? undefined}><SiteList onDone={() => setOpen(false)} /></div>}
      </div>
    );
  }

  if (!tappable) return <span className="title sitetitle"><SiteMono code={settings.siteCode} size="sm" />{settings.siteName}</span>;
  return <>
    <button type="button" className="title sitetitle" data-tour={tourId} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <SiteMono code={settings.siteCode} size="sm" />{settings.siteName}{canSwitch && <Icon d="M4.5 7l4.5 4.5L13.5 7" size={16} />}
    </button>
    {/* Drawn at the page root: the top bar's blur would otherwise hold the sheet inside the bar. */}
    {open && createPortal(
      <div className="sheet-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div className="tsheet ssheet" role="dialog" aria-modal="true" aria-labelledby="site-sheet-t" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
          <span className="sheet-grab" aria-hidden="true" />
          <div className="tsheet-hd">
            <span className="tx"><span id="site-sheet-t">{canSwitch ? 'Switch site' : 'Your site'}</span></span>
            <button type="button" className="sheet-x" aria-label="Close" onClick={() => setOpen(false)}><Icon d={ICONS.x} size={14} /></button>
          </div>
          <SiteList onDone={() => setOpen(false)} />
        </div>
      </div>,
      document.body,
    )}
  </>;
}

function SiteList({ onDone }: { onDone: () => void }) {
  const { user, switchSite, leaveSite } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { draft, progress } = useDraft();
  const { tasks } = useChecklists();
  const mine = useMySites();
  const overview = useHasMySites();
  const tonight = useTonight(draft.businessDate);
  const [q, setQ] = useState('');
  const { colourOf } = useSiteColourChoices();
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  if (!user) return null;

  const ho = user.role === 'headoffice';
  const late = tasks.filter(isOverdue).length;
  const status = (code: string): { text: string; tone: string } => {
    if (code === user.siteCode) {
      const eod = progress.left === 0 && progress.active > 0 ? 'EOD ready' : `EOD ${progress.done} of ${progress.active}`;
      return late ? { text: `${eod} · ${late} ${late === 1 ? 'checklist' : 'checklists'} late`, tone: 'bad' } : { text: eod, tone: '' };
    }
    const r = tonight.get(code);
    if (!r) return { text: 'EOD not started', tone: ho ? 'warn' : '' };
    if (r.status === 'draft') return { text: 'EOD in progress', tone: '' };
    return { text: r.status === 'approved' ? 'EOD approved' : 'EOD sent', tone: 'ok' };
  };
  // How much of tonight's close is done, as a ring (P2): this site from its draft, others from their saved report.
  const doneOf = (d: EodDraft | undefined) => {
    if (!d) return { done: 0, of: SECTION_KEYS.length };
    const active = SECTION_KEYS.filter((k) => sectionStatus(d, k) !== 'skipped');
    return { done: active.filter((k) => sectionStatus(d, k) === 'done').length, of: active.length };
  };
  const ringOf = (code: string) => {
    if (code === user.siteCode) return { done: progress.done, of: progress.active };
    const rep = tonight.get(code);
    return rep && rep.status !== 'draft' ? { done: SECTION_KEYS.length, of: SECTION_KEYS.length } : doneOf(rep?.draft);
  };
  const shown = mine.filter((c) => !q.trim() || nameOf(c).toLowerCase().includes(q.trim().toLowerCase()));

  const pick = (code: string) => {
    onDone();
    if (code === user.siteCode) return;
    lastSwitch = { from: user.siteCode, to: code };
    tour.did(user, 'switch');
    switchSite(code);
    // Stay on the same kind of screen (Checklists, EOD…), not a page that belongs to the old site.
    navigate(`/${pathname.split('/')[1] ?? ''}`);
  };

  return (
    <div className="sitelist">
      {ho && <>
        <button ref={first} type="button" className="menuitem" onClick={() => { onDone(); leaveSite(); navigate('/head-office'); }}>
          <span className="av"><Icon d={HO_ICON} size={18} /></span>
          <span className="tx"><span>Back to head office</span><small>All {SITES.length} sites</small></span>
        </button>
        <div className="menusep" role="separator" />
      </>}
      {(ho || mine.length > 3) && (
        <label className="sitefind">
          <Icon d="M8.5 3.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12.2 12.2L16.5 16.5" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a site" aria-label="Find a site" />
        </label>
      )}
      {overview && <>
        <button ref={first} type="button" className="menuitem allsites" onClick={() => { onDone(); navigate('/my-sites'); }}>
          <span className="allsites-grid" aria-hidden="true">{mine.slice(0, 4).map((c) => <i key={c} style={{ background: colourOf(c).hex }} />)}</span>
          <span className="tx"><span>All my sites</span><small>Tonight at your {mine.length} sites, side by side</small></span>
          <Chevron />
        </button>
      </>}
      <div className="menuhead">{ho ? 'Sites' : mine.length > 1 ? 'Your sites' : 'Your site'}</div>
      <div className="siteopts" role="listbox" aria-label="Sites">
        {shown.map((code, i) => {
          const st = status(code);
          const on = code === user.siteCode;
          return (
            <button key={code} ref={!ho && !overview && i === 0 ? first : undefined} type="button" role="option" aria-selected={on} className="menuitem" onClick={() => pick(code)}>
              <SiteMono code={code} size="lg" />
              <span className="tx"><span>{nameOf(code)}{on && <span className="here">You're here</span>}</span><small className={st.tone}>{st.text}</small></span>
              <SiteRing {...ringOf(code)} colour={colourOf(code).hex} />
            </button>
          );
        })}
        {!shown.length && <p className="sitenone">No site called “{q.trim()}”.</p>}
      </div>
      {!ho && (mine.length > 1
        ? <p className="sitefoot">Circles show how much of tonight's close is done. Head office sets which sites you work at.</p>
        : <p className="sitefoot">You only work at {nameOf(user.siteCode)} for now. To work at another site too, ask head office to add it to your profile in People.</p>)}
    </div>
  );
}

/** How much of tonight's close is done at a site, as a small ring in its colour (P2). */
function SiteRing({ done, of, colour }: { done: number; of: number; colour: string }) {
  const frac = of ? done / of : 0;
  return (
    <svg className="sitering" width="26" height="26" viewBox="0 0 26 26" role="img" aria-label={`${done} of ${of} sections done`}>
      <circle cx="13" cy="13" r="10" fill="none" strokeWidth="3" className="sitering-track" />
      <circle cx="13" cy="13" r="10" fill="none" strokeWidth="3" strokeLinecap="round" style={{ stroke: colour }} pathLength={100} strokeDasharray={`${frac * 100} 100`} strokeOpacity={frac ? 1 : 0} transform="rotate(-90 13 13)" />
    </svg>
  );
}

/** “Now in Guanabana · Back to Bunso”, once, just after a switch. */
export function SwitchToast() {
  const { user, switchSite } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [shown, setShown] = useState(() => (lastSwitch && lastSwitch.to === user?.siteCode ? lastSwitch : null));
  useEffect(() => {
    lastSwitch = null;
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 6000);
    return () => clearTimeout(t);
  }, [shown]);
  if (!shown) return null;
  return (
    <div className="toast" role="status">
      <span>Now in {nameOf(shown.to)}</span>
      <button type="button" onClick={() => { setShown(null); switchSite(shown.from); navigate(`/${pathname.split('/')[1] ?? ''}`); }}>Back to {nameOf(shown.from)}</button>
    </div>
  );
}

/** Head office inside a site: always say so, and the way back. One line, so phones keep their screen for the work. */
export function InSiteBar() {
  const { user, leaveSite } = useAuth();
  const { settings } = useDraft();
  const navigate = useNavigate();
  if (!user?.inSite) return null;
  return (
    <div className="insite" role="status">
      <Icon d={HO_ICON} size={16} />
      <span className="insite-t">Viewing <b>{settings.siteName}</b> as head office<span className="insite-x"> · changes are saved under your name</span></span>
      <button type="button" className="linkbtn" aria-label="Exit to head office" onClick={() => { leaveSite(); navigate('/head-office'); }}>Exit</button>
    </div>
  );
}
