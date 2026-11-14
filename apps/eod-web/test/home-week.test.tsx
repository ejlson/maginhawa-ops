/** Last 7 days on the home needs trading history; example history is off in tests, so this file turns it on. */
import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { manager, renderApp, staff, supervisor } from './harness';
import { DEFAULT_LAYOUT } from '../app/lib/home-layout';

vi.mock('../app/lib/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../app/lib/config')>()),
  showExampleData: () => true,
}));

describe('Last 7 days widget', () => {
  it('is off by default for managers, under Add widgets', async () => {
    const { user } = renderApp('/', manager);
    expect(screen.queryByRole('region', { name: 'Last 7 days' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Customise' }));
    await user.click(screen.getByRole('button', { name: 'Add Last 7 days' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('region', { name: 'Last 7 days' })).toBeInTheDocument();
  });

  it('once added to the manager home, shows the week as bars and its totals', () => {
    localStorage.setItem('mgh.home.v1:manager:Jo', JSON.stringify({ order: [...DEFAULT_LAYOUT.manager, 'week'], hidden: [] }));
    renderApp('/', manager);
    const week = screen.getByRole('region', { name: 'Last 7 days' });
    expect(week.querySelector('.wmeta')).toHaveTextContent('Example figures');
    expect(within(week).getByRole('img', { name: /^Net sales each day: / })).toBeInTheDocument();
    expect(week.querySelectorAll('.bar')).toHaveLength(7);
    expect(week).toHaveTextContent(/Net sales£/);
    expect(week).toHaveTextContent(/Covers\d/);
    // Last, where it was added.
    expect([...document.querySelectorAll('section[data-widget]')].at(-1)).toBe(week);
  });

  it('is never on the supervisor or staff home', () => {
    renderApp('/', supervisor);
    expect(screen.queryByRole('region', { name: 'Last 7 days' })).not.toBeInTheDocument();
  });

  it('is not shown to staff even if saved in their layout', () => {
    localStorage.setItem('mgh.home.v1:staff:Sam', JSON.stringify({ order: ['week', 'checklists'], hidden: [] }));
    renderApp('/', staff);
    expect(screen.queryByRole('region', { name: 'Last 7 days' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Net sales/)).not.toBeInTheDocument();
  });
});
