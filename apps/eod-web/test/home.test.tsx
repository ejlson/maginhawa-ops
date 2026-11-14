import { describe, expect, it } from 'vitest';
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
/** A widget's rows (the checklists to do, the missed-yesterday row, EOD issues). */
const rows = (sec: HTMLElement) => [...sec.querySelectorAll<HTMLElement>('.sub a')];
/** The link at the foot of a widget ("3 more to do", "Start lunch", "Write the handover"…). */
const foot = (sec: HTMLElement) => sec.querySelector<HTMLElement>('.wfoot');
/** The widgets on the home, in order. */
const widgets = () => [...document.querySelectorAll('section[data-widget]')].map((w) => w.getAttribute('aria-label'));
const run = (key: string) => '/checklists/' + encodeURIComponent(key);
/** Put widgets that are off by default (Repairs for staff and supervisors, Handover, On shift) on this person's home, as Customise would. */
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
    withWidgets(staff, 'repairs');
    renderApp('/', staff);
    expect(screen.getByRole('heading', { name: 'Hi Sam' })).toBeInTheDocument();
    const hot = '/checklists/' + encodeURIComponent('2026-10-05|hothold|12:00');
    const up = screen.getByRole('link', { name: /^Start:\ Hot\ holding\ ·\ 12:00,/ });
    expect(up).toHaveAttribute('href', hot);
    expect(up.closest('.hero')!).toHaveTextContent('Checklists to do today');
    expect(up.closest('.hero')!).toHaveTextContent('0 of 6 checklists done');
    expect(within(region('Repairs')).getByRole('link', { name: /^Report a problem/ })).toHaveAttribute('href', '/report');
    expect(screen.queryByText(/EOD/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'End of day report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^End of day report/ })).not.toBeInTheDocument();
  });

  it('Checklists puts their due list, then the missed one, then what is coming, and nothing for managers only', () => {
    at('2026-10-05T10:50:00Z'); // 11:50 BST
    withWidgets(staff, 'repairs');
    renderApp('/', staff);
    const lists = region('Checklists');
    expect(within(lists).getByRole('heading', { name: 'Checklists' })).toBeInTheDocument();
    expect(meta(lists)).toBe('1 missed');
    expect(lists.querySelector('.wh .pill')).toHaveClass('p-warn');
    const todo = rows(lists);
    expect(todo[0]).toHaveTextContent(/^Hot holding · 12:00.*Due in 10 min$/);
    expect(todo[0]).toHaveAttribute('href', run('2026-10-05|hothold|12:00'));
    expect(todo[1]).toHaveTextContent(/^Opening checks.*Missed$/);
    expect(todo[1]).toHaveAttribute('href', run('2026-10-05|opening|09:30'));
    // Then what's coming, with its time; the widget shows three and counts the rest.
    expect(todo[2]).toHaveTextContent(/^Hot holding · 15:00.*15:00$/);
    expect(todo).toHaveLength(3);
    expect(foot(lists)).toHaveTextContent('3 more to do0 of 6 done');
    expect(foot(lists)).toHaveAttribute('href', '/checklists');
    // Lists done when needed stay on the Checklists screen; no missed-yesterday row for staff.
    expect(within(lists).queryByText(/Delivery check|Yesterday/)).not.toBeInTheDocument();
    // Open repairs and EOD issues are for supervisors and managers; staff only get a way to report one.
    expect(within(region('Repairs')).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringMatching(/^Report a problem/)]);
    expect(screen.queryByRole('region', { name: 'End of day report' })).not.toBeInTheDocument();
  });

  it('a late list is the one to do now', () => {
    at('2026-10-05T11:10:00Z'); // 12:10 BST: Hot holding 12:00 is 10 min late
    renderApp('/', staff);
    expect(screen.getByRole('link', { name: /^Do\ now:\ Hot\ holding\ ·\ 12:00,/ })).toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|hothold|12:00'));
    const lists = region('Checklists');
    // The header counts what's late first.
    expect(meta(lists)).toBe('1 late');
    expect(lists.querySelector('.wh .pill')).toHaveClass('p-bad');
    // Late leads the rows, ahead of the missed list.
    const todo = rows(lists);
    expect(todo[0]).toHaveTextContent(/^Hot holding · 12:00.*10 min late$/);
    expect(todo[1]).toHaveTextContent(/^Opening checks.*Missed$/);
  });

  it('done lists count in the card and the widget header, and leave its rows', () => {
    at('2026-10-05T10:50:00Z');
    seedRun('2026-10-05|opening|09:30', 'Sam', '2026-10-05T08:42:00Z');
    seedRun('2026-10-05|bar|16:30', 'Alex', '2026-10-05T09:15:00Z');
    renderApp('/', staff);
    expect(screen.getByRole('link', { name: /^Start:\ Hot\ holding\ ·\ 12:00,/ }).closest('.hero')!).toHaveTextContent('2 of 6 checklists done');
    const lists = region('Checklists');
    // Nothing missed now, and the due list doesn't count as late.
    expect(meta(lists)).toBe('2 of 6 done');
    expect(within(lists).queryByText(/Opening checks|Bar opening|Delivery check/)).not.toBeInTheDocument();
    // What's left, due first, then by time.
    expect(rows(lists).map((l) => l.textContent)).toEqual([
      expect.stringMatching(/^Hot holding · 12:00.*Due in 10 min$/),
      expect.stringMatching(/^Hot holding · 15:00.*15:00$/),
      expect.stringMatching(/^Hot holding · 18:00.*18:00$/),
    ]);
    expect(foot(lists)).toHaveTextContent('1 more to do2 of 6 done');
  });

  it('Checklists lists what is coming in time order; Repairs offers Report a problem; no EOD widget', () => {
    at('2026-10-05T10:00:00Z'); // 11:00 BST
    seedRun('2026-10-05|opening|09:30', 'Sam', '2026-10-05T08:40:00Z');
    withWidgets(staff, 'repairs');
    renderApp('/', staff);
    const lists = region('Checklists');
    // Nothing late, due or missed yet.
    expect(meta(lists)).toBe('1 of 6 done');
    expect(rows(lists).map((l) => l.textContent)).toEqual([
      expect.stringMatching(/^Hot holding · 12:00.*12:00$/),
      expect.stringMatching(/^Hot holding · 15:00.*15:00$/),
      expect.stringMatching(/^Bar opening.*16:30$/),
    ]);
    expect(foot(lists)).toHaveTextContent('2 more to do');
    const repairs = region('Repairs');
    // Staff can't open the repairs list, so the title isn't a link; the only way in is Report a problem.
    expect(within(repairs).getByRole('heading', { name: 'Repairs' })).toBeInTheDocument();
    expect(within(repairs).getAllByRole('link').map((l) => l.textContent)).toEqual(['Report a problem']);
    expect(within(repairs).getByRole('link', { name: /^Report a problem/ })).toHaveAttribute('href', '/report');
    expect(repairs).toHaveTextContent('Something broken? Take a photo and it goes to your manager.');
    expect(screen.queryByRole('region', { name: 'End of day report' })).not.toBeInTheDocument();
    expect(within(region('Food safety')).getByRole('link', { name: /^Food safety/ })).toHaveAttribute('href', '/food-safety');
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
    withWidgets(staff, 'handover');
    renderApp('/', staff);
    expect(screen.queryByRole('heading', { name: 'From last night' })).not.toBeInTheDocument();
    const sec = region('Handover');
    expect(within(sec).getByRole('heading', { name: 'Handover' })).toBeInTheDocument();
    expect(meta(sec)).toBe('New');
    expect(within(sec).getByText('New')).toHaveClass('pill', 'p-new');
    // Staff don't get the handover to write.
    expect(within(sec).getAllByRole('link')).toHaveLength(1);
    const row = within(sec).getByRole('link', { name: /^Handover from / });
    expect(row).toHaveAttribute('href', '/handover');
    expect(row).toHaveTextContent('Walk-in door sticks, push it shut.');
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

describe('supervisor home (during service)', () => {
  it('shows the shift: what is late, who did what, and the handover to write', () => {
    at('2026-10-05T09:00:00Z'); // 10:00 BST, opening was due 09:30
    seedRun('2026-10-05|bar|16:30', 'Alex', '2026-10-05T08:10:00Z');
    withWidgets(supervisor, 'onshift', 'handover');
    renderApp('/', supervisor);
    expect(screen.getByRole('heading', { name: 'Good morning, Jo' })).toBeInTheDocument();
    const stats = screen.getByRole('group', { name: 'Checklists to do today: 1 of 6 checklists done, 1 late or missed' });
    expect(stats).toHaveTextContent('1Late or missed');
    expect(stats).toHaveTextContent('0Re-checks due');
    expect(stats).toHaveTextContent('£0EOD so far');
    expect(stats.closest('.hero')!).toHaveTextContent('Checklists to do today');
    const lists = region('Checklists');
    expect(rows(lists)[0]).toHaveTextContent(/^Opening checks.*30 min late$/);
    // Done lists leave the rows; who did them is under On shift.
    expect(within(lists).queryByText('Bar opening')).not.toBeInTheDocument();
    const shift = region('On shift');
    expect(within(shift).getByRole('heading', { name: 'On shift' })).toBeInTheDocument();
    expect(meta(shift)).toBe('Who did what');
    expect(within(shift).getByText('Alex')).toBeInTheDocument();
    expect(shift).toHaveTextContent('Bar opening 09:10');
    expect(within(shift).getByText('1 done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Do\ now:\ Opening\ checks,/ })).toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|opening|09:30'));
    const eod = region('End of day report');
    expect(within(eod).getByRole('heading', { name: 'End of day report' }).querySelector('a')).toHaveAttribute('href', '/close');
    // The EOD's next step is at the foot of its widget.
    expect(foot(eod)).toHaveAttribute('href', '/close/lunch');
    expect(foot(eod)).toHaveTextContent(/^Start lunch£0\.00 net$/);
    expect(within(region('Handover')).getByRole('link', { name: 'Write the handover' })).toHaveAttribute('href', '/close/handover');
  });

  it('Write the handover sits in Handover, after last night\'s handover, until the EOD is sent', async () => {
    await seedHandover();
    withWidgets(supervisor, 'handover');
    renderApp('/', supervisor);
    const sec = region('Handover');
    expect(within(sec).getByText('New')).toHaveClass('pill', 'p-new');
    const links = within(sec).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleName(/^Handover from /);
    expect(links[1]).toHaveAccessibleName('Write the handover');
    expect(links[1]).toHaveAttribute('href', '/close/handover');
  });

  it('once the EOD is sent, Write the handover goes', async () => {
    await seedVerifiedDraft((d) => { d.confirmed = true; });
    withWidgets(supervisor, 'handover');
    const { user } = renderApp('/close', supervisor);
    await user.click(screen.getByRole('button', { name: 'Submit all' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('heading', { name: 'Day closed' });
    renderApp('/', supervisor);
    expect(meta(region('End of day report'))).toBe('Sent');
    expect(foot(region('End of day report'))).toHaveTextContent(/^See the report/);
    expect(within(region('Handover')).queryByRole('link', { name: 'Write the handover' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Write the handover' })).not.toBeInTheDocument();
  });

  it('Needs you counts late, due and missed separately', () => {
    at('2026-10-05T11:10:00Z'); // 12:10 BST: Hot holding 12:00 late, opening missed
    renderApp('/', supervisor);
    const lists = region('Checklists');
    // The header leads with what's late; the rows show the late list, then the missed one.
    expect(meta(lists)).toBe('1 late');
    expect(rows(lists)[0]).toHaveTextContent(/^Hot holding · 12:00.*10 min late$/);
    expect(rows(lists)[1]).toHaveTextContent(/^Opening checks.*Missed$/);
    expect(screen.getByRole('group', { name: 'Checklists to do today: 0 of 6 checklists done, 2 late or missed' })).toHaveTextContent('2Late or missed');
  });

  it('a list that is only due is counted as due, not late', () => {
    at('2026-10-05T10:50:00Z'); // 11:50 BST: Hot holding 12:00 due, opening missed
    renderApp('/', supervisor);
    const lists = region('Checklists');
    expect(meta(lists)).toBe('1 missed');
    expect(rows(lists)[0]).toHaveTextContent(/^Hot holding · 12:00.*Due in 10 min$/);
    expect(screen.getByRole('group', { name: 'Checklists to do today: 0 of 6 checklists done, 1 late or missed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Start:\ Hot\ holding\ ·\ 12:00,/ })).toBeInTheDocument();
  });

  it('with nothing urgent, Up next is the EOD\'s next section', () => {
    at('2026-10-05T06:00:00Z'); // 07:00 BST
    renderApp('/', supervisor);
    expect(screen.getByRole('link', { name: /^Start\ lunch,/ })).toHaveAttribute('href', '/close/lunch');
    expect(screen.queryByRole('link', { name: /^(Do now|Start): / })).not.toBeInTheDocument();
    // Nothing late or missed yet.
    expect(meta(region('Checklists'))).toBe('0 of 6 done');
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
    withWidgets(manager, 'handover');
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
    expect(screen.getByText('5 checklists missed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^5 checklists missed/ })).toHaveAttribute('href', '/checklists');
    // It sits after today's rows in Checklists.
    const todo = rows(region('Checklists'));
    expect(todo).toHaveLength(4);
    expect(todo.at(-1)).toHaveAccessibleName(/^5 checklists missed.*Yesterday/);
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
    expect(rows(lists).map((l) => l.textContent)).toEqual([expect.stringMatching(/^55 checklists missed.*Yesterday$/)]);
    expect(within(lists).queryByText('All done for now.')).not.toBeInTheDocument();
    expect(foot(lists)).toHaveTextContent('All checklists6 of 6 done');
  });

  it('once every list is done, Checklists says so', () => {
    at('2026-10-05T21:30:00Z'); // 22:30 BST
    for (const [key, t] of [['opening|09:30', '08:40'], ['hothold|12:00', '11:02'], ['hothold|15:00', '14:01'], ['hothold|18:00', '17:05'], ['bar|16:30', '15:31'], ['closing|23:00', '21:20']]) {
      seedRun(`2026-10-05|${key}`, 'Sam', `2026-10-05T${t}:00Z`);
    }
    renderApp('/', manager);
    const lists = region('Checklists');
    expect(meta(lists)).toBe('6 of 6 done');
    expect(rows(lists)).toHaveLength(0);
    expect(within(lists).getByText('All done for now.')).toBeInTheDocument();
    expect(foot(lists)).toHaveTextContent('All checklists6 of 6 done');
    expect(foot(lists)).toHaveAttribute('href', '/checklists');
  });

  it('the EOD card says when it is due without a countdown all day', () => {
    at('2026-10-05T16:10:00Z'); // 17:10 BST, nothing late or due
    renderApp('/', manager);
    expect(screen.getByText('Due after close')).toBeInTheDocument();
  });

  it('Checklists counts what is late and missed, late first, then a row per missed list', () => {
    at('2026-10-05T17:30:00Z'); // 18:30 BST: Hot holding 18:00 late; four lists before it missed
    renderApp('/', manager);
    const lists = region('Checklists');
    // Late is what the header counts while anything is late.
    expect(meta(lists)).toBe('1 late');
    // The late list leads, with how late it is, and is also Up next.
    const late = run('2026-10-05|hothold|18:00');
    const todo = rows(lists);
    expect(todo[0]).toHaveTextContent(/^Hot holding · 18:00.*30 min late$/);
    expect(todo[0]).toHaveAttribute('href', late);
    expect(screen.getByRole('link', { name: /^Do\ now:\ Hot\ holding\ ·\ 18:00,/ })).toHaveAttribute('href', late);
    // Then the missed lists, earliest first, each its own row; the rest are counted at the foot.
    expect(todo).toHaveLength(3);
    for (const l of todo.slice(1)) expect(within(l).getByText('Missed')).toHaveClass('pill', 'p-bad');
    expect(todo[1]).toHaveTextContent(/^Opening checks/);
    expect(todo[1]).toHaveAttribute('href', run('2026-10-05|opening|09:30'));
    expect(todo[2]).toHaveTextContent(/^Hot holding · 12:00/);
    expect(foot(lists)).toHaveTextContent('3 more to do0 of 6 done');
    expect(within(lists).queryByText(/Delivery check/)).not.toBeInTheDocument();
  });

  it('Checklists lists what is still to come in time order; the EOD widget has its sections and next step', () => {
    at('2026-10-05T10:00:00Z'); // 11:00 BST, opening done
    seedRun('2026-10-05|opening|09:30', 'Sam', '2026-10-05T08:40:00Z');
    renderApp('/', manager);
    const lists = region('Checklists');
    // Nothing late or missed, so the header says only how many are done.
    expect(meta(lists)).toBe('1 of 6 done');
    const todo = rows(lists).map((l) => l.textContent);
    expect(todo).toHaveLength(3);
    expect(todo[0]).toMatch(/^Hot holding · 12:00.*12:00$/);
    expect(todo[1]).toMatch(/^Hot holding · 15:00.*15:00$/);
    expect(todo[2]).toMatch(/^Bar opening.*16:30$/);
    expect(todo.join()).not.toMatch(/Delivery check|Opening checks/);
    const eod = region('End of day report');
    expect(meta(eod)).toBe('0 of 8 done');
    // Each section is one tap away, in the report's order.
    const secs = [...eod.querySelectorAll<HTMLAnchorElement>('.wsecs a')];
    expect(secs.map((a) => a.textContent)).toEqual(['Lunch', 'Dinner', 'Delivery', 'Promotions & other', 'Wages', 'Tips & service charge', 'Feedback', 'Handover']);
    expect(secs[0]).toHaveAttribute('href', '/close/lunch');
    expect(foot(eod)).toHaveTextContent(/^Start lunch£0\.00 net$/);
    // The manager's starting layout.
    expect(widgets()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Recipes', 'Repairs']);
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
    expect(foot(lists)).toHaveAttribute('href', '/checklists');
    expect(within(lists).getByRole('heading', { name: 'Checklists' }).querySelector('a')).toHaveAttribute('href', '/checklists');
  });
});
