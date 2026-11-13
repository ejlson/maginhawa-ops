import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { admin, manager, renderApp, staff, supervisor } from './harness';
import { setNow } from '../app/lib/clock';
import { deviceChecklistStore, deviceStore } from '../app/lib/store';
import { verifiedDraft } from '../../../packages/core/test/fixtures';

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
    const up = screen.getByRole('link', { name: /^Start:\ Hot\ holding\ ·\ 12:00,/ });
    expect(up).toHaveAttribute('href', hot);
    expect(up.closest('.hero')!).toHaveTextContent('Your checklists');
    expect(up.closest('.hero')!).toHaveTextContent('0 of 6 checklists done');
    expect(screen.getByRole('link', { name: /^Report a problem/ })).toHaveAttribute('href', '/report');
    expect(screen.queryByText(/EOD/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^End-of-day report/ })).not.toBeInTheDocument();
  });

  it('Needs you shows their due and missed lists, counted separately, and nothing for managers only', () => {
    at('2026-10-05T10:50:00Z'); // 11:50 BST
    renderApp('/', staff);
    const needs = screen.getByRole('heading', { name: 'Needs you' }).closest('section')!;
    expect(within(needs.querySelector('.hd')! as HTMLElement).getByText('1 due · 1 missed')).toBeInTheDocument();
    expect(within(needs).getByRole('link', { name: /^Hot holding · 12:00.*Due in 10 min$/ })).toBeInTheDocument();
    expect(within(needs).getByRole('link', { name: /^Opening checks.*Missed$/ })).toHaveAttribute('href', '/day');
    // Repairs and EOD issues are for supervisors and managers.
    expect(within(needs).queryByText(/repair/i)).not.toBeInTheDocument();
  });

  it('a late list is the one to do now', () => {
    at('2026-10-05T11:10:00Z'); // 12:10 BST: Hot holding 12:00 is 10 min late
    renderApp('/', staff);
    expect(screen.getByRole('link', { name: /^Do\ now:\ Hot\ holding\ ·\ 12:00,/ })).toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|hothold|12:00'));
    const needs = screen.getByRole('heading', { name: 'Needs you' }).closest('section')!;
    expect(needs.querySelector('.hd')!).toHaveTextContent('1 late · 1 missed');
  });

  it('done lists count in the card but are no longer listed on home', () => {
    at('2026-10-05T10:50:00Z');
    seedRun('2026-10-05|opening|09:30', 'Sam', '2026-10-05T08:42:00Z');
    renderApp('/', staff);
    expect(screen.getByRole('link', { name: /^Start:\ Hot\ holding\ ·\ 12:00,/ }).closest('.hero')!).toHaveTextContent('1 of 6 checklists done');
    expect(screen.queryByText(/Opening checks/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Done 09:42/)).not.toBeInTheDocument();
    // Nothing missed now, only the due list.
    const needs = screen.getByRole('heading', { name: 'Needs you' }).closest('section')!;
    expect(needs.querySelector('.hd')!).toHaveTextContent(/^Needs you1 due$/);
  });

  it('Later today lists what is coming, then Report a problem, with no EOD row', () => {
    at('2026-10-05T10:00:00Z'); // 11:00 BST
    seedRun('2026-10-05|opening|09:30', 'Sam', '2026-10-05T08:40:00Z');
    renderApp('/', staff);
    const later = screen.getByRole('heading', { name: 'Later today' }).closest('section')!;
    const rows = within(later).getAllByRole('link').slice(1);
    expect(rows[0]).toHaveTextContent(/^12:00Hot holding · 12:00/);
    const last = rows.at(-1)!;
    expect(last).toHaveAccessibleName(/^Report a problem/);
    expect(last).toHaveAttribute('href', '/report');
    expect(last).toHaveTextContent('Something broken or not working');
    expect(within(later).queryByRole('link', { name: /End-of-day report/ })).not.toBeInTheDocument();
    // Nothing late, due or missed yet.
    // Nothing urgent: Needs you is either gone or holds only food safety (which has its own reminders).
    const needsHd = screen.queryByRole('heading', { name: 'Needs you' });
    if (needsHd) expect(within(needsHd.closest('section')!).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringMatching(/^Food safety/)]);
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

  it('an unread handover from last night is in Needs you', async () => {
    await seedHandover();
    renderApp('/', staff);
    expect(screen.queryByRole('heading', { name: 'From last night' })).not.toBeInTheDocument();
    const needs = screen.getByRole('heading', { name: 'Needs you' }).closest('section')!;
    const row = within(needs).getByRole('link', { name: /^Handover from / });
    expect(row).toHaveAttribute('href', '/handover');
    expect(row).toHaveTextContent('Walk-in door sticks, push it shut.');
    expect(within(row).getByText('New')).toBeInTheDocument();
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
    const needs = screen.getByRole('heading', { name: 'Needs you' }).closest('section')!;
    await m.user.click(within(needs).getByRole('link', { name: /Dishwasher leaking/ }));
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    await m.user.click(screen.getByRole('button', { name: 'Fixed' }));
    await m.user.click(screen.getByRole('button', { name: 'Tap again' }));
    expect(screen.getByText('Nothing open. Good.')).toBeInTheDocument();
  });

  it('staff can\'t open the repairs list', () => {
    renderApp('/repairs', staff);
    expect(screen.queryByRole('heading', { name: 'Repairs' })).not.toBeInTheDocument();
  });
});

describe('supervisor home (during service)', () => {
  it('shows the shift: what is late, who did what, and the handover to write', () => {
    at('2026-10-05T09:00:00Z'); // 10:00 BST, opening was due 09:30
    seedRun('2026-10-05|bar|16:30', 'Alex', '2026-10-05T08:10:00Z');
    renderApp('/', supervisor);
    expect(screen.getByRole('heading', { name: 'Good morning, Jo' })).toBeInTheDocument();
    const stats = screen.getByRole('group', { name: 'Today so far: 1 of 6 checklists done, 1 late or missed' });
    expect(stats).toHaveTextContent('1Late or missed');
    expect(stats).toHaveTextContent('0Re-checks due');
    expect(stats).toHaveTextContent('£0EOD so far');
    expect(stats.closest('.hero')!).toHaveTextContent('Today so far');
    const needs = screen.getByRole('heading', { name: 'Needs you' }).closest('section')!;
    expect(within(needs).getByRole('link', { name: /^Opening checks.*30 min late$/ })).toBeInTheDocument();
    const shift = screen.getByRole('heading', { name: 'On shift' }).closest('section')!;
    expect(shift).toHaveTextContent('Who did what');
    expect(within(shift).getByText('Alex')).toBeInTheDocument();
    expect(within(shift).getByText('1 done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Do\ now:\ Opening\ checks,/ })).toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|opening|09:30'));
    const later = screen.getByRole('heading', { name: 'Later today' }).closest('section')!;
    expect(within(later).getByRole('link', { name: 'Write the handover' })).toHaveAttribute('href', '/close/handover');
    expect(within(later).getByRole('link', { name: /^End-of-day report/ })).toHaveAttribute('href', '/close');
  });

  it('Needs you counts late, due and missed separately', () => {
    at('2026-10-05T11:10:00Z'); // 12:10 BST: Hot holding 12:00 late, opening missed
    renderApp('/', supervisor);
    const needs = screen.getByRole('heading', { name: 'Needs you' }).closest('section')!;
    expect(needs.querySelector('.hd')!).toHaveTextContent(/^Needs you1 late · 1 missed$/);
    expect(screen.getByRole('group', { name: 'Today so far: 0 of 6 checklists done, 2 late or missed' })).toHaveTextContent('2Late or missed');
  });

  it('a list that is only due is counted as due, not late', () => {
    at('2026-10-05T10:50:00Z'); // 11:50 BST: Hot holding 12:00 due, opening missed
    renderApp('/', supervisor);
    const needs = screen.getByRole('heading', { name: 'Needs you' }).closest('section')!;
    expect(needs.querySelector('.hd')!).toHaveTextContent(/^Needs you1 due · 1 missed$/);
    expect(screen.getByRole('group', { name: 'Today so far: 0 of 6 checklists done, 1 late or missed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Start:\ Hot\ holding\ ·\ 12:00,/ })).toBeInTheDocument();
  });

  it('with nothing urgent, Up next is the EOD\'s next section', () => {
    at('2026-10-05T06:00:00Z'); // 07:00 BST
    renderApp('/', supervisor);
    expect(screen.getByRole('link', { name: /^Start\ lunch,/ })).toHaveAttribute('href', '/close/lunch');
    expect(screen.queryByRole('link', { name: /^(Do now|Start): / })).not.toBeInTheDocument();
    // Nothing urgent: Needs you is either gone or holds only food safety (which has its own reminders).
    const needsHd = screen.queryByRole('heading', { name: 'Needs you' });
    if (needsHd) expect(within(needsHd.closest('section')!).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringMatching(/^Food safety/)]);
  });

  it('before anyone has finished a list, says so', () => {
    at('2026-10-05T06:00:00Z');
    renderApp('/', supervisor);
    expect(screen.getByText('Nobody has finished a checklist yet today.')).toBeInTheDocument();
  });
});

describe('manager home', () => {
  it('in the morning, an unread handover is the next step, and reading it clears it', async () => {
    at('2026-10-05T07:00:00Z'); // 08:00 BST, nothing due yet
    await seedHandover();
    const { user } = renderApp('/', manager);
    const needs = screen.getByRole('heading', { name: 'Needs you' }).closest('section')!;
    expect(within(needs).getByText('New')).toBeInTheDocument();
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
  });

  it('folds the checklists into one row once they are all done', () => {
    at('2026-10-05T21:30:00Z'); // 22:30 BST
    for (const [key, t] of [['opening|09:30', '08:40'], ['hothold|12:00', '11:02'], ['hothold|15:00', '14:01'], ['hothold|18:00', '17:05'], ['bar|16:30', '15:31'], ['closing|23:00', '21:20']]) {
      seedRun(`2026-10-05|${key}`, 'Sam', `2026-10-05T${t}:00Z`);
    }
    renderApp('/', manager);
    expect(screen.getByRole('link', { name: /All 6 checklists done/ })).toHaveTextContent('Last at 22:20 by Sam');
  });

  it('the EOD card says when it is due without a countdown all day', () => {
    at('2026-10-05T16:10:00Z'); // 17:10 BST, nothing late or due
    renderApp('/', manager);
    expect(screen.getByText('Due after close')).toBeInTheDocument();
  });

  it('Needs you counts what is late and missed, with a row per missed list', () => {
    at('2026-10-05T17:30:00Z'); // 18:30 BST: Hot holding 18:00 late; four lists before it missed
    renderApp('/', manager);
    const needs = screen.getByRole('heading', { name: 'Needs you' }).closest('section')!;
    expect(within(needs.querySelector('.hd')! as HTMLElement).getByText('1 late · 4 missed')).toBeInTheDocument();
    // The late list leads, with how late it is, and is also Up next.
    const late = '/checklists/' + encodeURIComponent('2026-10-05|hothold|18:00');
    expect(within(needs).getByRole('link', { name: /^Hot holding · 18:00.*30 min late$/ })).toHaveAttribute('href', late);
    expect(screen.getByRole('link', { name: /^Do\ now:\ Hot\ holding\ ·\ 18:00,/ })).toHaveAttribute('href', late);
    // More than three missed: two rows, then the rest folded into one.
    const missedRow = within(needs).getByRole('link', { name: /^Opening checks/ });
    expect(missedRow).toHaveAttribute('href', '/day');
    expect(missedRow).toHaveTextContent('add a note');
    expect(within(missedRow).getByText('Missed')).toHaveClass('pill', 'p-bad');
    expect(within(needs).getAllByText('Missed')).toHaveLength(2);
    expect(within(needs).getByRole('link', { name: /2 more missed/ })).toHaveAttribute('href', '/day');
    // The number badge is decoration; screen readers hear the title only once.
    expect(within(needs).getByRole('link', { name: /^2 more missed/ })).toBeInTheDocument();
  });

  it('Later today lists what is still to come, then the EOD, in time order', () => {
    at('2026-10-05T10:00:00Z'); // 11:00 BST, opening done
    seedRun('2026-10-05|opening|09:30', 'Sam', '2026-10-05T08:40:00Z');
    renderApp('/', manager);
    const later = screen.getByRole('heading', { name: 'Later today' }).closest('section')!;
    expect(within(later).getByRole('link', { name: 'Now 11:00' })).toHaveAttribute('href', '/day');
    const rows = within(later).getAllByRole('link').slice(1).map((l) => l.textContent);
    expect(rows[0]).toMatch(/^12:00Hot holding · 12:00/);
    expect(rows.at(-1)).toMatch(/^End-of-day report8 sections · start any time/);
    // Done lists drop off; at most four upcoming lists are shown.
    expect(rows.join()).not.toMatch(/Opening checks/);
    expect(rows.length).toBeLessThanOrEqual(5);
    // Nothing late or missed, so Needs you stays away.
    // Nothing urgent: Needs you is either gone or holds only food safety (which has its own reminders).
    const needsHd = screen.queryByRole('heading', { name: 'Needs you' });
    if (needsHd) expect(within(needsHd.closest('section')!).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringMatching(/^Food safety/)]);
  });
});

describe('the name menu, for every role', () => {
  it('staff switch role from the menu on the shared iPad', async () => {
    const { user } = renderApp('/', staff);
    await user.click(screen.getByRole('button', { name: /Switch person/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Manager' }));
    // The manager home, with the EOD's next step as Up next (22:00).
    expect(screen.getByRole('link', { name: /^Start\ lunch,/ })).toHaveAttribute('href', '/close/lunch');
    expect(screen.getByRole('link', { name: /^End-of-day report/ })).toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: 'Close the day' })).toBeInTheDocument();
  });

  it('head office gets back to a site view too', async () => {
    const { user } = renderApp('/head-office', admin);
    await user.click(await screen.findByRole('button', { name: /Signed in as Ana/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Supervisor' }));
    expect(screen.getByRole('heading', { name: /, Ana$/ })).toBeInTheDocument();
  });
});
