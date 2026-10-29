/**
 * The first-run tour and the tips on new screens (design: design/tour-canvas).
 * Each role sees 4 or 5 tips that light up the real controls, found by their data-tour attribute.
 * What each person has seen is kept per person, not per device. Demo mode keeps it on this device;
 * connected mode will keep it on their People row, so it follows them from the iPad to their phone.
 */
import { useSyncExternalStore } from 'react';
import type { Role, User } from './auth';
import { storage } from './storage';
import { now } from './clock';
import type { ICONS } from '../components/ui-helpers';

export type TourDemo = 'segs' | 'sync' | 'temp';

export interface TourStep {
  id: string;
  /** The data-tour value of the control to light up. None: the tip sits in the middle of the screen. */
  target?: string;
  title: string;
  body: string;
  /** Icon for the welcome sheet's list. */
  icon: keyof typeof ICONS;
  /** A small animation that shows what the tip means. */
  demo?: TourDemo;
  /** Tapping the lit control moves the tour on. */
  tryIt?: boolean;
}

const HERO_EOD: TourStep = { id: 'hero-eod', target: 'hero-eod', title: 'Close the day here', body: 'Your end-of-day report. Do the sections in any order; each bar fills as you finish one.', icon: 'list', demo: 'segs' };
/** Managers see one of these dark cards, depending on the time of day; only the one on screen is shown. */
const HERO_CHECK: TourStep = { id: 'hero-check', target: 'hero-check', title: "What's due now", body: 'The dark card always shows the most urgent thing first. Tap it to start.', icon: 'list' };
const HERO_NIGHT: TourStep = { id: 'hero-night', target: 'hero-night', title: 'How last night went', body: 'Net sales, wages and covers from the last close, against the week before.', icon: 'chart' };
const NEEDS: TourStep = { id: 'needs', target: 'needs', title: 'Things that need you', body: 'Late checklists, repairs and warnings land here. Red means today.', icon: 'bang' };
const SYNC: TourStep = { id: 'sync', target: 'sync', title: 'Saved, then sent', body: 'Everything saves on this device first, so a bad signal never loses work.', icon: 'check', demo: 'sync' };
const TABS: TourStep = { id: 'tabs', target: 'tabs', title: 'Checklists and the EOD', body: "They're always one tap away. Home brings you back here.", icon: 'home' };

export const TOURS: Record<Role, TourStep[]> = {
  staff: [
    { id: 'hero-check', target: 'hero-check', title: 'Your next checklist', body: 'The dark card always shows what is due next. Tap it to start.', icon: 'list' },
    { id: 'todo', target: 'todo', title: 'The rest of today', body: "Everything left for this shift, in time order. A red pill means it's late.", icon: 'clock' },
    { id: 'temp', title: 'Quick temperatures', body: 'Type the number and press Enter: the next one opens. Freezers have a ± button for minus.', icon: 'thermo', demo: 'temp' },
    { id: 'next', target: 'next', title: 'The main button is the next job', body: 'Not sure what to do? The big button at the bottom always starts the next thing that is due.', icon: 'arrow' },
    { id: 'me', target: 'me', title: 'Not you?', body: 'Tap your name to switch person, so nobody signs things as you.', icon: 'lock', tryIt: true },
  ],
  supervisor: [
    { id: 'hero-today', target: 'hero-today', title: 'Today at a glance', body: 'How many checklists are done, and what is late or due a re-check.', icon: 'list' },
    NEEDS, SYNC, TABS,
  ],
  manager: [
    HERO_CHECK, HERO_EOD, HERO_NIGHT, NEEDS, SYNC,
    { id: 'site', target: 'site', title: 'More than one site?', body: 'Tap the site name to switch. Try it now.', icon: 'home', tryIt: true },
    TABS,
  ],
  headoffice: [
    { id: 'all', target: 'ho-hero', title: 'Every site, tonight', body: 'Reports land here as each site closes, and the total updates as they come in.', icon: 'chart' },
    { id: 'sites', target: 'ho-sites', title: "Who's in, who's late", body: 'Click a site to see its report, or open it to work in its own screens.', icon: 'list' },
    { id: 'approve', target: 'ho-approve', title: 'Approve clean closes in one go', body: 'Sites with a warning wait for you to check or send back. You can undo.', icon: 'check' },
    { id: 'days', target: 'ho-days', title: 'Look back at any day', body: "Every site's checklists and EODs, day by day.", icon: 'cal' },
  ],
};

export const tourFor = (role: Role): TourStep[] => TOURS[role];

/** Things a new manager or supervisor does for real in their first week. Each ticks itself. */
export type FirstWeekTask = 'close' | 'cash' | 'switch';

export interface PersonTour {
  /** When they finished or skipped the tour. Null: show the welcome next time they're on Home. */
  seenAt: string | null;
  /** New-screen tips they've dismissed with Got it. */
  hidden: string[];
  tipsOff: boolean;
  did: Partial<Record<FirstWeekTask, string>>;
}

const KEY = 'mgh.tour.v1';
const BLANK: PersonTour = { seenAt: null, hidden: [], tipsOff: false, did: {} };
const listeners = new Set<() => void>();
let version = 0;

/** By name for now; connected mode will use the person's Entra ID. */
const who = (u: Pick<User, 'name'>) => u.name.trim().toLowerCase();
const readAll = () => storage.get<Record<string, PersonTour>>(KEY, {});

function change(u: Pick<User, 'name'>, f: (t: PersonTour) => PersonTour) {
  const all = readAll();
  all[who(u)] = f({ ...BLANK, ...all[who(u)] });
  storage.set(KEY, all);
  version++;
  listeners.forEach((l) => l());
}

export const tour = {
  get: (u: Pick<User, 'name'>): PersonTour => ({ ...BLANK, ...readAll()[who(u)] }),
  markSeen: (u: Pick<User, 'name'>) => change(u, (t) => ({ ...t, seenAt: now().toISOString() })),
  /** Show the welcome again next time they're on Home. */
  replay: (u: Pick<User, 'name'>) => change(u, (t) => ({ ...t, seenAt: null })),
  hideTip: (u: Pick<User, 'name'>, id: string) => change(u, (t) => ({ ...t, hidden: t.hidden.includes(id) ? t.hidden : [...t.hidden, id] })),
  showTip: (u: Pick<User, 'name'>, id: string) => change(u, (t) => ({ ...t, hidden: t.hidden.filter((h) => h !== id) })),
  showAllTips: (u: Pick<User, 'name'>) => change(u, (t) => ({ ...t, hidden: [] })),
  setTips: (u: Pick<User, 'name'>, on: boolean) => change(u, (t) => ({ ...t, tipsOff: !on })),
  /** Keeps the first time only. */
  did: (u: Pick<User, 'name'>, task: FirstWeekTask) => change(u, (t) => (t.did[task] ? t : { ...t, did: { ...t.did, [task]: now().toISOString() } })),
};

export function useTourState(u: Pick<User, 'name'> | null): PersonTour {
  useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => version,
    () => version,
  );
  return u ? tour.get(u) : BLANK;
}

/** The welcome only opens by itself outside tests, so other tests see the screens as they are. */
let autoStart = import.meta.env.MODE !== 'test';
export const tourAutoStarts = () => autoStart;
export function setTourAutoStart(on: boolean) { autoStart = on; }

/** Whether a new-screen tip should show: after the welcome, with tips on, and not dismissed. */
export const showsTip = (t: PersonTour, id: string) => Boolean(t.seenAt) && !t.tipsOff && !t.hidden.includes(id);

export const FIRST_WEEK: Record<FirstWeekTask, { title: string; todo: string; done: string }> = {
  close: { title: 'Do your first close', todo: 'Send an EOD report', done: 'Done' },
  cash: { title: 'Count the cash by note', todo: 'From Lunch or Dinner, tap Count the cash', done: 'Done' },
  switch: { title: 'Switch to another site', todo: 'Tap the site name at the top', done: 'Done' },
};

/**
 * The first-week card: managers and supervisors, from the tour until two weeks later. Once everything
 * is ticked it stays for the rest of that day, then goes.
 */
export function firstWeekTasks(role: Role, t: PersonTour, canSwitch: boolean, at = now()): FirstWeekTask[] {
  if (role !== 'manager' && role !== 'supervisor') return [];
  if (!t.seenAt || at.getTime() - new Date(t.seenAt).getTime() > 14 * 86_400_000) return [];
  const tasks: FirstWeekTask[] = role === 'manager' && canSwitch ? ['close', 'cash', 'switch'] : ['close', 'cash'];
  const times = tasks.map((k) => t.did[k]);
  if (times.every(Boolean)) {
    const last = times.sort().at(-1)!;
    if (last.slice(0, 10) !== at.toISOString().slice(0, 10)) return [];
  }
  return tasks;
}
