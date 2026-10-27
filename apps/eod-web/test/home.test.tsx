import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { admin, manager, renderApp, staff, supervisor } from './harness';
import { setNow } from '../app/lib/clock';
import { deviceStore } from '../app/lib/store';
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

/** A checklist finished earlier today by someone. */
function seedRun(key: string, by: string, completedAt: string, date = '2026-10-05') {
  const storeKey = `mgh.runs.v1.BUN|${date}`;
  const runs = JSON.parse(localStorage.getItem(storeKey) ?? '{}');
  const [, templateId, dueTime] = key.split('|');
  runs[key] = { key, templateId, businessDate: date, dueTime: dueTime === 'any' ? null : dueTime, answers: {}, fixes: {}, completedAt, completedBy: by };
  localStorage.setItem(storeKey, JSON.stringify(runs));
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

  it('switching person on the shared iPad saves their work under their own name', async () => {
    at('2026-10-05T10:50:00Z');
    const { user } = renderApp('/', staff);
    await user.click(screen.getByRole('link', { name: /Switch person/ }));
    await user.type(screen.getByLabelText('Someone else'), 'Alex');
    await user.click(screen.getByRole('button', { name: "I'm Alex" }));
    expect(screen.getByRole('heading', { name: 'Hi Alex' })).toBeInTheDocument();
    // Sam is one tap away next time.
    await user.click(screen.getByRole('link', { name: /Switch person/ }));
    expect(screen.getByRole('button', { name: /Sam$/ })).toBeInTheDocument();
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

describe('changing role and signing out', () => {
  it('staff can get to another role from the shared iPad', async () => {
    const { user } = renderApp('/', staff);
    await user.click(screen.getByRole('link', { name: /Switch person/ }));
    await user.click(screen.getByRole('radio', { name: 'Manager' }));
    expect(screen.getByRole('link', { name: "Start today's EOD" })).toBeInTheDocument();
  });

  it('tapping your initials opens your account instead of signing straight out', async () => {
    const { user } = renderApp('/', manager);
    await user.click(screen.getByRole('link', { name: /Signed in as Jo/ }));
    expect(screen.getByRole('radio', { name: 'Manager' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('heading', { name: 'Close the day' })).toBeInTheDocument();
  });

  it('head office gets back to a site view too', async () => {
    const { user } = renderApp('/head-office', admin);
    await user.click(screen.getByRole('link', { name: /Signed in as Ana/ }));
    await user.click(screen.getByRole('radio', { name: 'Supervisor' }));
    expect(screen.getByRole('heading', { name: /, Ana$/ })).toBeInTheDocument();
  });
});
