import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { admin, manager, renderApp, seedVerifiedDraft, staff, supervisor } from './harness';
import { setNow } from '../app/lib/clock';
import { deviceChecklistStore, deviceStore } from '../app/lib/store';
import { verifiedDraft } from '../../../packages/core/test/fixtures';
import { DEFAULT_LAYOUT, type WidgetId } from '../app/lib/home-layout';
import type { User } from '../app/lib/auth';

const at = (iso: string) => setNow(new Date(iso));
const yesterday = '2026-10-04';

/** Last night's close saved on this device, with a handover note for the opener. */
async function seedHandover(body = 'Walk-in door sticks, push it shut.') {
  const d = verifiedDraft();
  d.businessDate = yesterday;
  d.clientId = '6f1c2b8e-1d2a-4c3b-9f00-000000000099';
  d.handover = [{ id: 'h1', category: 'Kitchen', body, raiseRepair: false }];
  await deviceStore().saveDraft(d);
}

/** A checklist finished earlier today by someone (the store writes synchronously). */
function seedRun(key: string, by: string, completedAt: string, date = '2026-10-05') {
  const [, templateId, dueTime] = key.split('|');
  const run = { key, templateId: templateId!, businessDate: date, dueTime: dueTime === 'any' ? null : dueTime! };
  void deviceChecklistStore().apply('BUN', [{ kind: 'finish', run, by, at: completedAt }]);
}

/** A home widget by name (Checklists, End of day report, Repairs, Handover, Food safety…). */
const region = (name: string) => screen.getByRole('region', { name });
/** What a widget's header says on the right: "1 late", "2 missed", "1 of 6 done", "New". */
const meta = (sec: HTMLElement) => sec.querySelector('.wh .wmeta, .wh .pill')?.textContent ?? '';
/** A widget's rows (EOD issues, the handover). */
const rows = (sec: HTMLElement) => [...sec.querySelectorAll<HTMLElement>('.sub a')];
/** The link at the foot of a widget ("Write the handover", "Add to the handover"). */
const foot = (sec: HTMLElement) => sec.querySelector<HTMLElement>('.wfoot');
/** Checklists (W1): the ring, "N of M checklists done". */
const ring = (sec: HTMLElement) => within(sec).getByRole('img', { name: /checklists done$/ });
/** Checklists (W1): the one list to do now ("Do now: …" or "Start: …"), or null. */
const focus = (sec: HTMLElement) => sec.querySelector<HTMLAnchorElement>('.wck .ln');
/** Checklists (W1): the small lines under it ("Next due · …", "N more to do", "Yesterday: …"). */
const smalls = (sec: HTMLElement) => [...sec.querySelectorAll('.wck .wsmall')].map((e) => e.textContent);
/** The main card, where Up next lives (the Checklists widget has its own Do now / Start link). */
const hero = () => within(document.querySelector<HTMLElement>('.hero')!);
/** The widgets on the home, in order. */
const widgets = () => [...document.querySelectorAll('section[data-widget]')].map((w) => w.getAttribute('aria-label'));
const run = (key: string) => '/checklists/' + encodeURIComponent(key);
/** Put widgets that are off by default (On shift, Your day…) on this person's home, as Customise would. Repairs and Handover are on everyone's by default. */
const withWidgets = (u: User, ...extra: WidgetId[]) =>
  localStorage.setItem(`mgh.home.v1:${u.role}:${u.name}`, JSON.stringify({ order: [...DEFAULT_LAYOUT[u.role], ...extra], hidden: [] }));

describe('staff home (the shared kitchen iPad)', () => {
  it('when every list was missed, Up next says so instead of "All done"', () => {
    at('2026-10-06T00:45:00Z'); // 01:45 BST, the trading day is over and nothing was done
    renderApp('/', staff);
    const up = screen.getByRole('link', { name: /^See\ what\ was\ missed,/ });
    expect(up).toHaveAttribute('href', '/day');
    expect(up).toHaveTextContent(/Nothing left · \d+ missed/);
    expect(screen.queryByText('All done · see checklists')).not.toBeInTheDocument();
  });

  it('leads with their next checklist and offers a way to report a problem, not the EOD', () => {
    at('2026-10-05T10:50:00Z'); // 11:50 BST: Hot holding 12:00 is due; Opening checks missed
    renderApp('/', staff);
    expect(screen.getByRole('heading', { name: 'Hi Sam' })).toBeInTheDocument();
    const hot = '/checklists/' + encodeURIComponent('2026-10-05|hothold|12:00');
    const up = hero().getByRole('link', { name: /^Start:\ Hot\ holding\ ·\ 12:00,/ });
    expect(up).toHaveAttribute('href', hot);
    expect(up.closest('.hero')!).toHaveTextContent('Checklists to do today');
    expect(up.closest('.hero')!).toHaveTextContent('0 of 6 checklists done');
    expect(within(region('Repairs')).getByRole('link', { name: /^Report a problem/ })).toHaveAttribute('href', '/report');
    expect(screen.queryByText(/EOD/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'End of day report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^End of day report/ })).not.toBeInTheDocument();
  });

  it('Checklists shows the due list to do now, then when the next is due, and nothing for managers only', () => {
    at('2026-10-05T10:50:00Z'); // 11:50 BST
    renderApp('/', staff);
    const lists = region('Checklists');
    expect(within(lists).getByRole('heading', { name: 'Checklists' })).toBeInTheDocument();
    expect(meta(lists)).toBe('1 missed');
    expect(lists.querySelector('.wh .pill')).toHaveClass('p-warn');
    expect(ring(lists)).toHaveAccessibleName('0 of 6 checklists done');
    // One list to do now (W1): the due one, with a Start button; the missed one is counted in the pill.
    const now = focus(lists)!;
    expect(now).toHaveAccessibleName('Start: Hot holding · 12:00, Due in 10 min');
    expect(now).toHaveAttribute('href', run('2026-10-05|hothold|12:00'));
    expect(now).toHaveTextContent(/^Hot holding · 12:00Due in 10 min · KitchenStart$/);
    expect(now.querySelector('.mini')).toHaveTextContent('Start');
    expect(lists.querySelectorAll('.ln')).toHaveLength(1);
    expect(within(lists).queryByText(/Opening checks/)).not.toBeInTheDocument();
    // Then when the next one is due; no row list and no foot any more.
    expect(smalls(lists)).toEqual(['Next due · Hot holding at 15:00']);
    expect(rows(lists)).toHaveLength(0);
    expect(foot(lists)).toBeNull();
    // Lists done when needed stay on the Checklists screen; no missed-yesterday line for staff.
    expect(within(lists).queryByText(/Delivery check|Yesterday/)).not.toBeInTheDocument();
    // Open repairs and EOD issues are for supervisors and managers; staff only get a way to report one.
    expect(within(region('Repairs')).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringMatching(/^Report a problem/)]);
    expect(screen.queryByRole('region', { name: 'End of day report' })).not.toBeInTheDocument();
  });

  it('a late list is the one to do now', () => {
    at('2026-10-05T11:10:00Z'); // 12:10 BST: Hot holding 12:00 is 10 min late
    renderApp('/', staff);
    const hot = '/checklists/' + encodeURIComponent('2026-10-05|hothold|12:00');
    expect(hero().getByRole('link', { name: /^Do\ now:\ Hot\ holding\ ·\ 12:00,/ })).toHaveAttribute('href', hot);
    const lists = region('Checklists');
    // The header counts what's late first, in the warning pill (W1).
    expect(meta(lists)).toBe('1 late');
    expect(lists.querySelector('.wh .pill')).toHaveClass('p-warn');
    expect(lists.querySelector('.wh .pill')).not.toHaveClass('p-bad');
    // Late is the one to do now, ahead of the missed list.
    expect(focus(lists)).toHaveAccessibleName('Do now: Hot holding · 12:00, 10 min late');
    expect(focus(lists)).toHaveAttribute('href', hot);
    expect(focus(lists)).toHaveTextContent(/^Hot holding · 12:00.*10 min late/);
    expect(smalls(lists)).toEqual(['Next due · Hot holding at 15:00']);
  });

  it('done lists count in the card, the widget header and the ring, and leave the widget', () => {
    at('2026-10-05T10:50:00Z');
    seedRun('2026-10-05|opening|09:30', 'Sam', '2026-10-05T08:42:00Z');
    seedRun('2026-10-05|bar|16:30', 'Alex', '2026-10-05T09:15:00Z');
    renderApp('/', staff);
    expect(hero().getByRole('link', { name: /^Start:\ Hot\ holding\ ·\ 12:00,/ }).closest('.hero')!).toHaveTextContent('2 of 6 checklists done');
    const lists = region('Checklists');
    // Nothing missed now, and the due list doesn't count as late.
    expect(meta(lists)).toBe('2 of 6 done');
    expect(ring(lists)).toHaveAccessibleName('2 of 6 checklists done');
    expect(within(lists).queryByText(/Opening checks|Bar opening|Delivery check/)).not.toBeInTheDocument();
    // What's left: the due list now, then the next by time.
    expect(focus(lists)).toHaveAccessibleName('Start: Hot holding · 12:00, Due in 10 min');
    expect(smalls(lists)).toEqual(['Next due · Hot holding at 15:00']);
  });

  it('Checklists starts the next list to come, then when the one after is due; Repairs offers Report a problem; no EOD widget', () => {
    at('2026-10-05T10:00:00Z'); // 11:00 BST
    seedRun('2026-10-05|opening|09:30', 'Sam', '2026-10-05T08:40:00Z');
    renderApp('/', staff);
    const lists = region('Checklists');
    // Nothing late, due or missed yet.
    expect(meta(lists)).toBe('1 of 6 done');
    expect(focus(lists)).toHaveAccessibleName(/^Start: Hot holding · 12:00, /);
    expect(focus(lists)).toHaveAttribute('href', run('2026-10-05|hothold|12:00'));
    // The next one after it by time, without repeating its time in the title.
    expect(smalls(lists)).toEqual(['Next due · Hot holding at 15:00']);
    expect(within(lists).queryByText(/Bar opening/)).not.toBeInTheDocument();
    const repairs = region('Repairs');
    // Staff can't open the repairs list, so the title isn't a link; the only way in is Report a problem.
    expect(within(repairs).getByRole('heading', { name: 'Repairs' })).toBeInTheDocument();
    expect(within(repairs).getAllByRole('link').map((l) => l.textContent)).toEqual(['Report a problem']);
    expect(within(repairs).getByRole('link', { name: /^Report a problem/ })).toHaveAttribute('href', '/report');
    expect(repairs).toHaveTextContent('Something broken? Take a photo and it goes to your manager.');
    expect(screen.queryByRole('region', { name: 'End of day report' })).not.toBeInTheDocument();
    // The title link's name starts with the widget name, then what the to-do dot says (see the dot test).
    expect(within(region('Food safety')).getByRole('link', { name: /^Food safety, \d+ to do(, something failed)?$/ })).toHaveAttribute('href', '/food-safety');
  });

  it('once every list is done, Up next goes to the checklists', () => {
    at('2026-10-05T21:30:00Z'); // 22:30 BST
    for (const [key, t] of [['opening|09:30', '08:40'], ['hothold|12:00', '11:02'], ['hothold|15:00', '14:01'], ['hothold|18:00', '17:05'], ['bar|16:30', '15:31'], ['closing|23:00', '21:20']]) {
      seedRun(`2026-10-05|${key}`, 'Sam', `2026-10-05T${t}:00Z`);
    }
    renderApp('/', staff);
    const up = screen.getByRole('link', { name: /^See\ checklists,/ });
    expect(up).toHaveAttribute('href', '/checklists');
    expect(up).toHaveTextContent('All done · see checklists');
    expect(up.closest('.hero')!).toHaveTextContent('6 of 6 checklists done');
  });

  it('an unread handover from last night is in its own Handover section', async () => {
    await seedHandover();
    renderApp('/', staff);
    expect(screen.queryByRole('heading', { name: 'From last night' })).not.toBeInTheDocument();
    const sec = region('Handover');
    expect(within(sec).getByRole('heading', { name: 'Handover' })).toBeInTheDocument();
    expect(meta(sec)).toBe('New');
    expect(within(sec).getByText('New')).toHaveClass('pill', 'p-new');
    // Staff don't get the handover to write; they can add to it.
    const links = within(sec).getAllByRole('link');
    expect(links).toHaveLength(2);
    const row = within(sec).getByRole('link', { name: /^Handover from / });
    expect(row).toHaveAttribute('href', '/handover');
    expect(row).toHaveTextContent('Walk-in door sticks, push it shut.');
    expect(links[1]).toHaveAccessibleName('Add to the handover');
    expect(links[1]).toHaveAttribute('href', '/handover/new');
    expect(screen.queryByRole('link', { name: 'Write the handover' })).not.toBeInTheDocument();
  });

  it('switching person on the shared iPad: a new person chooses a PIN, then it is them', async () => {
    at('2026-10-05T10:50:00Z');
    const { user } = renderApp('/', staff);
    await user.click(screen.getByRole('button', { name: /Switch person/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Someone else…' }));
    await user.type(screen.getByLabelText('Someone else'), 'Alex');
    await user.click(screen.getByRole('button', { name: "I'm Alex" }));
    expect(screen.getByRole('heading', { name: 'Choose a PIN' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('New PIN'), '1234');
    expect(screen.getByRole('alert')).toHaveTextContent('Too easy to guess. Pick another');
    await user.type(screen.getByLabelText('New PIN'), '4817');
    await user.type(await screen.findByLabelText('New PIN again'), '4817');
    expect(await screen.findByRole('heading', { name: 'Hi Alex' })).toBeInTheDocument();
    // Sam is in the menu next time; one tap goes straight to choosing a PIN.
    await user.click(screen.getByRole('button', { name: /Switch person/ }));
    await user.click(screen.getByRole('menuitem', { name: /Sam\s*No PIN yet/ }));
    expect(screen.getByRole('heading', { name: 'Choose a PIN' })).toBeInTheDocument();
  });

  it('the menu opens and closes like a dropdown', async () => {
    const { user } = renderApp('/', staff);
    const chip = screen.getByRole('button', { name: /Switch person/ });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    await user.click(chip);
    expect(screen.getByRole('menu', { name: "Who's using the iPad" })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Sam\s*Using it now/ })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(chip);
    await user.click(screen.getByRole('heading', { name: 'Hi Sam' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('staff PIN', () => {
  async function aliceHasPin() {
    const { pins } = await import('../app/lib/pins');
    const { makePinRecord } = await import('@maginhawa/core');
    pins.set('BUN', 'Alice', await makePinRecord('4817', 'salt'));
    localStorage.setItem('mgh.people.v1.BUN', JSON.stringify([{ name: 'Alice', initials: 'A', role: 'staff', siteCode: 'BUN' }]));
  }

  it('the right PIN switches, a wrong one says how many tries are left', async () => {
    await aliceHasPin();
    const { user } = renderApp('/switch', staff);
    await user.click(screen.getByRole('button', { name: /Alice/ }));
    expect(screen.getByRole('heading', { name: 'Hi Alice' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Your PIN'), '1111');
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong PIN. 4 tries left.');
    await user.type(screen.getByLabelText('Your PIN'), '4817');
    expect(await screen.findByRole('button', { name: /Alice is using this device/ })).toBeInTheDocument();
  });

  it('locks after five wrong tries', async () => {
    await aliceHasPin();
    const { user } = renderApp('/switch', staff);
    await user.click(screen.getByRole('button', { name: /Alice/ }));
    for (let i = 4; i >= 1; i--) {
      await user.type(screen.getByLabelText('Your PIN'), '1111');
      expect(await screen.findByText(`Wrong PIN. ${i} ${i === 1 ? 'try' : 'tries'} left.`)).toBeInTheDocument();
    }
    await user.type(screen.getByLabelText('Your PIN'), '1111');
    expect(await screen.findByText('Too many wrong tries. Try again in 5 min, or ask your manager.')).toBeInTheDocument();
    // The field goes away until the lock is over.
    expect(screen.queryByLabelText('Your PIN')).not.toBeInTheDocument();
  });

  it('a PIN typed twice must match', async () => {
    const { user } = renderApp('/switch', staff);
    await user.type(screen.getByLabelText('Someone else'), 'Bo');
    await user.click(screen.getByRole('button', { name: "I'm Bo" }));
    await user.type(screen.getByLabelText('New PIN'), '4817');
    await user.type(await screen.findByLabelText('New PIN again'), '4818');
    expect(await screen.findByRole('alert')).toHaveTextContent("Those didn't match. Choose your PIN again.");
    expect(screen.getByRole('heading', { name: 'Choose a PIN' })).toBeInTheDocument();
  });

  it('a manager resets a forgotten PIN', async () => {
    await aliceHasPin();
    const { user } = renderApp('/people', manager);
    // Alice joined the People list by signing in on the iPad.
    await user.click(screen.getByRole('button', { name: /Alice.*PIN on the iPad/ }));
    await user.click(screen.getByRole('button', { name: 'Reset PIN' }));
    expect(screen.getByRole('status')).toHaveTextContent("Alice's PIN is cleared. They choose a new one next time.");
    expect(screen.getAllByText('No PIN yet').length).toBeGreaterThan(0);
  });

  it('PINs are never stored as typed', async () => {
    const { user } = renderApp('/switch', staff);
    await user.type(screen.getByLabelText('Someone else'), 'Bo');
    await user.click(screen.getByRole('button', { name: "I'm Bo" }));
    await user.type(screen.getByLabelText('New PIN'), '4817');
    await user.type(await screen.findByLabelText('New PIN again'), '4817');
    await screen.findByRole('heading', { name: 'Hi Bo' });
    expect(Object.values({ ...localStorage }).join('')).not.toContain('4817');
  });
});

describe('reporting a problem', () => {
  it('goes from staff straight to the manager, who marks it fixed', async () => {
    const { user, unmount } = renderApp('/report', staff);
    expect(screen.getByRole('button', { name: 'Send to the manager' })).toBeDisabled();
    await user.type(screen.getByLabelText("What's broken"), 'Dishwasher leaking');
    await user.click(screen.getByRole('radio', { name: 'Kitchen' }));
    await user.click(screen.getByRole('switch', { name: "It's urgent" }));
    await user.click(screen.getByRole('button', { name: 'Send to the manager' }));
    expect(screen.getByText('Sent. Your manager can see it now.')).toBeInTheDocument();
    unmount();

    const m = renderApp('/', manager);
    const repairs = region('Repairs');
    expect(meta(repairs)).toBe('1 urgent');
    expect(repairs.querySelector('.wh .pill')).toHaveClass('p-bad');
    expect(within(repairs).getByRole('heading', { name: 'Repairs' }).querySelector('a')).toHaveAttribute('href', '/repairs');
    const open = within(repairs).getByRole('link', { name: /^1\s*open · Dishwasher leaking$/ });
    expect(open).toHaveAttribute('href', '/repairs');
    await m.user.click(open);
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    await m.user.click(screen.getByRole('button', { name: 'Fixed' }));
    await m.user.click(screen.getByRole('button', { name: 'Tap again' }));
    expect(screen.getByText('Nothing open. Good.')).toBeInTheDocument();
  });

  it('staff can\'t open the repairs list', () => {
    renderApp('/repairs', staff);
    // They land on their home, whose Repairs section only offers Report a problem.
    expect(screen.queryByRole('heading', { name: 'Repairs', level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing open. Good.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hi Sam' })).toBeInTheDocument();
  });

  it('managers with nothing open see so in Repairs, with a way to report one', () => {
    renderApp('/', manager);
    const repairs = region('Repairs');
    expect(repairs).toHaveTextContent('Nothing open.');
    expect(meta(repairs)).toBe('');
    expect(within(repairs).getByRole('link', { name: /^Report a problem/ })).toHaveAttribute('href', '/report');
  });
});

describe('adding to the handover (anyone)', () => {
  const notesKey = (date: string) => `mgh.handover-notes.v1.BUN|${date}`;
  const stored = (date = '2026-10-05') => JSON.parse(localStorage.getItem(notesKey(date)) ?? '[]');
  /** "Tonight so far" on /handover/new. */
  const tonight = () => screen.queryByRole('heading', { name: 'Tonight so far' })?.closest('section') ?? null;

  /** Adds a note from /handover/new as whoever is signed in. */
  async function addNote(u: ReturnType<typeof renderApp>['user'], cat: string, body: string) {
    await u.click(screen.getByRole('radio', { name: cat }));
    await u.type(screen.getByLabelText('Note'), body);
    await u.click(screen.getByRole('button', { name: 'Add to the handover' }));
  }

  it('staff get Add to the handover on the home and add a note with a category', async () => {
    at('2026-10-05T10:50:00Z');
    const { user } = renderApp('/', staff);
    const sec = region('Handover');
    expect(within(sec).queryByRole('link', { name: 'Write the handover' })).not.toBeInTheDocument();
    await user.click(within(sec).getByRole('link', { name: 'Add to the handover' }));
    expect(screen.getByRole('heading', { name: 'Add to the handover', level: 1 })).toBeInTheDocument();
    // Stock is picked to start with; nothing to add until there's a note.
    expect(screen.getByRole('radio', { name: 'Stock' })).toHaveAttribute('aria-checked', 'true');
    const add = screen.getByRole('button', { name: 'Add to the handover' });
    expect(add).toBeDisabled();
    await user.type(screen.getByLabelText('Note'), '   ');
    expect(add).toBeDisabled();
    await user.clear(screen.getByLabelText('Note'));
    await user.click(screen.getByRole('radio', { name: 'Bookings' }));
    expect(screen.getByRole('radio', { name: 'Bookings' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Stock' })).toHaveAttribute('aria-checked', 'false');
    await user.type(screen.getByLabelText('Note'), '  Party of 12 at 19:00  ');
    await user.click(add);
    expect(screen.getByRole('status')).toHaveTextContent('Added. Add another, or go back home.');
    expect(screen.getByLabelText('Note')).toHaveValue('');
    expect(stored()).toEqual([expect.objectContaining({ category: 'Bookings', body: 'Party of 12 at 19:00', by: 'Sam' })]);
    // Back home, the widget counts tonight's notes.
    await user.click(screen.getByRole('link', { name: 'Home' }));
    expect(within(region('Handover')).getByRole('link', { name: /^Add to the handover/ })).toHaveTextContent('Add to the handover1 tonight');
  });

  it('Tonight so far lists the notes; only the author can remove theirs', async () => {
    at('2026-10-05T10:50:00Z');
    const first = renderApp('/handover/new', staff);
    expect(tonight()).toBeNull();
    await addNote(first.user, 'Stock', 'Low on coconut milk');
    expect(tonight()).toHaveTextContent('Low on coconut milk');
    expect(tonight()).toHaveTextContent('Stock · you');
    expect(within(tonight()!).getByText('1')).toBeInTheDocument();
    first.unmount();

    // A manager sees who wrote it, and can take it down if they need to.
    const jo = renderApp('/handover/new', manager);
    expect(tonight()).toHaveTextContent('Stock · Sam');
    expect(screen.getByRole('button', { name: 'Remove note: Low on coconut milk' })).toBeInTheDocument();
    jo.unmount();

    const again = renderApp('/handover/new', staff);
    await again.user.click(screen.getByRole('button', { name: 'Remove note: Low on coconut milk' }));
    expect(tonight()).toBeNull();
    expect(stored()).toEqual([]);
  });

  it('the closer sees the team\'s notes under From the team tonight in the EOD\'s Handover', async () => {
    const before = renderApp('/close/handover', manager);
    expect(screen.queryByRole('region', { name: 'From the team tonight' })).not.toBeInTheDocument();
    before.unmount();
    const sam = renderApp('/handover/new', staff);
    await addNote(sam.user, 'Stock', 'Low on coconut milk');
    sam.unmount();

    renderApp('/close/handover', manager);
    const team = screen.getByRole('region', { name: 'From the team tonight' });
    expect(within(team).getByRole('heading', { name: 'From the team tonight' })).toBeInTheDocument();
    expect(team).toHaveTextContent('Low on coconut milk');
    expect(team).toHaveTextContent('Stock · Sam');
    expect(team).toHaveTextContent('These go to the opener with your notes.');
  });

  it('the next day, the opener reads them after the closer\'s notes, with who wrote each', async () => {
    at('2026-10-04T19:00:00Z'); // 20:00 BST on the 4th
    const sam = renderApp('/handover/new', staff);
    await addNote(sam.user, 'Stock', 'Low on coconut milk');
    sam.unmount();
    expect(stored(yesterday)).toHaveLength(1);
    await seedHandover();

    at('2026-10-05T07:00:00Z'); // 08:00 BST the next morning
    const { user } = renderApp('/', staff);
    const sec = region('Handover');
    expect(meta(sec)).toBe('New');
    expect(within(sec).getByRole('link', { name: /^Handover from / })).toHaveTextContent('Walk-in door sticks, push it shut.');
    // Last night's notes don't count as tonight's.
    expect(within(sec).getByRole('link', { name: /^Add to the handover/ })).toHaveTextContent(/^Add to the handover$/);
    await user.click(within(sec).getByRole('link', { name: /^Handover from / }));
    const items = [...document.querySelectorAll<HTMLElement>('main .sub .li')].map((li) => li.querySelector('small')!.textContent + ' | ' + li.querySelector('.tx > span')!.textContent);
    expect(items).toEqual(['Kitchen | Walk-in door sticks, push it shut.', 'Stock · Sam | Low on coconut milk']);
    await user.click(screen.getByRole('link', { name: 'Home' }));
    expect(meta(region('Handover'))).toBe('');
  });

  it('the team\'s notes reach the opener even when the close wasn\'t saved on this device', () => {
    localStorage.setItem(notesKey(yesterday), JSON.stringify([{ id: 'n1', category: 'Staff', body: 'Ana is in at 10', by: 'Sam', at: '2026-10-04T18:00:00Z' }]));
    at('2026-10-05T07:00:00Z');
    renderApp('/handover', staff);
    expect(screen.getByRole('heading', { name: 'Last night', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Ana is in at 10')).toBeInTheDocument();
    expect(screen.getByText('Staff · Sam')).toBeInTheDocument();
  });
});

describe('supervisor home (during service)', () => {
  it('shows the shift: what is late, who did what, and the handover to write', () => {
    at('2026-10-05T09:00:00Z'); // 10:00 BST, opening was due 09:30
    seedRun('2026-10-05|bar|16:30', 'Alex', '2026-10-05T08:10:00Z');
    withWidgets(supervisor, 'onshift');
    renderApp('/', supervisor);
    expect(screen.getByRole('heading', { name: 'Good morning, Jo' })).toBeInTheDocument();
    const stats = screen.getByRole('group', { name: 'Checklists to do today: 1 of 6 checklists done, 1 late or missed' });
    expect(stats).toHaveTextContent('1Late or missed');
    expect(stats).toHaveTextContent('0Re-checks due');
    expect(stats).toHaveTextContent('£0EOD so far');
    expect(stats.closest('.hero')!).toHaveTextContent('Checklists to do today');
    const lists = region('Checklists');
    expect(focus(lists)).toHaveAccessibleName('Do now: Opening checks, 30 min late');
    expect(focus(lists)).toHaveTextContent(/^Opening checks30 min late/);
    // Done lists leave the widget; who did them is under On shift.
    expect(within(lists).queryByText('Bar opening')).not.toBeInTheDocument();
    const shift = region('On shift');
    expect(within(shift).getByRole('heading', { name: 'On shift' })).toBeInTheDocument();
    expect(meta(shift)).toBe('Who did what');
    expect(within(shift).getByText('Alex')).toBeInTheDocument();
    expect(shift).toHaveTextContent('Bar opening 09:10');
    expect(within(shift).getByText('1 done')).toBeInTheDocument();
    expect(hero().getByRole('link', { name: /^Do\ now:\ Opening\ checks,/ })).toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|opening|09:30'));
    const eod = region('End of day report');
    expect(within(eod).getByRole('heading', { name: 'End of day report' }).querySelector('a')).toHaveAttribute('href', '/close');
    // The EOD's next step is Up next's job now; its widget has the section grid and no foot.
    expect(foot(eod)).toBeNull();
    expect(eod.querySelector('.wsec')).toHaveAttribute('href', '/close/lunch');
    expect(within(region('Handover')).getByRole('link', { name: 'Write the handover' })).toHaveAttribute('href', '/close/handover');
  });

  it('Write the handover sits in Handover, after last night\'s handover, until the EOD is sent', async () => {
    await seedHandover();
    renderApp('/', supervisor);
    const sec = region('Handover');
    expect(within(sec).getByText('New')).toHaveClass('pill', 'p-new');
    const links = within(sec).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleName(/^Handover from /);
    expect(links[1]).toHaveAccessibleName('Write the handover');
    expect(links[1]).toHaveAttribute('href', '/close/handover');
    // The closer writes it in the EOD before sending, rather than adding a note.
    expect(within(sec).queryByRole('link', { name: /^Add to the handover/ })).not.toBeInTheDocument();
  });

  it('once the EOD is sent, Write the handover goes and Add to the handover takes its place', async () => {
    await seedVerifiedDraft((d) => { d.confirmed = true; });
    const { user } = renderApp('/close', supervisor);
    await user.click(screen.getByRole('button', { name: 'Submit all' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('heading', { name: 'Day closed' });
    renderApp('/', supervisor);
    const eod = region('End of day report');
    expect(meta(eod)).toBe('Sent');
    // No foot link; every section in the grid opens the sent report.
    expect(foot(eod)).toBeNull();
    const secs = [...eod.querySelectorAll<HTMLAnchorElement>('.wsec')];
    expect(secs.length).toBeGreaterThan(0);
    for (const a of secs) expect(a).toHaveAttribute('href', '/close/done');
    expect(within(region('Handover')).queryByRole('link', { name: 'Write the handover' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Write the handover' })).not.toBeInTheDocument();
    expect(within(region('Handover')).getByRole('link', { name: 'Add to the handover' })).toHaveAttribute('href', '/handover/new');
  });

  it('Needs you counts late, due and missed separately', () => {
    at('2026-10-05T11:10:00Z'); // 12:10 BST: Hot holding 12:00 late, opening missed
    renderApp('/', supervisor);
    const lists = region('Checklists');
    // The header leads with what's late; the late list is the one to do now; the main card counts late and missed together.
    expect(meta(lists)).toBe('1 late');
    expect(focus(lists)).toHaveAccessibleName('Do now: Hot holding · 12:00, 10 min late');
    expect(screen.getByRole('group', { name: 'Checklists to do today: 0 of 6 checklists done, 2 late or missed' })).toHaveTextContent('2Late or missed');
  });

  it('a list that is only due is counted as due, not late', () => {
    at('2026-10-05T10:50:00Z'); // 11:50 BST: Hot holding 12:00 due, opening missed
    renderApp('/', supervisor);
    const lists = region('Checklists');
    expect(meta(lists)).toBe('1 missed');
    expect(focus(lists)).toHaveAccessibleName('Start: Hot holding · 12:00, Due in 10 min');
    expect(screen.getByRole('group', { name: 'Checklists to do today: 0 of 6 checklists done, 1 late or missed' })).toBeInTheDocument();
    expect(hero().getByRole('link', { name: /^Start:\ Hot\ holding\ ·\ 12:00,/ })).toBeInTheDocument();
  });

  it('with nothing urgent, Up next is the EOD\'s next section', () => {
    at('2026-10-05T06:00:00Z'); // 07:00 BST
    renderApp('/', supervisor);
    expect(screen.getByRole('link', { name: /^Start\ lunch,/ })).toHaveAttribute('href', '/close/lunch');
    expect(hero().queryByRole('link', { name: /^(Do now|Start): / })).not.toBeInTheDocument();
    // Nothing late or missed yet; Checklists still offers the first list of the day.
    const lists = region('Checklists');
    expect(meta(lists)).toBe('0 of 6 done');
    expect(focus(lists)).toHaveAccessibleName(/^Start: Opening checks, /);
  });

  it('before anyone has finished a list, says so', () => {
    at('2026-10-05T06:00:00Z');
    withWidgets(supervisor, 'onshift');
    renderApp('/', supervisor);
    expect(within(region('On shift')).getByText('Nobody has finished a checklist yet today.')).toBeInTheDocument();
  });
});

describe('manager home', () => {
  it('in the morning, an unread handover is the next step, and reading it clears it', async () => {
    at('2026-10-05T07:00:00Z'); // 08:00 BST, nothing due yet
    await seedHandover();
    const { user } = renderApp('/', manager);
    const sec = region('Handover');
    expect(within(sec).getByRole('link', { name: /^Handover from / })).toHaveAttribute('href', '/handover');
    expect(meta(sec)).toBe('New');
    await user.click(screen.getByRole('link', { name: /^Read\ last\ night's\ handover,/ }));
    expect(screen.getByText('Walk-in door sticks, push it shut.')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Home' }));
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Handover from last night/ })).toBeInTheDocument();
  });

  it('flags yesterday\'s missed checklists', () => {
    at('2026-10-05T07:00:00Z');
    seedRun(`${yesterday}|opening|09:30`, 'Sam', '2026-10-04T08:40:00Z', yesterday);
    renderApp('/', manager);
    const lists = region('Checklists');
    expect(within(lists).getByRole('link', { name: 'Yesterday: 5 checklists missed' })).toHaveAttribute('href', '/checklists');
    // It's the last line in Checklists, after today's list to do now and Next due.
    expect(focus(lists)).toHaveAccessibleName(/^Start: Opening checks, /);
    expect(smalls(lists)).toEqual(['Next due · Hot holding at 12:00', 'Yesterday: 5 checklists missed']);
  });

  it('one list missed yesterday is named', () => {
    at('2026-10-05T07:00:00Z');
    for (const [key, t] of [['hothold|12:00', '11:02'], ['hothold|15:00', '14:01'], ['hothold|18:00', '17:05'], ['bar|16:30', '15:31'], ['closing|23:00', '21:20']]) {
      seedRun(`${yesterday}|${key}`, 'Sam', `${yesterday}T${t}:00Z`, yesterday);
    }
    renderApp('/', manager);
    expect(within(region('Checklists')).getByRole('link', { name: 'Yesterday: Opening checks was missed' })).toHaveAttribute('href', '/checklists');
  });

  it('supervisors and staff don\'t get yesterday\'s missed line', () => {
    at('2026-10-05T07:00:00Z');
    for (const u of [supervisor, staff]) {
      const { unmount } = renderApp('/', u);
      expect(within(region('Checklists')).queryByText(/^Yesterday:/)).not.toBeInTheDocument();
      unmount();
    }
  });

  it('yesterday\'s missed lists follow today\'s To do, even when today is all done', () => {
    at('2026-10-05T21:30:00Z');
    for (const [key, t] of [['opening|09:30', '08:40'], ['hothold|12:00', '11:02'], ['hothold|15:00', '14:01'], ['hothold|18:00', '17:05'], ['bar|16:30', '15:31'], ['closing|23:00', '21:20']]) {
      seedRun(`2026-10-05|${key}`, 'Sam', `2026-10-05T${t}:00Z`);
    }
    seedRun(`${yesterday}|opening|09:30`, 'Sam', '2026-10-04T08:40:00Z', yesterday);
    renderApp('/', manager);
    const lists = region('Checklists');
    // Nothing left today; the count is today's lists, not yesterday's.
    expect(meta(lists)).toBe('6 of 6 done');
    expect(ring(lists)).toHaveAccessibleName('6 of 6 checklists done');
    expect(focus(lists)).toBeNull();
    // Today says it's done, and yesterday's line still follows.
    expect(within(lists).getByText('All done for now.')).toBeInTheDocument();
    expect(smalls(lists)).toEqual(['Yesterday: 5 checklists missed']);
  });

  it('once every list is done, Checklists says so', () => {
    at('2026-10-05T21:30:00Z'); // 22:30 BST
    for (const [key, t] of [['opening|09:30', '08:40'], ['hothold|12:00', '11:02'], ['hothold|15:00', '14:01'], ['hothold|18:00', '17:05'], ['bar|16:30', '15:31'], ['closing|23:00', '21:20']]) {
      seedRun(`2026-10-05|${key}`, 'Sam', `2026-10-05T${t}:00Z`);
    }
    renderApp('/', manager);
    const lists = region('Checklists');
    expect(meta(lists)).toBe('6 of 6 done');
    expect(ring(lists)).toHaveAccessibleName('6 of 6 checklists done');
    expect(focus(lists)).toBeNull();
    expect(smalls(lists)).toEqual([]);
    expect(within(lists).getByText('All done for now.')).toBeInTheDocument();
    // The title is the way in to every list.
    expect(within(lists).getByRole('heading', { name: 'Checklists' }).querySelector('a')).toHaveAttribute('href', '/checklists');
  });

  it('the EOD card says when it is due without a countdown all day', () => {
    at('2026-10-05T16:10:00Z'); // 17:10 BST, nothing late or due
    renderApp('/', manager);
    expect(screen.getByText('Due after close')).toBeInTheDocument();
  });

  it('Checklists puts the late list first, in the pill and as the one to do now, then when the next is due', () => {
    at('2026-10-05T17:30:00Z'); // 18:30 BST: Hot holding 18:00 late; four lists before it missed
    renderApp('/', manager);
    const lists = region('Checklists');
    // Late is what the header counts while anything is late.
    expect(meta(lists)).toBe('1 late');
    expect(lists.querySelector('.wh .pill')).toHaveClass('p-warn');
    // The late list is the one to do now, with how late it is, and is also Up next.
    const late = run('2026-10-05|hothold|18:00');
    expect(focus(lists)).toHaveAccessibleName('Do now: Hot holding · 18:00, 30 min late');
    expect(focus(lists)).toHaveAttribute('href', late);
    expect(hero().getByRole('link', { name: /^Do\ now:\ Hot\ holding\ ·\ 18:00,/ })).toHaveAttribute('href', late);
    // The missed lists aren't listed one by one any more; Next due is the closing list later on.
    expect(within(lists).queryByText(/Opening checks|Delivery check/)).not.toBeInTheDocument();
    expect(smalls(lists)).toEqual(['Next due · Closing checks at 23:00']);
  });

  it('when nothing else has a time to come, Checklists counts what is left instead of Next due', () => {
    at('2026-10-05T22:30:00Z'); // 23:30 BST: closing is late, everything before it missed
    renderApp('/', manager);
    const lists = region('Checklists');
    expect(meta(lists)).toBe('1 late');
    expect(focus(lists)).toHaveAccessibleName('Do now: Closing checks, 30 min late');
    expect(smalls(lists)).toEqual(['5 more to do']);
  });

  it('a missed list as the one to do now says Do now', () => {
    at('2026-10-05T10:00:00Z'); // 11:00 BST, opening missed and nothing else late or due
    renderApp('/', manager);
    const lists = region('Checklists');
    expect(meta(lists)).toBe('1 missed');
    expect(focus(lists)).toHaveAccessibleName('Do now: Opening checks, Missed');
    expect(focus(lists)).toHaveAttribute('href', run('2026-10-05|opening|09:30'));
    expect(focus(lists)!.querySelector('.mini')).toHaveTextContent('Start');
    expect(smalls(lists)).toEqual(['Next due · Hot holding at 12:00']);
  });

  it('the ring shows what is done, as a label and a filled arc', () => {
    at('2026-10-05T10:50:00Z');
    seedRun('2026-10-05|opening|09:30', 'Sam', '2026-10-05T08:42:00Z');
    seedRun('2026-10-05|bar|16:30', 'Alex', '2026-10-05T09:15:00Z');
    seedRun('2026-10-05|hothold|12:00', 'Sam', '2026-10-05T10:45:00Z');
    renderApp('/', manager);
    const r = ring(region('Checklists'));
    expect(r).toHaveAccessibleName('3 of 6 checklists done');
    // The number inside is for sighted people only; the label says it.
    expect(r.querySelector('text')).toHaveTextContent('3/6');
    expect(r.querySelector('text')).toHaveAttribute('aria-hidden', 'true');
    const fill = r.querySelector('.wring-fill')!;
    expect(fill).toHaveAttribute('stroke-dasharray', '63 126');
    expect(fill).toHaveAttribute('stroke-opacity', '1');
  });

  it('an empty ring hides its arc', () => {
    at('2026-10-05T06:00:00Z');
    renderApp('/', manager);
    const r = ring(region('Checklists'));
    expect(r).toHaveAccessibleName('0 of 6 checklists done');
    expect(r.querySelector('.wring-fill')).toHaveAttribute('stroke-opacity', '0');
  });

  it('Checklists starts what is still to come; the EOD widget is a grid of its sections, with short names', () => {
    at('2026-10-05T10:00:00Z'); // 11:00 BST, opening done
    seedRun('2026-10-05|opening|09:30', 'Sam', '2026-10-05T08:40:00Z');
    renderApp('/', manager);
    const lists = region('Checklists');
    // Nothing late or missed, so the header says only how many are done.
    expect(meta(lists)).toBe('1 of 6 done');
    expect(focus(lists)).toHaveAccessibleName(/^Start: Hot holding · 12:00, /);
    expect(smalls(lists)).toEqual(['Next due · Hot holding at 15:00']);
    expect(lists).not.toHaveTextContent(/Delivery check|Opening checks|Bar opening/);
    const eod = region('End of day report');
    expect(meta(eod)).toBe('0 of 8 done');
    // Each section is one tap away, in the report's order (a 4 × 2 grid), with the short names from W1.
    const secs = [...eod.querySelectorAll<HTMLAnchorElement>('.wsecs .wsec')];
    expect(secs.map((a) => a.textContent)).toEqual(['Lunch', 'Dinner', 'Delivery', 'Promos', 'Wages', 'Tips', 'Feedback', 'Handover']);
    expect(secs.map((a) => a.getAttribute('href'))).toEqual(['lunch', 'dinner', 'delivery', 'promotions', 'wages', 'tips', 'feedback', 'handover'].map((k) => `/close/${k}`));
    // Each says where it's up to, in its circle and its class.
    for (const a of secs) {
      expect(a).toHaveClass('wsec', 'todo');
      expect(within(a).getByRole('img', { name: 'To do' })).toBeInTheDocument();
    }
    expect(within(eod).getByRole('link', { name: /Promos$/ })).toHaveAttribute('href', '/close/promotions');
    // The next step is Up next's: no foot link here any more.
    expect(foot(eod)).toBeNull();
    expect(eod).not.toHaveTextContent(/Start lunch|net$/);
    // The manager's starting layout.
    expect(widgets()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Repairs', 'Handover', 'Recipes']);
    // The old headings are gone, and Your day is only there if added.
    expect(screen.queryByRole('heading', { name: /^(Needs you|Later today|Your day|Before you send)$/ })).not.toBeInTheDocument();
  });
});

describe('the name menu, for every role', () => {
  it('staff switch role from the menu on the shared iPad', async () => {
    const { user } = renderApp('/', staff);
    await user.click(screen.getByRole('button', { name: /Switch person/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Manager' }));
    // The manager home, with the EOD's next step as Up next (22:00).
    expect(screen.getByRole('link', { name: /^Start\ lunch,/ })).toHaveAttribute('href', '/close/lunch');
    expect(region('End of day report')).toBeInTheDocument();
  });

  it('supervisors and managers get the same menu, with their role ticked', async () => {
    const { user } = renderApp('/', supervisor);
    await user.click(screen.getByRole('button', { name: /Signed in as Jo/ }));
    expect(screen.getByRole('menu', { name: 'Your account' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Supervisor' })).toHaveAttribute('aria-checked', 'true');
    // Only managers and head office look after people.
    expect(screen.queryByRole('menuitem', { name: 'People' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitemradio', { name: 'Manager' }));
    await user.click(screen.getByRole('button', { name: /Signed in as Jo/ }));
    expect(screen.getByRole('menuitem', { name: 'People' })).toBeInTheDocument();
  });

  it('signs out from the menu', async () => {
    const { user } = renderApp('/', manager);
    await user.click(screen.getByRole('button', { name: /Signed in as Jo/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(screen.getByRole('heading', { name: 'End of day report' })).toBeInTheDocument();
  });

  it('head office gets back to a site view too', async () => {
    const { user } = renderApp('/head-office', admin);
    await user.click(await screen.findByRole('button', { name: /Signed in as Ana/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Supervisor' }));
    expect(screen.getByRole('heading', { name: /, Ana$/ })).toBeInTheDocument();
  });
});

describe('manager home on a wide screen (two columns, 1100px and up)', () => {
  /** A desktop-sized screen: every min-width query matches. */
  const desktop = () => {
    window.matchMedia = ((q: string) => ({ matches: /min-width/.test(q), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  };
  const phone = () => { delete (window as { matchMedia?: unknown }).matchMedia; };

  it('the main card sits in the widget grid, and an unexplained cash difference shows in End of day report', async () => {
    await seedVerifiedDraft((d) => { d.sessions.dinner.cash.tillCash = 40000; });
    desktop();
    try {
      renderApp('/', manager);
      const eod = await screen.findByRole('region', { name: 'End of day report' });
      expect(eod.closest('.mh-desk')).not.toBeNull();
      // On desktop the main card is the first thing in the grid, and the widgets fill in around it.
      const grid = document.querySelector('.wgrid.with-card')!;
      expect(grid.firstElementChild).toHaveClass('wcard');
      expect(grid.querySelector('.wcard .hero')).not.toBeNull();
      expect(eod.parentElement).toBe(grid);
      const issue = within(eod).getByRole('link', { name: /Add a reason to submit\./ });
      expect(issue).toHaveAttribute('href', '/close/dinner');
      expect(screen.queryByRole('region', { name: 'Before you send' })).not.toBeInTheDocument();
    } finally {
      phone();
    }
  });

  it('with nothing wrong and no handover, there is no Before you send section', async () => {
    await seedVerifiedDraft();
    desktop();
    try {
      renderApp('/', manager);
      expect(await screen.findByRole('region', { name: 'Checklists' })).toBeInTheDocument();
      expect(document.querySelector('.mh-desk')).not.toBeNull();
      expect(screen.queryByRole('region', { name: 'Before you send' })).not.toBeInTheDocument();
      expect(rows(region('End of day report'))).toHaveLength(0);
      expect(screen.getByRole('region', { name: 'Food safety' })).toBeInTheDocument();
    } finally {
      phone();
    }
  });

  it('on a phone, the main card comes before the grid, and End of day report has its sections, then the same issue', async () => {
    await seedVerifiedDraft((d) => { d.sessions.dinner.cash.tillCash = 40000; });
    renderApp('/', manager);
    const eod = await screen.findByRole('region', { name: 'End of day report' });
    expect(document.querySelector('.mh-desk')).toBeNull();
    expect(document.querySelector('.wcard')).toBeNull();
    expect(document.querySelector('.hero')!.compareDocumentPosition(document.querySelector('.wgrid')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const links = within(eod).getAllByRole('link');
    const issue = links.findIndex((l) => l.getAttribute('href') === '/close/dinner' && /Add a reason to submit\./.test(l.textContent ?? ''));
    expect(issue).toBeGreaterThan(links.findIndex((l) => l.textContent === 'Handover'));
    expect(rows(eod)).toHaveLength(1);
    expect(rows(eod)[0]).toHaveTextContent('Add a reason to submit.');
  });
});

describe('Checklists on the home', () => {
  it('a site with no checklists, and nothing missed yesterday, says so in Checklists', () => {
    localStorage.setItem('mgh.templates.v1', '[]');
    at('2026-10-05T10:00:00Z');
    renderApp('/', manager);
    expect(screen.getByRole('region', { name: 'End of day report' })).toBeInTheDocument();
    const lists = region('Checklists');
    expect(within(lists).getByText('No checklists today.')).toBeInTheDocument();
    expect(rows(lists)).toHaveLength(0);
    expect(meta(lists)).toBe('0 of 0 done');
  });

  it('a list done when needed stays off the Checklists widget, one tap away on the Checklists screen', () => {
    at('2026-10-05T10:00:00Z');
    renderApp('/', staff);
    const lists = region('Checklists');
    expect(within(lists).queryByText(/Delivery check|When needed/)).not.toBeInTheDocument();
    expect(focus(lists)).not.toHaveAccessibleName(/Delivery check/);
    expect(within(lists).getByRole('heading', { name: 'Checklists' }).querySelector('a')).toHaveAttribute('href', '/checklists');
  });
});

describe('End of day report widget (W1)', () => {
  it('each section in the grid shows where it is up to; problems still show under it', async () => {
    // The verified example: lunch, dinner, delivery and wages done; an unexplained cash difference at dinner.
    await seedVerifiedDraft((d) => { d.sessions.dinner.cash.tillCash = 40000; });
    renderApp('/', manager);
    const eod = await screen.findByRole('region', { name: 'End of day report' });
    const state = (name: string) => within(eod).getByRole('link', { name: new RegExp(`${name}$`) });
    for (const k of ['Lunch', 'Dinner', 'Delivery', 'Wages']) expect(state(k)).toHaveClass('done');
    for (const k of ['Promos', 'Tips', 'Feedback', 'Handover']) expect(state(k)).not.toHaveClass('done');
    expect(eod.querySelectorAll('.wsec')).toHaveLength(8);
    // The issue row follows the grid.
    expect(rows(eod)).toHaveLength(1);
    expect(rows(eod)[0]).toHaveTextContent('Add a reason to submit.');
    expect(rows(eod)[0]).toHaveAttribute('href', '/close/dinner');
    expect(eod.querySelector('.wsecs')!.compareDocumentPosition(rows(eod)[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Stock widget (W1)', () => {
  it('a count due today, what is running low and a delivery to check, each with its button', () => {
    renderApp('/', manager);
    const st = region('Stock');
    expect(within(st).getByRole('link', { name: 'Open stock' })).toHaveAttribute('href', '/stock');
    const lines = [...st.querySelectorAll<HTMLAnchorElement>('a.ln')];
    expect(lines).toHaveLength(3);
    const mini = (a: Element) => a.querySelector('.mini')!.textContent;
    // A count not started yet: Start.
    expect(lines[0]).toHaveTextContent(/^Bar spot count due todayNot started yet/);
    expect(lines[0]).toHaveAttribute('href', '/stock');
    expect(mini(lines[0]!)).toBe('Start');
    expect(within(st).queryByRole('progressbar')).not.toBeInTheDocument();
    // Running low: Order.
    expect(lines[1]).toHaveTextContent(/^\d+ running low/);
    expect(lines[1]).toHaveAttribute('href', '/stock/order');
    expect(mini(lines[1]!)).toBe('Order');
    // One delivery to check: Check in, straight to it.
    expect(lines[2]).toHaveTextContent(/^Delivery · .+Tick what came/);
    expect(lines[2]!.getAttribute('href')).toMatch(/^\/stock\/delivery\/.+/);
    expect(mini(lines[2]!)).toBe('Check in');
    // The buttons are decoration inside the link, not separate controls.
    for (const a of lines) expect(a.querySelector('.mini')).toHaveAttribute('aria-hidden', 'true');
  });

  it('a count part done shows how far it got, with a progress bar and Carry on', async () => {
    const r = renderApp('/stock', staff);
    await r.user.click(screen.getByRole('button', { name: 'Start count' }));
    await r.user.type(screen.getByRole('textbox', { name: 'Tanduay rum 70cl, bottles' }), '5');
    await r.user.click(screen.getByRole('button', { name: "Next: Gordon's gin 70cl" }));
    r.unmount();
    renderApp('/', manager);
    const st = region('Stock');
    const count = st.querySelector<HTMLAnchorElement>('a.ln')!;
    expect(count).toHaveTextContent(/^Bar spot count1 of 5 counted/);
    expect(count.querySelector('.mini')).toHaveTextContent('Carry on');
    const bar = within(st).getByRole('progressbar', { name: 'Bar spot count counted' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar.querySelector('i')).toHaveStyle({ width: '20%' });
  });
});

describe('Food safety widget (W1)', () => {
  it('is half-width, with four quick links', () => {
    renderApp('/', manager);
    const fs = region('Food safety');
    expect(fs).not.toHaveClass('wide');
    const quick = [...fs.querySelectorAll<HTMLAnchorElement>('.wqa a')];
    expect(quick.map((a) => a.textContent)).toEqual(['Log temp', 'Delivery', 'Allergens', 'Problem']);
    expect(quick.map((a) => a.getAttribute('href'))).toEqual(['/food-safety/probes', '/food-safety/deliveries/new', '/food-safety/allergens', '/report']);
    // Short words on screen, full names for screen readers.
    // Named by its visible words, so voice control works.
    expect(within(fs).getByRole('link', { name: 'Log temp' })).toBe(quick[0]);
    expect(within(fs).getByRole('link', { name: 'Delivery' })).toBe(quick[1]);
    expect(within(fs).getByRole('link', { name: 'Allergens' })).toBe(quick[2]);
    expect(within(fs).getByRole('link', { name: 'Report a problem' })).toBe(quick[3]);
  });

  it('a dot on the icon says how many things need doing, and when something failed; no pill or first item', () => {
    renderApp('/', manager);
    const fs = region('Food safety');
    // The example data has something failed (test/setup.ts trading day).
    // The dot is drawn on the icon, which is hidden from screen readers as a whole.
    const icon = fs.querySelector('.wh .wi')!;
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    const dot = icon.querySelector('.wdot');
    expect(dot).toHaveClass('wdot', 'bad');
    expect(within(fs).queryByRole('img')).not.toBeInTheDocument();
    expect(fs.querySelector('.wh .pill')).toBeNull();
    expect(fs.querySelector('.wfirst')).toBeNull();
    // The title link goes to the hub and reads the dot after the name.
    expect(within(fs).getByRole('link', { name: /^Food safety, \d+ to do, something failed$/ })).toHaveAttribute('href', '/food-safety');
  });
});

describe('home top bar', () => {
  // jsdom has no scrollIntoView; the search list calls it to keep the picked row in view.
  const had = Element.prototype.scrollIntoView;
  beforeEach(() => { Element.prototype.scrollIntoView = () => {}; });
  afterEach(() => { Element.prototype.scrollIntoView = had; });

  it('on a phone, Search sits next to the account and opens the search', async () => {
    const { user } = renderApp('/', manager);
    const bar = document.querySelector<HTMLElement>('header.homenav')!;
    const search = within(bar).getByRole('button', { name: 'Search' });
    // Search and the account sit together on the right.
    expect(search.closest('.homenav-r')).toContainElement(within(bar).getByRole('button', { name: /^Signed in as Jo\. Menu$/ }));
    expect(screen.queryByRole('dialog', { name: 'Search or jump to' })).not.toBeInTheDocument();
    await user.click(search);
    const dialog = screen.getByRole('dialog', { name: 'Search or jump to' });
    expect(within(dialog).getByRole('combobox', { name: 'Search' })).toHaveFocus();
  });

  it('staff on the shared iPad get Search too', async () => {
    const { user } = renderApp('/', staff);
    await user.click(within(document.querySelector<HTMLElement>('header.homenav')!).getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('dialog', { name: 'Search or jump to' })).toBeInTheDocument();
  });
});
