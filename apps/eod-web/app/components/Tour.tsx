/**
 * The first-run tour (design: design/tour-canvas). The first time someone is on Home, a welcome sheet
 * offers a one-minute tour. Each tip lights up a real control (found by its data-tour attribute) and
 * the light glides from one to the next. Controls that aren't on screen are left out. Skipping can be
 * undone, and Account can show it again. Also the one-off tips on new screens (FirstTimeTip).
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router';
import { SITES } from '@maginhawa/core';
import { homeOf, useAuth, type User } from '../lib/auth';
import { useDraft } from '../lib/draft';
import { showsTip, tour, tourAutoStarts, tourFor, useTourState, type TourStep } from '../lib/tour';
import { Icon } from './ui';
import { ICONS } from './ui-helpers';
import { findTarget, type Phase, type Box } from './tour-helpers';

const PAD = 8;
const GUTTER = 16;
const GAP = 14;
const PIE = 18.85; // circumference of the progress pie (r = 3)
const HELP = 'M7 6.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5M9 13h.01M9 16A7 7 0 1 0 9 2a7 7 0 0 0 0 14z';

const onScreen = (steps: TourStep[]) => steps.filter((s) => !s.target || findTarget(s.target));
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const nextFrame = (f: () => void): number => (typeof globalThis.requestAnimationFrame === 'function' ? requestAnimationFrame(f) : (setTimeout(f, 16) as unknown as number));
const cancelFrame = (id: number) => (typeof globalThis.cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

/** Mounted once for signed-in screens. Only ever opens on the person's Home. */
export function TourHost() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const t = useTourState(user);
  const [phase, setPhase] = useState<Phase>('idle');
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [i, setI] = useState(0);
  const [toast, setToast] = useState(false);
  const atHome = !!user && pathname === homeOf(user);
  const wanted = atHome && tourAutoStarts() && !t.seenAt;

  useEffect(() => { if (wanted && phase === 'idle') setPhase('welcome'); }, [wanted, phase]);
  // Leaving Home puts the tour away; it comes back next time they're on Home.
  useEffect(() => { if (!atHome) setPhase('idle'); }, [atHome]);
  // The welcome lists only the tips whose controls are on this screen.
  useEffect(() => { if (phase === 'welcome' && user) setSteps(onScreen(tourFor(user.role))); }, [phase, user]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(false), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  if (!user || typeof document === 'undefined') return null;
  const start = () => {
    const here = onScreen(tourFor(user.role));
    if (!here.length) { tour.markSeen(user); setPhase('idle'); return; }
    setSteps(here);
    setI(0);
    setPhase('tour');
  };
  const skip = () => { tour.markSeen(user); setPhase('idle'); setToast(true); };
  const go = (n: number) => {
    if (n >= steps.length) { tour.markSeen(user); setPhase('done'); return; }
    setI(Math.max(0, n));
  };

  return createPortal(
    <>
      {phase === 'welcome' && <Welcome user={user} steps={steps.length ? steps : tourFor(user.role)} onStart={start} onSkip={skip} />}
      {phase === 'tour' && steps[i] && <Spotlight steps={steps} i={i} onGo={go} onSkip={skip} />}
      {phase === 'done' && <Done onClose={() => setPhase('idle')} onAgain={() => setPhase('welcome')} />}
      {toast && (
        <div className="toast" role="status">
          <span>Tour hidden. It's in Account.</span>
          <button type="button" onClick={() => { setToast(false); tour.replay(user); }}>Undo</button>
        </div>
      )}
    </>,
    document.body,
  );
}

function useEscape(f: () => void) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') f(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });
}

function Welcome({ user, steps, onStart, onSkip }: { user: User; steps: TourStep[]; onStart: () => void; onSkip: () => void }) {
  const { settings } = useDraft();
  useEscape(onSkip);
  const first = user.name.trim().split(/\s+/)[0] ?? user.name;
  const who = user.role === 'headoffice' ? `You're head office, so you see all ${SITES.length} sites.`
    : user.role === 'staff' ? `You're on the team at ${settings.siteName}.`
    : `You're a ${user.role} at ${settings.siteName}.`;
  return (
    <div className="tour-back">
      <div className="tour-sheet" role="dialog" aria-modal="true" aria-labelledby="tour-welcome">
        <span className="tour-grab" aria-hidden="true" />
        <div className="tour-head">
          <h2 id="tour-welcome">Welcome, {first}</h2>
          <p>{who} Here's what's where. It takes about a minute.</p>
        </div>
        <div className="sub">
          {steps.map((s) => (
            <div key={s.id} className="li tour-row"><span className="av"><Icon d={ICONS[s.icon]} size={18} /></span><span className="tx"><span>{s.title}</span></span></div>
          ))}
        </div>
        <div className="tour-acts">
          <button type="button" className="btn b1" autoFocus onClick={onStart}>Show me around</button>
          <button type="button" className="btn b2" onClick={onSkip}>Skip for now</button>
        </div>
      </div>
    </div>
  );
}

function Spotlight({ steps, i, onGo, onSkip }: { steps: TourStep[]; i: number; onGo: (n: number) => void; onSkip: () => void }) {
  const step = steps[i]!;
  const last = i === steps.length - 1;
  const [rect, setRect] = useState<Box | null>(null);
  const [radius, setRadius] = useState(14);
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [tipH, setTipH] = useState(220);
  const tip = useRef<HTMLDivElement>(null);

  // Follow the control while the page scrolls or resizes. Demos that play on the control itself get a class.
  useLayoutEffect(() => {
    const el = step.target ? findTarget(step.target) : null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView?.({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
    const demo = step.demo === 'segs' ? 'tour-demo-segs' : null;
    if (demo) el.classList.add(demo);
    setRadius((parseFloat(getComputedStyle(el).borderTopLeftRadius) || 6) + PAD);
    let id = 0;
    let seen = '';
    const tick = () => {
      const r = el.getBoundingClientRect();
      const k = `${r.left}|${r.top}|${r.width}|${r.height}|${window.innerWidth}|${window.innerHeight}`;
      if (k !== seen) {
        seen = k;
        setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
        setView({ w: window.innerWidth, h: window.innerHeight });
      }
      id = nextFrame(tick);
    };
    tick();
    return () => { cancelFrame(id); if (demo) el.classList.remove(demo); };
  }, [step]);

  // Focus moves to each tip, so keyboards and screen readers follow along.
  useLayoutEffect(() => {
    tip.current?.focus({ preventScroll: true });
    if (tip.current?.offsetHeight) setTipH(tip.current.offsetHeight);
  }, [i]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      else if (e.key === 'ArrowRight') onGo(i + 1);
      else if (e.key === 'ArrowLeft' && i > 0) onGo(i - 1);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [i, onGo, onSkip]);

  const w = Math.min(340, view.w - GUTTER * 2);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  let hole: Box;
  let tipBox: { left: number; top: number };
  let side: 'below' | 'above' | 'mid' = 'mid';
  let arrow = 0;
  if (rect) {
    hole = { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 };
    const below = view.h - (hole.y + hole.h);
    side = below >= tipH + GAP + GUTTER || below >= hole.y ? 'below' : 'above';
    const top = side === 'below' ? hole.y + hole.h + GAP : hole.y - GAP - tipH;
    const left = clamp(rect.x + rect.w / 2 - w / 2, GUTTER, view.w - w - GUTTER);
    tipBox = { left, top: clamp(top, GUTTER, view.h - tipH - GUTTER) };
    arrow = clamp(rect.x + rect.w / 2 - left, 24, w - 24);
  } else {
    // No control for this tip: the whole screen dims and the tip sits in the middle.
    hole = { x: view.w / 2, y: view.h / 2, w: 0, h: 0 };
    tipBox = { left: (view.w - w) / 2, top: Math.max(GUTTER, (view.h - tipH) / 2) };
  }

  return (
    <>
      <div className="tour-block" />
      <div className="tour-spot" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: rect ? radius : 0 }}>
        {step.tryIt && rect && <button type="button" className="tour-try" aria-label={`Try it: ${step.title}`} onClick={() => onGo(i + 1)} />}
      </div>
      <div
        ref={tip}
        className={`tour-tip ${side}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        style={{ left: tipBox.left, top: tipBox.top, width: w, '--ax': `${arrow}px` } as CSSProperties}
      >
        <div className="tour-tiph">
          <span aria-label={`Tip ${i + 1} of ${steps.length}`}>{i + 1} of {steps.length}</span>
          {!last && <button type="button" className="tour-link m" onClick={onSkip}>Skip tour</button>}
        </div>
        <div key={step.id} className={`tour-tipc ${side}`}>
          <b id="tour-title">{step.title}</b>
          <p id="tour-body">{step.body}</p>
          {step.demo === 'sync' && <SyncDemo />}
          {step.demo === 'temp' && <TempDemo />}
        </div>
        <div className="tour-tipf">
          <svg className="tour-pie" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="8.6" />
            <circle className="p" cx="10" cy="10" r="3" style={{ strokeDasharray: `${((i + 1) / steps.length) * PIE} ${PIE}` }} />
          </svg>
          {i > 0 && <button type="button" className="tour-link" onClick={() => onGo(i - 1)}>Back</button>}
          <button type="button" className="tour-next" onClick={() => onGo(i + 1)}>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </>
  );
}

/** Saved → sending → received, on a loop while the tip is open. */
function SyncDemo() {
  return (
    <div className="tour-sync" aria-hidden="true">
      <span className="s s1"><i />Saved on this device</span>
      <span className="s s2"><i />Sending…</span>
      <span className="s s3"><i />Head office has it</span>
    </div>
  );
}

/** A temperature is typed, then Enter is pressed. */
function TempDemo() {
  return (
    <div className="tour-temp" aria-hidden="true">
      <span className="fld"><span className="typed">3.8</span><span className="caret" />°C</span>
      <span className="kbd">Enter</span>
    </div>
  );
}

const KEY: [string, string, string][] = [
  ['var(--ink)', 'Main button', 'the next thing to do'],
  ['var(--ok)', 'Green', 'done, or head office has it'],
  ['var(--warn)', 'Orange', 'needs a look'],
  ['var(--bad)', 'Red', 'today, or it failed'],
];

function Done({ onClose, onAgain }: { onClose: () => void; onAgain: () => void }) {
  useEscape(onClose);
  return (
    <div className="tour-back">
      <div className="tour-sheet done" role="dialog" aria-modal="true" aria-labelledby="tour-done">
        <svg className="tour-tick" width="56" height="56" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="9.2" />
          <path d="M6 10.4l2.6 2.5L14 7.4" />
        </svg>
        <div className="tour-head">
          <h2 id="tour-done">You're all set</h2>
          <p>One thing to remember: the colours always mean the same.</p>
        </div>
        <ul className="tour-key">
          {KEY.map(([c, name, means]) => <li key={name}><i style={{ background: c }} /><span><b>{name}</b> · {means}</span></li>)}
        </ul>
        <p className="note" style={{ margin: 0 }}>See the tour again any time from Account.</p>
        <div className="tour-acts">
          <button type="button" className="btn b1" autoFocus onClick={onClose}>Let's go</button>
          <button type="button" className="btn b2" onClick={onAgain}>Show me again</button>
        </div>
      </div>
    </div>
  );
}

/** A one-off tip the first time someone opens a screen. "Got it" hides it for good (Undo for a moment). */
export function FirstTimeTip({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const { user } = useAuth();
  const t = useTourState(user);
  const [undo, setUndo] = useState(false);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(false), 6000);
    return () => clearTimeout(timer);
  }, [undo]);
  if (!user) return null;
  if (undo) {
    return (
      <div className="toast" role="status">
        <span>Tip hidden. Bring it back in Account.</span>
        <button type="button" onClick={() => { tour.showTip(user, id); setUndo(false); }}>Undo</button>
      </div>
    );
  }
  if (!showsTip(t, id)) return null;
  return (
    <div className="tour-hint" role="note">
      <span className="av"><Icon d={HELP} size={16} /></span>
      <span className="tx">
        <span>{title}</span>
        <small>{children}</small>
        <button type="button" className="tour-link" onClick={() => { tour.hideTip(user, id); setUndo(true); }}>Got it</button>
      </span>
    </div>
  );
}
