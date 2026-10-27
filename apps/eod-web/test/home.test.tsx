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
  it('leads with their next checklist and offers a way to report a problem, not the EOD', () => {
    at('2026-10-05T10:50:00Z'); // 11:50 BST
    renderApp('/', staff);
    expect(screen.getByRole('heading', { name: 'Hi Sam' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Your next checklist: Hot holding · 12:00/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Report a problem' })).toHaveAttribute('href', '/report');
    expect(screen.queryByText(/EOD/)).not.toBeInTheDocument();
  });

  it('shows who did the lists already done', () => {
    at('2026-10-05T10:50:00Z');
    seedRun('2026-10-05|opening|09:30', 'Sam', '2026-10-05T08:42:00Z');
    renderApp('/', staff);
    expect(screen.getByText('Done 09:42 by you')).toBeInTheDocument();
  });

  it('shows last night\'s handover note', async () => {
    await seedHandover();
    renderApp('/', staff);
    expect(screen.getByRole('heading', { name: 'From last night' })).toBeInTheDocument();
    expect(screen.getByText('Walk-in door sticks, push it shut.')).toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: /^Today so far: 1 of 6 checklists done, 1 late or missed/ })).toBeInTheDocument();
    const needs = screen.getByRole('heading', { name: 'Needs you' }).closest('section')!;
    expect(within(needs).getByRole('link', { name: /Opening checks/ })).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('1 done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Do now: Opening checks' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Write the handover' })).toHaveAttribute('href', '/close/handover');
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
    await user.click(screen.getByRole('link', { name: "Read last night's handover" }));
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
});

describe('the name menu, for every role', () => {
  it('staff switch role from the menu on the shared iPad', async () => {
    const { user } = renderApp('/', staff);
    await user.click(screen.getByRole('button', { name: /Switch person/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Manager' }));
    expect(screen.getByRole('link', { name: "Start today's EOD" })).toBeInTheDocument();
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
