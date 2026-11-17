/** Head office sidebar folded into an icon rail on desktop (design C · Review queue, Nov 2026). */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { renderApp, admin } from './harness';
import { RAIL_KEY } from '../app/components/HeadOfficeShell';

/** A desktop-sized screen, where head office has the sidebar. */
let restore = () => {};
beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: /min-width/.test(q), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  restore = () => { delete (window as { matchMedia?: unknown }).matchMedia; };
});
afterEach(() => restore());

const sidebar = () => screen.getByRole('navigation', { name: 'Head office' });

describe('head office sidebar: icon rail', () => {
  it('folds into a rail and back, keeping focus on the toggle', async () => {
    const { user } = renderApp('/head-office', admin);
    await screen.findByRole('table', { name: 'Sites' });
    const collapse = within(sidebar()).getByRole('button', { name: 'Collapse sidebar' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    expect(within(sidebar()).getByText('Head office')).toBeInTheDocument();

    await user.click(collapse);
    expect(sidebar()).toHaveClass('rail');
    const expand = within(sidebar()).getByRole('button', { name: 'Expand sidebar' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(expand).toHaveFocus();
    // The section headings go; the links stay.
    expect(within(sidebar()).queryByRole('button', { name: /Operations/ })).not.toBeInTheDocument();

    await user.click(expand);
    expect(sidebar()).not.toHaveClass('rail');
    expect(within(sidebar()).getByRole('button', { name: 'Collapse sidebar' })).toHaveFocus();
  });

  it('remembers the choice on this device', async () => {
    const first = renderApp('/head-office', admin);
    await screen.findByRole('table', { name: 'Sites' });
    await first.user.click(within(sidebar()).getByRole('button', { name: 'Collapse sidebar' }));
    expect(localStorage.getItem(RAIL_KEY)).toBe('1');
    first.unmount();

    const again = renderApp('/head-office/records', admin);
    expect(await within(sidebar()).findByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    await again.user.click(within(sidebar()).getByRole('button', { name: 'Expand sidebar' }));
    expect(localStorage.getItem(RAIL_KEY)).toBe('0');
  });

  it('works when storage is off', async () => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
    try {
      const { user } = renderApp('/head-office/records', admin);
      await user.click(await within(sidebar()).findByRole('button', { name: 'Collapse sidebar' }));
      expect(sidebar()).toHaveClass('rail');
    } finally {
      Storage.prototype.getItem = get; Storage.prototype.setItem = set;
    }
  });

  it('⌘\\ folds and unfolds it', async () => {
    renderApp('/head-office/records', admin);
    await within(sidebar()).findByRole('button', { name: 'Collapse sidebar' });
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '\\', metaKey: true })); });
    expect(sidebar()).toHaveClass('rail');
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '\\', ctrlKey: true })); });
    expect(sidebar()).not.toHaveClass('rail');
  });

  it('each icon keeps its name and a tooltip, with the page you are on marked', async () => {
    localStorage.setItem(RAIL_KEY, '1');
    renderApp('/head-office/records', admin);
    const nav = await screen.findByRole('navigation', { name: 'Head office' });
    for (const name of ['Sites', 'Checklists & EODs', 'Food safety', 'Menu costing', 'Reports', 'Trends & forecast', 'Records and exports', 'Report builder', 'Settings']) {
      const link = within(nav).getByRole('link', { name });
      expect(link).toHaveAttribute('title', name);
    }
    expect(within(nav).getByRole('link', { name: 'Records and exports' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/head-office/more');
    // In three groups, split by dividers, as on the board.
    expect(within(nav).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Overview', 'Operations', 'Reports']);
    // Away from Today there's no operations data, so no dots.
    expect(nav.querySelectorAll('.rail-dot')).toHaveLength(0);
  });

  it('on Today, areas that need a look carry a red or amber dot, with words for screen readers', async () => {
    localStorage.setItem(RAIL_KEY, '1');
    renderApp('/head-office', admin);
    await screen.findByRole('table', { name: 'Sites' });
    const nav = sidebar();
    const maint = within(nav).getByRole('link', { name: /^Maintenance, urgent: \d+ overdue$/ });
    expect(maint).toHaveAttribute('title', maint.getAttribute('aria-label'));
    expect(maint.querySelector('.rail-dot.bad')).not.toBeNull();
    const ordering = within(nav).getByRole('link', { name: /^Ordering and waste, needs a look: / });
    expect(ordering.querySelector('.rail-dot.warn')).not.toBeNull();
    // Food safety's tile has no tone in the example data: plain name, no dot.
    const food = within(nav).getByRole('link', { name: 'Food safety' });
    expect(food.querySelector('.rail-dot')).toBeNull();
    // Today says how many closes are in.
    expect(within(nav).getByRole('link', { name: /^Today, \d+ of \d+ in$/ })).toHaveAttribute('aria-current', 'page');
  });

  it('Settings lights up on the settings pages, and Sites does not on /head-office/more', async () => {
    localStorage.setItem(RAIL_KEY, '1');
    const more = renderApp('/head-office/more', admin);
    let nav = await screen.findByRole('navigation', { name: 'Head office' });
    expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Sites' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'Sites' })).not.toHaveClass('on');
    more.unmount();

    const people = renderApp('/people', admin);
    nav = await screen.findByRole('navigation', { name: 'Head office' });
    expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveClass('on');
    people.unmount();

    // Elsewhere Settings is not marked.
    renderApp('/head-office/records', admin);
    nav = await screen.findByRole('navigation', { name: 'Head office' });
    expect(within(nav).getByRole('link', { name: 'Settings' })).not.toHaveAttribute('aria-current');
  });

  it('the expanded sidebar does not light up Sites on /head-office/more either', async () => {
    renderApp('/head-office/more', admin);
    const nav = await screen.findByRole('navigation', { name: 'Head office' });
    expect(nav).not.toHaveClass('rail');
    expect(within(nav).getByRole('link', { name: 'Sites' })).not.toHaveAttribute('aria-current');
  });

  it('⌘\\ with Shift or Alt, or \\ alone, does nothing', async () => {
    renderApp('/head-office/records', admin);
    await within(sidebar()).findByRole('button', { name: 'Collapse sidebar' });
    for (const init of [{ metaKey: true, shiftKey: true }, { ctrlKey: true, altKey: true }, {}]) {
      act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '\\', ...init })); });
      expect(sidebar()).not.toHaveClass('rail');
    }
    expect(localStorage.getItem(RAIL_KEY)).toBe('0');
  });

  it('phones keep the tab bar, with no sidebar or toggle', async () => {
    restore();
    localStorage.setItem(RAIL_KEY, '1');
    renderApp('/head-office/records', admin);
    const tabs = await screen.findByRole('navigation', { name: 'Head office' });
    expect(tabs).toHaveClass('tabbar');
    expect(screen.queryByRole('button', { name: /(Expand|Collapse) sidebar/ })).not.toBeInTheDocument();
  });
});
