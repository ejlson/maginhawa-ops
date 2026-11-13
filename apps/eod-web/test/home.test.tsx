import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { admin, manager, renderApp, seedVerifiedDraft, staff, supervisor } from './harness';
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

/** A home section by name (Checklists, Repairs, End of day, Food safety). */
const region = (name: string) => screen.getByRole('region', { name });
/** The count line in a section's header, e.g. "1 of 6 done · 1 late · 1 missed". */
const meta = (sec: HTMLElement) => sec.querySelector('.hd span')?.textContent ?? '';
/** One group of a section ("To do", "Done"), or null when it isn't shown. */
const group = (sec: HTMLElement, label: string) =>
  [...sec.querySelectorAll<HTMLElement>('.sub')].find((g) => g.querySelector('.sl span')?.textContent === label) ?? null;
const run = (key: string) => '/checklists/' + encodeURIComponent(key);

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

  it('Checklists puts their due list, then the missed one, then what is coming in To do, and nothing for managers only', () => {
    at('2026-10-05T10:50:00Z'); // 11:50 BST
    renderApp('/', staff);
    const lists = region('Checklists');
    expect(within(lists).getByRole('heading', { name: 'Checklists' })).toBeInTheDocument();
    expect(meta(lists)).toBe('0 of 6 done · 1 missed');
    const todo = within(group(lists, 'To do')!).getAllByRole('link');
    expect(todo[0]).toHaveTextContent(/^Hot holding · 12:00.*Due in 10 min$/);
    expect(todo[0]).toHaveAttribute('href', run('2026-10-05|hothold|12:00'));
    expect(todo[1]).toHaveTextContent(/^Opening checks.*Missed$/);
    expect(todo[1]).toHaveAttribute('href', run('2026-10-05|opening|09:30'));
    // Then what's coming, by time, each with its time.
    expect(todo[2]).toHaveTextContent(/^Hot holding · 15:00.*15:00$/);
    expect(todo.at(-1)).toHaveTextContent(/^Closing checks.*23:00$/);
    expect(todo).toHaveLength(6);
    expect(group(lists, 'To do')!.querySelector('.sl')).toHaveTextContent('To do6');
    // Lists done when needed have their own group, after To do and before Done.
    expect(within(group(lists, 'When needed')!).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringMatching(/^Delivery check.*Whoever receives it$/)]);
    expect([...lists.querySelectorAll('.sl span:first-child')].map((x) => x.textContent)).toEqual(['To do', 'When needed']);
    expect(group(lists, 'Done')).toBeNull();
    // Open repairs and EOD issues are for supervisors and managers; staff only get a way to report one.
    expect(within(region('Repairs')).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringMatching(/^Report a problem/)]);
    expect(screen.queryByRole('region', { name: 'End of day' })).not.toBeInTheDocument();
  });

  it('a late list is the one to do now', () => {
    at('2026-10-05T11:10:00Z'); // 12:10 BST: Hot holding 12:00 is 10 min late
    renderApp('/', staff);
    expect(screen.getByRole('link', { name: /^Do\ now:\ Hot\ holding\ ·\ 12:00,/ })).toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|hothold|12:00'));
    const lists = region('Checklists');
    expect(meta(lists)).toBe('0 of 6 done · 1 late · 1 missed');
    // Late leads the To do group, ahead of the missed list.
    const todo = within(group(lists, 'To do')!).getAllByRole('link');
    expect(todo[0]).toHaveTextContent(/^Hot holding · 12:00.*10 min late$/);
    expect(todo[1]).toHaveTextContent(/^Opening checks.*Missed$/);
  });

  it('done lists count in the card and move to Done, with when and who', () => {
    at('2026-10-05T10:50:00Z');
    seedRun('2026-10-05|opening|09:30', 'Sam', '2026-10-05T08:42:00Z');
    seedRun('2026-10-05|bar|16:30', 'Alex', '2026-10-05T09:15:00Z');
    renderApp('/', staff);
    expect(screen.getByRole('link', { name: /^Start:\ Hot\ holding\ ·\ 12:00,/ }).closest('.hero')!).toHaveTextContent('2 of 6 checklists done');
    const lists = region('Checklists');
    // Nothing missed now, and the due list doesn't count as late.
    expect(meta(lists)).toBe('2 of 6 done');
    const todo = group(lists, 'To do')!;
    expect(within(todo).queryByText(/Opening checks|Bar opening/)).not.toBeInTheDocument();
    expect(todo.querySelector('.sl')).toHaveTextContent('To do4');
    expect(within(todo).queryByText(/Delivery check/)).not.toBeInTheDocument();
    expect([...lists.querySelectorAll('.sl span:first-child')].map((x) => x.textContent)).toEqual(['To do', 'When needed', 'Done']);
    const done = group(lists, 'Done')!;
    expect(done.querySelector('.sl')).toHaveTextContent('Done2');
    // In the order they were finished; their own list says "you".
    const rows = within(done).getAllByRole('link');
    expect(rows[0]).toHaveTextContent(/^Opening checks.*Done 09:42 by you$/);
    expect(rows[0]).toHaveAttribute('href', run('2026-10-05|opening|09:30'));
    expect(rows[1]).toHaveTextContent(/^Bar opening.*Done 10:15 by Alex$/);
    // Done rows carry no pill or time.
    expect(within(done).queryByText(/Due|late|Missed/)).not.toBeInTheDocument();
  });

  it('To do lists what is coming in time order; Repairs offers Report a problem; no EOD row', () => {
    at('2026-10-05T10:00:00Z'); // 11:00 BST
    seedRun('2026-10-05|opening|09:30', 'Sam', '2026-10-05T08:40:00Z');
    renderApp('/', staff);
    const lists = region('Checklists');
    // Nothing late, due or missed yet.
    expect(meta(lists)).toBe('1 of 6 done');
    const todo = within(group(lists, 'To do')!).getAllByRole('link').map((l) => l.textContent);
    expect(todo[0]).toMatch(/^Hot holding · 12:00.*12:00$/);
    expect(todo.at(-1)).toMatch(/^Closing checks.*23:00$/);
    expect(within(group(lists, 'When needed')!).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringMatching(/^Delivery check.*Whoever receives it$/)]);
    const repairs = region('Repairs');
    expect(within(repairs).getByRole('heading', { name: 'Repairs' })).toBeInTheDocument();
    const report = within(repairs).getByRole('link', { name: /^Report a problem/ });
    expect(report).toHaveAttribute('href', '/report');
    expect(report).toHaveTextContent('Something broken or not working');
    expect(screen.queryByRole('link', { name: /End-of-day report/ })).not.toBeInTheDocument();
    // No handover, so no End of day / Handover section at all.
    expect(screen.queryByRole('region', { name: 'End of day' })).not.toBeInTheDocument();
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
    renderApp('/', staff);
    expect(screen.queryByRole('heading', { name: 'From last night' })).not.toBeInTheDocument();
    const sec = region('Handover');
    expect(within(sec).getByRole('heading', { name: 'Handover' })).toBeInTheDocument();
    // Staff don't get the EOD report row or the handover to write.
    expect(within(sec).getAllByRole('link')).toHaveLength(1);
    const row = within(sec).getByRole('link', { name: /^Handover from / });
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
    const repairs = region('Repairs');
    expect(meta(repairs)).toBe('1 open');
    expect(within(repairs).queryByRole('link', { name: /^Report a problem/ })).not.toBeInTheDocument();
    await m.user.click(within(repairs).getByRole('link', { name: /Dishwasher leaking.*Urgent$/ }));
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

  it('managers with nothing open get no Repairs section', () => {
    renderApp('/', manager);
    expect(screen.queryByRole('region', { name: 'Repairs' })).not.toBeInTheDocument();
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
    const lists = region('Checklists');
    expect(within(group(lists, 'To do')!).getAllByRole('link')[0]).toHaveTextContent(/^Opening checks.*30 min late$/);
    expect(within(group(lists, 'Done')!).getByRole('link', { name: /Bar opening/ })).toHaveTextContent(/^Bar openingDone 09:10 by Alex$/);
    const shift = screen.getByRole('heading', { name: 'On shift' }).closest('section')!;
    expect(shift).toHaveTextContent('Who did what');
    expect(within(shift).getByText('Alex')).toBeInTheDocument();
    expect(within(shift).getByText('1 done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Do\ now:\ Opening\ checks,/ })).toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|opening|09:30'));
    const eod = region('End of day');
    expect(within(eod).getByRole('heading', { name: 'End of day' })).toBeInTheDocument();
    expect(within(eod).getByRole('link', { name: 'Write the handover' })).toHaveAttribute('href', '/close/handover');
    expect(within(eod).getByRole('link', { name: /^End-of-day report/ })).toHaveAttribute('href', '/close');
  });

  it('Write the handover sits under End of day, after last night\'s handover, until the EOD is sent', async () => {
    await seedHandover();
    renderApp('/', supervisor);
    const rows = within(region('End of day')).getAllByRole('link');
    expect(rows[0]).toHaveAccessibleName(/^End-of-day report/);
    expect(rows.at(-2)).toHaveAccessibleName(/^Handover from /);
    expect(within(rows.at(-2)!).getByText('New')).toHaveClass('pill', 'p-new');
    expect(rows.at(-1)).toHaveAccessibleName('Write the handover');
    expect(rows.at(-1)).toHaveAttribute('href', '/close/handover');
  });

  it('once the EOD is sent, Write the handover goes', async () => {
    await seedVerifiedDraft((d) => { d.confirmed = true; });
    const { user } = renderApp('/close', supervisor);
    await user.click(screen.getByRole('button', { name: 'Submit all' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('heading', { name: 'Day closed' });
    renderApp('/', supervisor);
    expect(within(region('End of day')).queryByRole('link', { name: 'Write the handover' })).not.toBeInTheDocument();
  });

  it('Needs you counts late, due and missed separately', () => {
    at('2026-10-05T11:10:00Z'); // 12:10 BST: Hot holding 12:00 late, opening missed
    renderApp('/', supervisor);
    expect(meta(region('Checklists'))).toBe('0 of 6 done · 1 late · 1 missed');
    expect(screen.getByRole('group', { name: 'Today so far: 0 of 6 checklists done, 2 late or missed' })).toHaveTextContent('2Late or missed');
  });

  it('a list that is only due is counted as due, not late', () => {
    at('2026-10-05T10:50:00Z'); // 11:50 BST: Hot holding 12:00 due, opening missed
    renderApp('/', supervisor);
    const lists = region('Checklists');
    expect(meta(lists)).toBe('0 of 6 done · 1 missed');
    expect(within(group(lists, 'To do')!).getAllByRole('link')[0]).toHaveTextContent(/^Hot holding · 12:00.*Due in 10 min$/);
    expect(screen.getByRole('group', { name: 'Today so far: 0 of 6 checklists done, 1 late or missed' })).toBeInTheDocument();
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
    renderApp('/', supervisor);
    expect(screen.getByText('Nobody has finished a checklist yet today.')).toBeInTheDocument();
  });
});

describe('manager home', () => {
  it('in the morning, an unread handover is the next step, and reading it clears it', async () => {
    at('2026-10-05T07:00:00Z'); // 08:00 BST, nothing due yet
    await seedHandover();
    const { user } = renderApp('/', manager);
    const row = within(region('End of day')).getByRole('link', { name: /^Handover from / });
    expect(within(row).getByText('New')).toBeInTheDocument();
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
    // It sits at the end of the To do group in Checklists.
    const todo = within(group(region('Checklists'), 'To do')!).getAllByRole('link');
    expect(todo.at(-1)).toHaveAccessibleName(/^5 checklists missed.*Yesterday · /);
  });

  it('yesterday\'s missed lists follow today\'s To do, even when today is all done', () => {
    at('2026-10-05T21:30:00Z');
    for (const [key, t] of [['opening|09:30', '08:40'], ['hothold|12:00', '11:02'], ['hothold|15:00', '14:01'], ['hothold|18:00', '17:05'], ['bar|16:30', '15:31'], ['closing|23:00', '21:20']]) {
      seedRun(`2026-10-05|${key}`, 'Sam', `2026-10-05T${t}:00Z`);
    }
    seedRun(`${yesterday}|opening|09:30`, 'Sam', '2026-10-04T08:40:00Z', yesterday);
    renderApp('/', manager);
    const lists = region('Checklists');
    const todo = group(lists, 'To do')!;
    // Nothing left today; the count is today's lists, not yesterday's.
    expect(todo.querySelector('.sl')).toHaveTextContent('To do0');
    expect(within(todo).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringMatching(/^55 checklists missed/)]);
    expect(within(group(lists, 'When needed')!).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringMatching(/^Delivery check.*Whoever receives it$/)]);
  });

  it('once every list is done, they are all under Done', () => {
    at('2026-10-05T21:30:00Z'); // 22:30 BST
    for (const [key, t] of [['opening|09:30', '08:40'], ['hothold|12:00', '11:02'], ['hothold|15:00', '14:01'], ['hothold|18:00', '17:05'], ['bar|16:30', '15:31'], ['closing|23:00', '21:20']]) {
      seedRun(`2026-10-05|${key}`, 'Sam', `2026-10-05T${t}:00Z`);
    }
    renderApp('/', manager);
    const lists = region('Checklists');
    expect(meta(lists)).toBe('6 of 6 done');
    // Nothing left to do; the list done when needed stays in its own group.
    expect(group(lists, 'To do')).toBeNull();
    expect(within(group(lists, 'When needed')!).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringMatching(/^Delivery check.*Whoever receives it$/)]);
    const rows = within(group(lists, 'Done')!).getAllByRole('link');
    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveTextContent(/^Opening checks.*Done 09:40 by Sam$/);
    expect(rows.at(-1)).toHaveTextContent(/^Closing checks.*Done 22:20 by Sam$/);
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
    expect(meta(lists)).toBe('0 of 6 done · 1 late · 4 missed');
    // The late list leads, with how late it is, and is also Up next.
    const late = run('2026-10-05|hothold|18:00');
    const todo = within(group(lists, 'To do')!).getAllByRole('link');
    expect(todo[0]).toHaveTextContent(/^Hot holding · 18:00.*30 min late$/);
    expect(todo[0]).toHaveAttribute('href', late);
    expect(screen.getByRole('link', { name: /^Do\ now:\ Hot\ holding\ ·\ 18:00,/ })).toHaveAttribute('href', late);
    // Every missed list has its own row, earliest first, then what's still to come.
    expect(todo.slice(1, 5).map((l) => within(l).getByText('Missed'))).toHaveLength(4);
    for (const l of todo.slice(1, 5)) expect(within(l).getByText('Missed')).toHaveClass('pill', 'p-bad');
    expect(todo[1]).toHaveTextContent(/^Opening checks/);
    expect(todo[1]).toHaveAttribute('href', run('2026-10-05|opening|09:30'));
    expect(todo.at(-1)).toHaveTextContent(/^Closing checks.*23:00$/);
    expect(todo).toHaveLength(6);
    expect(within(group(lists, 'When needed')!).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringMatching(/^Delivery check.*Whoever receives it$/)]);
  });

  it('To do lists what is still to come in time order; the EOD is under End of day', () => {
    at('2026-10-05T10:00:00Z'); // 11:00 BST, opening done
    seedRun('2026-10-05|opening|09:30', 'Sam', '2026-10-05T08:40:00Z');
    renderApp('/', manager);
    const lists = region('Checklists');
    // Nothing late or missed, so the header says only how many are done.
    expect(meta(lists)).toBe('1 of 6 done');
    const todo = within(group(lists, 'To do')!).getAllByRole('link').map((l) => l.textContent);
    expect(todo).toHaveLength(5);
    expect(todo[0]).toMatch(/^Hot holding · 12:00.*12:00$/);
    expect(todo.join()).not.toMatch(/Delivery check/);
    expect(todo.join()).not.toMatch(/Opening checks/);
    expect(within(group(lists, 'Done')!).getByRole('link', { name: /Opening checks/ })).toHaveTextContent(/^Opening checksDone 09:40 by Sam$/);
    const eod = region('End of day');
    expect(within(eod).getAllByRole('link')[0]).toHaveTextContent(/^End-of-day report8 sections · start any time/);
    // Managers don't write the handover from home.
    expect(within(eod).queryByRole('link', { name: 'Write the handover' })).not.toBeInTheDocument();
    // The sections come in the plain order: Checklists, Repairs (none open), End of day, Food safety.
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')).filter((n) => ['Checklists', 'Repairs', 'End of day', 'Food safety'].includes(n!))).toEqual(['Checklists', 'End of day', 'Food safety']);
    // The old headings are gone.
    expect(screen.queryByRole('heading', { name: /^(Needs you|Later today|Your day)$/ })).not.toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: 'End of day' })).toBeInTheDocument();
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

  it('an unexplained cash difference shows under Before you send, without the EOD row', async () => {
    await seedVerifiedDraft((d) => { d.sessions.dinner.cash.tillCash = 40000; });
    desktop();
    try {
      renderApp('/', manager);
      const eod = await screen.findByRole('region', { name: 'Before you send' });
      expect(eod.closest('.mh-desk')).not.toBeNull();
      expect(within(eod).getByRole('heading', { name: 'Before you send' })).toBeInTheDocument();
      const issue = within(eod).getByRole('link', { name: /Add a reason to submit\./ });
      expect(issue).toHaveAttribute('href', '/close/dinner');
      // The main card already carries the EOD on desktop, so no report row here.
      expect(within(eod).queryByRole('link', { name: /^End-of-day report/ })).not.toBeInTheDocument();
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
      expect(screen.getByRole('region', { name: 'Food safety' })).toBeInTheDocument();
    } finally {
      phone();
    }
  });

  it('on a phone, End of day still has the EOD row, then the same issue', async () => {
    await seedVerifiedDraft((d) => { d.sessions.dinner.cash.tillCash = 40000; });
    renderApp('/', manager);
    const eod = await screen.findByRole('region', { name: 'End of day' });
    expect(document.querySelector('.mh-desk')).toBeNull();
    const rows = within(eod).getAllByRole('link');
    expect(rows[0]).toHaveTextContent(/^End-of-day report/);
    expect(rows[1]).toHaveAttribute('href', '/close/dinner');
    expect(rows[1]).toHaveTextContent('Add a reason to submit.');
  });
});

describe('Checklists on the home', () => {
  it('a site with no checklists, and nothing missed yesterday, gets no Checklists section', () => {
    localStorage.setItem('mgh.templates.v1', '[]');
    at('2026-10-05T10:00:00Z');
    renderApp('/', manager);
    expect(screen.getByRole('region', { name: 'End of day' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Checklists' })).not.toBeInTheDocument();
  });

  it('a list done when needed has no "When needed" pill on its row', () => {
    at('2026-10-05T10:00:00Z');
    renderApp('/', staff);
    const whenNeeded = group(region('Checklists'), 'When needed')!;
    const [row, ...more] = within(whenNeeded).getAllByRole('link') as [HTMLElement, ...HTMLElement[]];
    expect(more).toHaveLength(0);
    expect(row).toHaveTextContent(/^Delivery check.*Whoever receives it$/);
    expect(row.querySelector('.pill')).toBeNull();
    expect(within(row).queryByText('When needed')).not.toBeInTheDocument();
    // The group label still says it, once.
    expect(within(whenNeeded).getAllByText('When needed')).toHaveLength(1);
  });
});
