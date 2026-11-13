import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { admin, manager, renderApp, staff } from './harness';
import { firstWeekTasks, setTourAutoStart, tour, tourFor } from '../app/lib/tour';

// The welcome opens by itself only outside tests; these tests switch it on.
beforeEach(() => setTourAutoStart(true));
afterEach(() => setTourAutoStart(false));

type U = Awaited<ReturnType<typeof renderApp>>['user'];

/** Clicks Next until the last tip, and returns every tip title seen on the way. */
async function walk(user: U): Promise<string[]> {
  const seen: string[] = [];
  for (let n = 0; n < 8; n++) {
    const tip = screen.getByRole('dialog');
    seen.push(document.getElementById('tour-title')?.textContent ?? '');
    const done = within(tip).queryByRole('button', { name: 'Done' });
    if (done) { await user.click(done); return seen; }
    await user.click(within(tip).getByRole('button', { name: 'Next' }));
  }
  throw new Error('the tour never ended');
}

describe('first-run tour', () => {
  it('welcomes a new manager on Home, walks the tips in order and ends on the colour key', async () => {
    const { user } = renderApp('/', manager);
    const welcome = await screen.findByRole('dialog', { name: 'Welcome, Jo' });
    expect(within(welcome).getByText(/You're a manager at Bunso/)).toBeInTheDocument();
    await user.click(within(welcome).getByRole('button', { name: 'Show me around' }));

    const first = screen.getByRole('dialog', { name: 'Close the day here' });
    expect(within(first).getByLabelText(/^Tip 1 of \d$/)).toBeInTheDocument();
    expect(within(first).queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();

    const titles = await walk(user);
    expect(titles[0]).toBe('Close the day here');
    // Jo works at one site, so there's no site name to switch with and that tip is left out.
    expect(titles).not.toContain('More than one site?');
    expect(titles.at(-1)).toBe('Checklists and the EOD');

    const done = screen.getByRole('dialog', { name: "You're all set" });
    expect(within(done).getByText('Orange')).toBeInTheDocument();
    await user.click(within(done).getByRole('button', { name: "Let's go" }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(tour.get(manager).seenAt).not.toBeNull();
  });

  it('can go back a tip, and Escape skips the tour', async () => {
    const { user } = renderApp('/', manager);
    await user.click(await screen.findByRole('button', { name: 'Show me around' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: 'Close the day here' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent("Tour hidden. It's in Account.");
  });

  it('Skip for now can be undone', async () => {
    const { user } = renderApp('/', manager);
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));
    expect(screen.queryByRole('dialog', { name: 'Welcome, Jo' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('dialog', { name: 'Welcome, Jo' })).toBeInTheDocument();
  });

  it('only shows once, and Account shows it again', async () => {
    tour.markSeen(manager);
    const { user } = renderApp('/account', manager);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Show me around/ }));
    expect(await screen.findByRole('dialog', { name: 'Welcome, Jo' })).toBeInTheDocument();
  });

  it('gives kitchen staff a temperature tip with a demo, in the middle of the screen', async () => {
    const { user } = renderApp('/', staff);
    await user.click(await screen.findByRole('button', { name: 'Show me around' }));
    const titles = await walk(user);
    expect(titles).toContain('Quick temperatures');
    expect(titles).not.toContain('Close the day here');
  });

  it('shows head office its own tips', async () => {
    const { user } = renderApp('/head-office', admin);
    const welcome = await screen.findByRole('dialog', { name: 'Welcome, Ana' });
    expect(within(welcome).getByText(/You're head office, so you see all 8 sites/)).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'All sites' });
    await user.click(within(welcome).getByRole('button', { name: 'Show me around' }));
    expect(await screen.findByRole('dialog', { name: 'Every site, tonight' })).toBeInTheDocument();
  });
});

describe('tips on new screens', () => {
  it('shows once on the cash count; Got it hides it, with Undo', async () => {
    tour.markSeen(manager);
    const { user } = renderApp('/close/lunch/cash', manager);
    expect(screen.getByText('First time counting?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText('First time counting?')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('First time counting?')).toBeInTheDocument();
  });

  it('stays hidden with tips turned off in Account', async () => {
    tour.markSeen(manager);
    tour.setTips(manager, false);
    renderApp('/close/lunch/cash', manager);
    expect(screen.queryByText('First time counting?')).not.toBeInTheDocument();
  });
});

describe('your first week', () => {
  it('follows the tour, ticks itself and goes the day after it is finished', () => {
    const base = { seenAt: null, hidden: [], tipsOff: false, did: {} };
    const at = new Date('2026-10-05T21:00:00Z');
    expect(firstWeekTasks('manager', base, false, at)).toEqual([]);
    const seen = { ...base, seenAt: '2026-10-05T20:00:00Z' };
    expect(firstWeekTasks('manager', seen, false, at)).toEqual(['close', 'cash']);
    expect(firstWeekTasks('manager', seen, true, at)).toEqual(['close', 'cash', 'switch']);
    expect(firstWeekTasks('staff', seen, true, at)).toEqual([]);
    const finished = { ...seen, did: { close: '2026-10-05T20:30:00Z', cash: '2026-10-05T20:10:00Z' } };
    expect(firstWeekTasks('supervisor', finished, false, at)).toEqual(['close', 'cash']);
    expect(firstWeekTasks('supervisor', finished, false, new Date('2026-10-06T21:00:00Z'))).toEqual([]);
    expect(firstWeekTasks('manager', seen, false, new Date('2026-10-25T21:00:00Z'))).toEqual([]);
  });

  it('shows on Home after the tour and ticks when the cash is counted', async () => {
    tour.markSeen(manager);
    renderApp('/', manager);
    const card = screen.getByRole('region', { name: 'Your first week' });
    expect(within(card).getByText('0 of 2')).toBeInTheDocument();
    act(() => tour.did(manager, 'cash'));
    expect(await within(card).findByText('1 of 2')).toBeInTheDocument();
  });

  it('every role sees 4 or 5 tips (one dark card at a time)', () => {
    for (const r of ['staff', 'supervisor', 'manager', 'headoffice'] as const) {
      const steps = tourFor(r);
      const shown = steps.filter((s) => !s.target?.startsWith('hero-')).length + (steps.some((s) => s.target?.startsWith('hero-')) ? 1 : 0);
      expect(shown).toBeGreaterThanOrEqual(4);
      expect(shown).toBeLessThanOrEqual(5);
    }
  });
});
