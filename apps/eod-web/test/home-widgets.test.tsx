/** The home as widgets (designs W1–W8): each role's starting set, Customise, compact tiles, rings, sets by shift, Your day and Smart stack. */
import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { admin, manager, renderApp, staff, supervisor } from './harness';
import { setNow } from '../app/lib/clock';
import { deviceChecklistStore } from '../app/lib/store';
import { DEFAULT_LAYOUT, resolveLayout, shiftAt, widgetAllowed } from '../app/lib/home-layout';

const at = (iso: string) => setNow(new Date(iso));
/** A checklist finished today by someone (the store writes synchronously). */
function seedRun(key: string, by: string, completedAt: string) {
  const [, templateId, dueTime] = key.split('|');
  void deviceChecklistStore().apply('BUN', [{ kind: 'finish', run: { key, templateId: templateId!, businessDate: '2026-10-05', dueTime: dueTime! }, by, at: completedAt }]);
}
const key = (role: string, name: string) => `mgh.home.v1:${role}:${name}`;
const saved = (role: string, name: string) => JSON.parse(localStorage.getItem(key(role, name)) ?? 'null');
/** The widgets on the home, in order. */
const widgets = () => [...document.querySelectorAll('section[data-widget]')].map((w) => w.getAttribute('aria-label'));
const region = (name: string) => screen.getByRole('region', { name });
/** Customise: the widgets on the home, in order. */
const onHome = () => within(region('On your home')).getAllByRole('listitem').map((li) => li.querySelector('.cz-th')!.textContent);
/** Customise: the widgets under Add widgets. */
const addable = () => within(region('Add widgets')).queryAllByRole('button', { name: /^Add / }).map((b) => b.getAttribute('aria-label')!.slice(4));

describe('default widgets per role', () => {
  it('staff: Checklists, Food safety, Repairs, Handover and Recipes; never the EOD, Last 7 days or On shift', () => {
    renderApp('/', staff);
    expect(widgets()).toEqual(['Checklists', 'Food safety', 'Repairs', 'Handover', 'Recipes']);
    for (const name of ['End of day report', 'Last 7 days', 'On shift']) expect(screen.queryByRole('region', { name })).not.toBeInTheDocument();
    // Off by default, and can be added.
    for (const name of ['Stock', 'Your day', 'Smart stack', 'Quick actions']) expect(screen.queryByRole('region', { name })).not.toBeInTheDocument();
  });

  it('staff can\'t add the EOD, Last 7 days or On shift from Customise either', async () => {
    const { user } = renderApp('/', staff);
    await user.click(screen.getByRole('link', { name: 'Customise' }));
    expect(screen.getByRole('heading', { name: 'Customise home', level: 1 })).toBeInTheDocument();
    expect(onHome()).toEqual(['Checklists', 'Food safety', 'Repairs', 'Handover', 'Recipes']);
    expect(addable()).toEqual(['Your day', 'Smart stack', 'Quick actions', 'Stock']);
    for (const name of ['End of day report', 'Last 7 days', 'On shift']) expect([...onHome(), ...addable()]).not.toContain(name);
  });

  it('supervisors: Checklists, the EOD, Stock, Food safety, Repairs, Handover and Recipes; On shift to add; no Last 7 days', async () => {
    const { user } = renderApp('/', supervisor);
    expect(widgets()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Repairs', 'Handover', 'Recipes']);
    expect(screen.queryByRole('region', { name: 'On shift' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Customise' }));
    expect(addable()).toEqual(['Your day', 'Smart stack', 'Quick actions', 'On shift']);
    expect([...onHome(), ...addable()]).not.toContain('Last 7 days');
    // Adding On shift puts it on their home.
    await user.click(screen.getByRole('button', { name: 'Add On shift' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(widgets().at(-1)).toBe('On shift');
  });

  it('managers: the supervisor\'s set; Last 7 days is under Add widgets', async () => {
    const { user } = renderApp('/', manager);
    expect(widgets()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Repairs', 'Handover', 'Recipes']);
    await user.click(screen.getByRole('link', { name: 'Customise' }));
    expect(onHome()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Repairs', 'Handover', 'Recipes']);
    expect(addable()).toEqual(['Your day', 'Smart stack', 'Quick actions', 'On shift', 'Last 7 days']);
  });

  it('head office in a site starts with the manager\'s set', () => {
    renderApp('/', { ...admin, inSite: true });
    expect(widgets()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Repairs', 'Handover', 'Recipes']);
  });

  it('who can have each widget, and a saved layout only keeps what the person may have', () => {
    expect(widgetAllowed('eod', 'staff', false)).toBe(false);
    expect(widgetAllowed('week', 'supervisor', true)).toBe(false);
    expect(widgetAllowed('onshift', 'staff', false)).toBe(false);
    expect(DEFAULT_LAYOUT).toEqual({
      staff: ['checklists', 'food', 'repairs', 'handover', 'recipes'],
      supervisor: ['checklists', 'eod', 'stock', 'food', 'repairs', 'handover', 'recipes'],
      manager: ['checklists', 'eod', 'stock', 'food', 'repairs', 'handover', 'recipes'],
      headoffice: ['checklists', 'eod', 'stock', 'food', 'repairs', 'handover', 'recipes'],
    });
    // Everyone starts with Repairs and Handover; these are off by default for everyone.
    for (const set of Object.values(DEFAULT_LAYOUT)) expect(set).toEqual(expect.arrayContaining(['repairs', 'handover']));
    for (const id of ['onshift', 'week', 'day', 'stack', 'quick'] as const) {
      for (const set of Object.values(DEFAULT_LAYOUT)) expect(set).not.toContain(id);
    }
    // Every default is something that role may have.
    expect(DEFAULT_LAYOUT.staff.every((id) => widgetAllowed(id, 'staff', false))).toBe(true);
    // A layout saved as a manager, read as staff: the money and the EOD drop out, the rest are offered to add.
    const r = resolveLayout({ order: ['week', 'eod', 'checklists', 'onshift'], hidden: [] }, 'staff', false);
    expect(r.order).toEqual(['checklists']);
    expect(r.hidden).not.toContain('eod');
    expect(r.hidden).toContain('quick');
  });

  it('the shift by the site\'s clock: opening until 11:00, service until 22:00, then closing', () => {
    expect(shiftAt(new Date('2026-10-05T09:59:00Z'))).toBe('opening'); // 10:59 BST
    expect(shiftAt(new Date('2026-10-05T10:00:00Z'))).toBe('service'); // 11:00 BST
    expect(shiftAt(new Date('2026-10-05T20:59:00Z'))).toBe('service'); // 21:59 BST
    expect(shiftAt(new Date('2026-10-05T21:00:00Z'))).toBe('closing'); // 22:00 BST
    expect(shiftAt(new Date('2026-10-06T02:30:00Z'))).toBe('closing'); // 03:30 BST
  });
});

describe('Customise home', () => {
  it('hiding a widget offers Undo, which puts it back where it was', async () => {
    const { user } = renderApp('/home/customise', manager);
    await user.click(screen.getByRole('button', { name: 'Hide Repairs' }));
    expect(screen.getByRole('status')).toHaveTextContent('Repairs hidden');
    expect(onHome()).not.toContain('Repairs');
    expect(addable()).toContain('Repairs');
    expect(saved('manager', 'Jo').hidden).toContain('repairs');
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onHome()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Repairs', 'Handover', 'Recipes']);
    expect(saved('manager', 'Jo').order).toEqual(['checklists', 'eod', 'stock', 'food', 'repairs', 'handover', 'recipes']);
  });

  it('the arrows move a widget; the first can\'t go earlier and the last can\'t go later', async () => {
    const { user } = renderApp('/home/customise', manager);
    expect(screen.getByRole('button', { name: 'Move Checklists earlier' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Recipes later' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Move End of day report earlier' }));
    expect(onHome().slice(0, 2)).toEqual(['End of day report', 'Checklists']);
    await user.click(screen.getByRole('button', { name: 'Move Checklists later' }));
    expect(onHome().slice(0, 3)).toEqual(['End of day report', 'Stock', 'Checklists']);
    expect(saved('manager', 'Jo').order.slice(0, 3)).toEqual(['eod', 'stock', 'checklists']);
  });

  it('a widget added back goes at the end', async () => {
    const { user } = renderApp('/home/customise', manager);
    await user.click(screen.getByRole('button', { name: 'Hide Stock' }));
    await user.click(screen.getByRole('button', { name: 'Add Stock' }));
    expect(onHome().at(-1)).toBe('Stock');
    expect(addable()).not.toContain('Stock');
    // Adding clears the Undo note.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Your day' }));
    expect(onHome().at(-1)).toBe('Your day');
  });

  it('changes show on the home and are saved for this person on this device', async () => {
    const { user, unmount } = renderApp('/', manager);
    await user.click(screen.getByRole('link', { name: 'Customise' }));
    await user.click(screen.getByRole('button', { name: 'Hide Repairs' }));
    await user.click(screen.getByRole('button', { name: 'Move End of day report earlier' }));
    await user.click(screen.getByRole('button', { name: 'Add Smart stack' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(widgets()).toEqual(['End of day report', 'Checklists', 'Stock', 'Food safety', 'Handover', 'Recipes', 'Smart stack']);
    expect(saved('manager', 'Jo')).toMatchObject({ order: ['eod', 'checklists', 'stock', 'food', 'handover', 'recipes', 'stack'] });
    expect(saved('manager', 'Jo').hidden).toContain('repairs');
    // Still there next time.
    unmount();
    renderApp('/', manager);
    expect(widgets()[0]).toBe('End of day report');
  });

  it('layouts are per person and role: the supervisor called Jo keeps the usual layout', () => {
    localStorage.setItem(key('manager', 'Jo'), JSON.stringify({ order: ['stock'], hidden: [] }));
    renderApp('/', supervisor);
    expect(widgets()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Repairs', 'Handover', 'Recipes']);
  });

  it('the page has its own bar: Reset, the title and Done; no back link or breadcrumb', async () => {
    const { user } = renderApp('/home/customise', manager);
    const bar = document.querySelector<HTMLElement>('header.cz-bar')!;
    expect(bar).not.toBeNull();
    expect([...bar.children].map((el) => el.textContent)).toEqual(['Reset', 'Customise home', 'Done']);
    expect(within(bar).getByRole('button', { name: 'Reset' })).toHaveClass('cz-reset');
    expect(within(bar).getByRole('heading', { name: 'Customise home', level: 1 })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Done' })).toHaveClass('cz-done');
    // One title, and nothing to go "back" to: Done is the way out.
    expect(screen.getAllByRole('heading', { name: 'Customise home' })).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /home|back/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    // The old reset link at the bottom has gone.
    expect(screen.queryByRole('button', { name: 'Reset to the usual layout' })).not.toBeInTheDocument();
    await user.click(within(bar).getByRole('button', { name: 'Done' }));
    expect(document.querySelector('header.cz-bar')).toBeNull();
    expect(widgets()[0]).toBe('Checklists');
  });

  describe('dragging', () => {
    const real = document.elementFromPoint;
    afterEach(() => { document.elementFromPoint = real; });
    /** jsdom has no layout: say which tile is under the pointer. */
    const pointAt = (id: string) => { document.elementFromPoint = () => document.querySelector(`[data-cz="${id}"] .cz-th`); };
    const grip = (id: string) => document.querySelector<HTMLElement>(`[data-cz="${id}"] .cz-grip`)!;

    it('the grip follows the pointer: the widget under it gives up its place, and letting go saves', () => {
      renderApp('/home/customise', manager);
      fireEvent.pointerDown(grip('repairs'), { pointerId: 1 });
      expect(document.querySelector('.cz-grid')).toHaveClass('dragging');
      expect(document.querySelector('[data-cz="repairs"]')).toHaveClass('drag');
      // Over the first widget: Repairs takes its place.
      pointAt('checklists');
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 20, clientY: 20 });
      expect(onHome()).toEqual(['Repairs', 'Checklists', 'End of day report', 'Stock', 'Food safety', 'Handover', 'Recipes']);
      // Nothing is saved until it is dropped.
      expect(saved('manager', 'Jo')).toBeNull();
      // Over itself, or over nothing: no change.
      pointAt('repairs');
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 20, clientY: 20 });
      document.elementFromPoint = () => null;
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 900, clientY: 900 });
      expect(onHome()[0]).toBe('Repairs');
      fireEvent.pointerUp(window, { pointerId: 1 });
      expect(document.querySelector('.cz-grid')).not.toHaveClass('dragging');
      expect(document.querySelector('[data-cz="repairs"]')).toHaveClass('on');
      expect(saved('manager', 'Jo').order).toEqual(['repairs', 'checklists', 'eod', 'stock', 'food', 'handover', 'recipes']);
      // Moves after the drop do nothing.
      pointAt('recipes');
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 20, clientY: 20 });
      expect(onHome()[0]).toBe('Repairs');
    });

    it('dragging later in the list, and a cancelled pointer still drops where it is', () => {
      renderApp('/home/customise', manager);
      fireEvent.pointerDown(grip('checklists'), { pointerId: 1 });
      pointAt('food');
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 20, clientY: 20 });
      expect(onHome().slice(0, 4)).toEqual(['End of day report', 'Stock', 'Food safety', 'Checklists']);
      fireEvent.pointerCancel(window, { pointerId: 1 });
      expect(saved('manager', 'Jo').order.slice(0, 4)).toEqual(['eod', 'stock', 'food', 'checklists']);
    });
  });

  it('Reset (in the bar) goes back to the usual layout, with Undo', async () => {
    const { user } = renderApp('/home/customise', manager);
    await user.click(screen.getByRole('button', { name: 'Hide Checklists' }));
    await user.click(screen.getByRole('button', { name: 'Move Repairs earlier' }));
    expect(onHome()).toEqual(['End of day report', 'Stock', 'Repairs', 'Food safety', 'Handover', 'Recipes']);
    await user.click(within(document.querySelector<HTMLElement>('header.cz-bar')!).getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('status')).toHaveTextContent('Back to the usual layout');
    expect(onHome()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Repairs', 'Handover', 'Recipes']);
    expect(saved('manager', 'Jo')).toBeNull();
    // Undo brings the custom layout back.
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onHome()[0]).toBe('End of day report');
    expect(onHome()).not.toContain('Checklists');
    expect(saved('manager', 'Jo').hidden).toContain('checklists');
  });

  it('Done goes home', async () => {
    const { user } = renderApp('/home/customise', staff);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('heading', { name: 'Hi Sam' })).toBeInTheDocument();
  });
});

describe('compact tiles', () => {
  it('"Small" turns a widget into a tile with its big number', async () => {
    at('2026-10-05T09:00:00Z'); // 10:00 BST: Opening checks 30 min late
    const { user } = renderApp('/home/customise', manager);
    const small = screen.getByRole('button', { name: 'Show Checklists as a small tile' });
    expect(small).toHaveTextContent('Small');
    expect(small).toHaveAttribute('aria-pressed', 'false');
    await user.click(small);
    expect(small).toHaveAttribute('aria-pressed', 'true');
    expect(saved('manager', 'Jo').small).toEqual(['checklists']);
    // Widgets with no single number to show can't be small.
    expect(screen.queryByRole('button', { name: 'Show Last 7 days as a small tile' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));

    const lists = region('Checklists');
    expect(lists).toHaveClass('small');
    expect(lists).not.toHaveClass('wide');
    const tile = lists.querySelector('.wtile')!;
    expect(tile).toHaveAttribute('href', '/checklists');
    expect(tile).toHaveTextContent(/^0 \/ 6$/);
    expect(lists.querySelector('.wtile-l')).toHaveTextContent('1 late');
    expect(lists.querySelector('.wtile-l')).toHaveClass('t-bad');
    // No rows in a tile.
    expect(lists.querySelector('.sub')).toBeNull();
    // The others stay as they were.
    expect(region('End of day report')).not.toHaveClass('small');
  });

  it('pressing Small again turns it back', async () => {
    localStorage.setItem(key('manager', 'Jo'), JSON.stringify({ order: ['checklists', 'eod'], hidden: [], small: ['eod'] }));
    const { user } = renderApp('/home/customise', manager);
    const small = screen.getByRole('button', { name: 'Show End of day report as a small tile' });
    expect(small).toHaveAttribute('aria-pressed', 'true');
    await user.click(small);
    expect(small).toHaveAttribute('aria-pressed', 'false');
    expect(saved('manager', 'Jo').small).toEqual([]);
  });

  it('the EOD tile shows sections done out of the total and the next step', () => {
    localStorage.setItem(key('manager', 'Jo'), JSON.stringify({ order: ['eod'], hidden: [], small: ['eod'] }));
    renderApp('/', manager);
    const eod = region('End of day report');
    expect(eod.querySelector('.wtile')).toHaveTextContent(/^0 of 8$/);
    expect(eod.querySelector('.wtile-l')).toHaveTextContent('Start lunch');
  });
});

describe('rings card', () => {
  it('choosing Rings shows the main card as rings, with what each ring is in its label', async () => {
    const { user } = renderApp('/home/customise', manager);
    const style = screen.getByRole('radiogroup', { name: 'Main card style' });
    expect(within(style).getByRole('radio', { name: 'Standard' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(style).getByRole('radio', { name: 'Rings' }));
    expect(within(style).getByRole('radio', { name: 'Rings' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Checklists, the end of day report and stock counts as rings to close.')).toBeInTheDocument();
    expect(saved('manager', 'Jo').card).toBe('rings');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    const rings = screen.getByRole('img', { name: /^Checklists 0 of 6, End of day report 0 of 8(, Stock counts \d+ of \d+)?$/ });
    expect(rings.closest('.hero')).toHaveClass('rings-card');
    expect(rings.closest('.hero')).toHaveTextContent('Today at a glance');
    // Up next stays in the card (22:00: the EOD's first section).
    expect(within(rings.closest('.hero') as HTMLElement).getByRole('link', { name: /^Start\ lunch,/ })).toHaveAttribute('href', '/close/lunch');
    // The tour still finds the main card: the rings card takes over its target.
    expect(document.querySelector('[data-tour="hero-eod"]')).toBe(rings.closest('.hero'));
  });

  it('staff rings have no End of day report ring', () => {
    localStorage.setItem(key('staff', 'Sam'), JSON.stringify({ order: ['checklists'], hidden: [], card: 'rings' }));
    renderApp('/', staff);
    const rings = screen.getByRole('img', { name: /^Checklists 0 of 6/ });
    expect(rings).not.toHaveAccessibleName(/End of day report/);
  });
});

describe('main card previews in Customise', () => {
  /** Customise: the two style choices, each with its live preview. */
  const choice = (name: 'Standard' | 'Rings') => within(screen.getByRole('radiogroup', { name: 'Main card style' })).getByRole('radio', { name });
  const preview = (name: 'Standard' | 'Rings') => choice(name).closest('.cz-card')!.querySelector<HTMLElement>('.cz-preview')!;

  it('for a manager, Standard previews the end of day card and Rings the rings card', () => {
    renderApp('/home/customise', manager);
    const radios = within(screen.getByRole('radiogroup', { name: 'Main card style' })).getAllByRole('radio');
    expect(radios.map((r) => r.textContent?.trim().endsWith('Standard') || r.textContent?.trim().endsWith('Rings'))).toEqual([true, true]);
    expect(radios).toHaveLength(2);
    // The previews are hidden from screen readers, so each radio is just named by its word.
    expect(choice('Standard')).toHaveAccessibleName('Standard');
    expect(choice('Rings')).toHaveAccessibleName('Rings');
    const std = preview('Standard');
    expect(std.querySelector('.hero')).not.toBeNull();
    expect(std.querySelector('.hero')).not.toHaveClass('rings-card');
    expect(std).toHaveTextContent(/Net so far/);
    const rings = preview('Rings');
    expect(rings.querySelector('.hero.rings-card')).not.toBeNull();
    expect(rings).toHaveTextContent('Today at a glance');
    expect(rings.querySelector('svg[aria-label^="Checklists "]')).toHaveAttribute('aria-label', expect.stringMatching(/End of day report/));
  });

  it('for staff, Standard previews the checklists card, and Rings has no end of day ring', () => {
    renderApp('/home/customise', staff);
    expect(preview('Standard')).toHaveTextContent('Checklists to do today');
    expect(preview('Standard').querySelector('.rings-card')).toBeNull();
    expect(preview('Rings').querySelector('svg[aria-label^="Checklists "]')).not.toHaveAttribute('aria-label', expect.stringMatching(/End of day report/));
  });

  it('a supervisor gets the checklists card too', () => {
    renderApp('/home/customise', supervisor);
    expect(preview('Standard')).toHaveTextContent('Checklists to do today');
  });

  it('choosing Rings checks it, and the home then shows the rings card', async () => {
    const { user } = renderApp('/home/customise', manager);
    expect(choice('Standard')).toHaveAttribute('aria-checked', 'true');
    expect(choice('Rings')).toHaveAttribute('aria-checked', 'false');
    // Tapping the preview picks the style, like tapping the word.
    await user.click(preview('Rings'));
    expect(choice('Rings')).toHaveAttribute('aria-checked', 'true');
    expect(choice('Standard')).toHaveAttribute('aria-checked', 'false');
    // Both previews stay as they were: they show the styles, not the choice.
    expect(preview('Standard').querySelector('.rings-card')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    const home = document.querySelector('.hero')!;
    expect(home).toHaveClass('rings-card');
    expect(home.closest('.cz-preview')).toBeNull();
  });

  it('the previews are inert and hidden, so nothing in them can be tabbed to or read out', () => {
    renderApp('/home/customise', manager);
    for (const name of ['Standard', 'Rings'] as const) {
      const p = preview(name);
      expect(p).toHaveAttribute('inert');
      expect(p).toHaveAttribute('aria-hidden', 'true');
      // The cards have links of their own (Up next), but not one is reachable.
      expect(p.querySelectorAll('a').length).toBeGreaterThan(0);
      expect(within(choice(name)).queryAllByRole('link')).toHaveLength(0);
      for (const a of p.querySelectorAll('a, button')) expect(a.closest('[inert]')).toBe(p);
    }
    expect(within(screen.getByRole('radiogroup', { name: 'Main card style' })).queryAllByRole('link')).toHaveLength(0);
    // (jsdom doesn't apply inert to focus, so tab order is a browser check.)
  });
});

describe('change with the shift', () => {
  it('switched on, the home has the shift buttons with the current shift pressed, and that shift\'s set', async () => {
    // 22:00 BST: closing.
    const { user } = renderApp('/home/customise', manager);
    expect(screen.queryByRole('radiogroup', { name: 'Editing the widgets for' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Change with the shift' }));
    expect(screen.getByRole('switch', { name: 'Change with the shift' })).toHaveAttribute('aria-checked', 'true');
    expect(within(screen.getByRole('radiogroup', { name: 'Editing the widgets for' })).getByRole('radio', { name: 'Closing' })).toHaveAttribute('aria-checked', 'true');
    // The closing set to edit.
    expect(onHome()).toEqual(['End of day report', 'Checklists', 'Stock', 'Handover', 'Food safety', 'Repairs']);
    expect(saved('manager', 'Jo').byShift).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Done' }));

    const shifts = screen.getByRole('group', { name: 'Widgets for' });
    expect(within(shifts).getAllByRole('button').map((b) => b.textContent)).toEqual(['Opening', 'Service', 'Closing']);
    expect(within(shifts).getByRole('button', { name: 'Closing' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(shifts).getByRole('button', { name: 'Opening' })).toHaveAttribute('aria-pressed', 'false');
    expect(widgets()).toEqual(['End of day report', 'Checklists', 'Stock', 'Handover', 'Food safety', 'Repairs']);
    expect(screen.queryByText(/Looking ahead/)).not.toBeInTheDocument();
  });

  it('tapping another shift shows its set and says it is looking ahead; tapping now goes back', async () => {
    localStorage.setItem(key('manager', 'Jo'), JSON.stringify({ order: ['checklists'], hidden: [], byShift: true }));
    const { user } = renderApp('/', manager);
    const shifts = screen.getByRole('group', { name: 'Widgets for' });
    await user.click(within(shifts).getByRole('button', { name: 'Opening' }));
    expect(within(shifts).getByRole('button', { name: 'Opening' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(shifts).getByRole('button', { name: 'Closing' })).toHaveAttribute('aria-pressed', 'false');
    expect(widgets()).toEqual(['Handover', 'Checklists', 'Your day', 'Food safety', 'Stock', 'Repairs']);
    expect(screen.getByText('Looking ahead. Switches to Closing by itself.')).toBeInTheDocument();

    await user.click(within(shifts).getByRole('button', { name: 'Service' }));
    // On shift is in the service set for managers too; the stack leads.
    expect(widgets()).toEqual(['Smart stack', 'Checklists', 'Quick actions', 'Repairs', 'Handover', 'On shift']);
    expect(screen.getByText(/^Looking ahead\./)).toBeInTheDocument();

    await user.click(within(shifts).getByRole('button', { name: 'Closing' }));
    expect(widgets()[0]).toBe('End of day report');
    expect(screen.queryByText(/Looking ahead/)).not.toBeInTheDocument();
  });

  it('staff shift sets drop what they can\'t have', async () => {
    localStorage.setItem(key('staff', 'Sam'), JSON.stringify({ order: ['checklists'], hidden: [], byShift: true }));
    const { user } = renderApp('/', staff);
    // Closing starts with the EOD for those who close; not for staff.
    expect(widgets()).toEqual(['Checklists', 'Stock', 'Handover', 'Food safety', 'Repairs']);
    await user.click(screen.getByRole('button', { name: 'Service' }));
    expect(widgets()).not.toContain('On shift');
  });

  it('each shift\'s set is edited and saved on its own', async () => {
    const { user } = renderApp('/home/customise', manager);
    await user.click(screen.getByRole('switch', { name: 'Change with the shift' }));
    await user.click(screen.getByRole('radio', { name: 'Opening' }));
    expect(onHome()[0]).toBe('Handover');
    await user.click(screen.getByRole('button', { name: 'Hide Handover' }));
    const s = saved('manager', 'Jo');
    expect(s.shifts.opening.order).not.toContain('handover');
    expect(s.shifts.opening.hidden).toContain('handover');
    expect(s.shifts.closing).toBeUndefined();
    await user.click(screen.getByRole('radio', { name: 'Closing' }));
    expect(onHome()).toContain('Handover');
  });
});

describe('Your day', () => {
  it('lists today\'s checklists in time order, with Now where we are and the EOD after', () => {
    at('2026-10-05T09:00:00Z'); // 10:00 BST: Opening checks 09:30 is late
    localStorage.setItem(key('manager', 'Jo'), JSON.stringify({ order: ['day'], hidden: [] }));
    renderApp('/', manager);
    const day = region('Your day');
    const items = within(day).getAllByRole('listitem');
    expect(items.map((li) => li.querySelector('.wday-t')!.textContent)).toEqual(['09:30', '10:00', '12:00', '15:00', '16:30', '18:00', '23:00', 'After']);
    expect(items[1]).toHaveClass('wday-now');
    expect(items[1]).toHaveAttribute('aria-label', 'Now, 10:00');
    expect(items[0]).toHaveClass('late');
    expect(items[0]).toHaveTextContent('Opening checks30 min late');
    expect(within(items[0]!).getByRole('link')).toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|opening|09:30'));
    // Titles drop the time already in the left column.
    expect(items[2]).toHaveTextContent(/^12:00Hot holding3 checks/);
    expect(within(items.at(-1)!).getByRole('link', { name: /^End of day report/ })).toHaveAttribute('href', '/close');
    expect(items.at(-1)).toHaveTextContent('0 of 8 sections');
  });

  it('done lists fold into Earlier, and Now goes last once nothing is still to come; staff get no EOD row', () => {
    at('2026-10-05T22:15:00Z'); // 23:15 BST
    localStorage.setItem(key('staff', 'Sam'), JSON.stringify({ order: ['day'], hidden: [] }));
    for (const [k, t] of [['opening|09:30', '08:40'], ['hothold|12:00', '11:02'], ['hothold|15:00', '14:01'], ['hothold|18:00', '17:05'], ['bar|16:30', '15:31'], ['closing|23:00', '22:10']] as const) {
      seedRun(`2026-10-05|${k}`, k.startsWith('closing') ? 'Sam' : 'Alex', `2026-10-05T${t}:00Z`);
    }
    renderApp('/', staff);
    const day = region('Your day');
    // The last two done stay in view, in time order; the four before fold into Earlier.
    expect(day.querySelector('.wmeta')).toHaveTextContent('Earlier: 4 done');
    const items = within(day).getAllByRole('listitem');
    expect(items.map((li) => li.querySelector('.wday-t')!.textContent)).toEqual(['18:00', '23:00', '23:15']);
    expect(items[0]).toHaveClass('done');
    expect(items[0]).toHaveTextContent('Done by Alex');
    expect(items[1]).toHaveTextContent('Done by you');
    expect(items.at(-1)).toHaveAttribute('aria-label', 'Now, 23:15');
    expect(within(day).queryByText('End of day report')).not.toBeInTheDocument();
  });
});

describe('Smart stack', () => {
  const stackFor = (role: string, name: string) => localStorage.setItem(key(role, name), JSON.stringify({ order: ['stack'], hidden: [] }));
  /** The cards, in the order they are stacked (most urgent first). */
  const cards = () => [...region('Smart stack').querySelectorAll<HTMLElement>('li.wstk-card')];
  const names = () => cards().map((c) => c.getAttribute('aria-label'));
  const top = () => region('Smart stack').querySelector<HTMLElement>('li.wstk-card.top')!;
  const then = () => region('Smart stack').querySelector('.wstk-then')?.textContent;
  const dot = (name: string) => within(region('Smart stack')).getByRole('button', { name: `Show ${name}` });

  it('one card per topic, most urgent first: a late checklist puts Checklists on top', () => {
    at('2026-10-05T09:00:00Z'); // 10:00 BST: Opening checks 30 min late
    stackFor('manager', 'Jo');
    renderApp('/', manager);
    expect(names()).toEqual(['1 of 3: Checklists', '2 of 3: Food safety', '3 of 3: End of day report']);
    const [lists, food, eod] = cards();
    expect(lists).toHaveClass('top');
    expect(lists!.querySelector('.wmeta')).toHaveTextContent('1 of 3 · swipe');
    // Checklists: a ring, how many are done, the urgent list in a pill, and Start.
    expect(lists!.querySelector('svg.wring')).not.toBeNull();
    expect(lists!.querySelector('.wtile')).toHaveTextContent(/^0 of 6 done$/);
    expect(lists!.querySelector('.pill')).toHaveTextContent('Opening checks · 30 min late');
    expect(lists!.querySelector('.pill')).toHaveClass('p-bad');
    expect(within(lists!).getByRole('link', { name: 'Start opening checks' })).toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|opening|09:30'));
    // Food safety: how many to do, the first in a pill, no ring.
    expect(food!.querySelector('svg.wring')).toBeNull();
    expect(food!.querySelector('.wtile')).toHaveTextContent(/^\d+ to do$/);
    expect(food!.querySelector('.pill')).not.toBeNull();
    expect(food!.querySelector('a.mini')).toHaveTextContent('Open food safety');
    expect(food!.querySelector('a.mini')).toHaveAttribute('href', '/food-safety');
    // The end of day report: sections done, with a ring.
    expect(eod!.querySelector('.wtile')).toHaveTextContent(/^0 of 8 sections$/);
    expect(eod!.querySelector('svg.wring')).not.toBeNull();
    // Only the top card can be read or used; the rest wait behind it.
    for (const c of [food!, eod!]) {
      expect(c).toHaveAttribute('aria-hidden', 'true');
      expect(c).toHaveAttribute('inert');
    }
    expect(lists).not.toHaveAttribute('inert');
    expect(lists).toHaveAttribute('aria-hidden', 'false');
    expect(then()).toBe('Then: Food safety · End of day report');
  });

  it('a list only due waits behind something urgent; nothing urgent goes last', () => {
    at('2026-10-05T08:20:00Z'); // 09:20 BST: Opening checks due in 10 min
    stackFor('manager', 'Jo');
    renderApp('/', manager);
    // Food safety has something to do now (red); the due list is amber; the EOD has nothing wrong.
    expect(names()).toEqual(['1 of 3: Food safety', '2 of 3: Checklists', '3 of 3: End of day report']);
    expect(cards()[0]!.querySelector('.pill')).toHaveClass('p-bad');
    expect(cards()[1]!.querySelector('.pill')).toHaveTextContent('Opening checks · due in 10 min');
    expect(cards()[1]!.querySelector('.pill')).toHaveClass('p-warn');
    expect(cards()[2]!.querySelector('.pill')).toBeNull();
    expect(top()).toHaveAccessibleName('1 of 3: Food safety');
  });

  it('staff never get the End of day report card; supervisors do', () => {
    stackFor('staff', 'Sam');
    const { unmount } = renderApp('/', staff);
    expect(names()).toEqual(['1 of 2: Checklists', '2 of 2: Food safety']);
    expect(region('Smart stack')).not.toHaveTextContent(/End of day report|sections/);
    expect(then()).toBe('Then: Food safety');
    unmount();
    stackFor('supervisor', 'Jo');
    renderApp('/', supervisor);
    expect(names()).toContain('3 of 3: End of day report');
  });

  it('the dots and the arrow keys change the top card and the Then line', async () => {
    stackFor('manager', 'Jo');
    const { user } = renderApp('/', manager);
    expect(dot('Checklists')).toHaveAttribute('aria-current', 'true');
    expect(dot('Food safety')).not.toHaveAttribute('aria-current');
    await user.click(dot('End of day report'));
    expect(top()).toHaveAccessibleName('3 of 3: End of day report');
    expect(top().querySelector('.wmeta')).toHaveTextContent('3 of 3 · swipe');
    expect(dot('End of day report')).toHaveAttribute('aria-current', 'true');
    expect(dot('Checklists')).not.toHaveAttribute('aria-current');
    expect(then()).toBe('Then: Checklists · Food safety');
    expect(cards()[0]).toHaveAttribute('inert');
    // Right goes round to the first again; left goes back.
    await user.keyboard('{ArrowRight}');
    expect(top()).toHaveAccessibleName('1 of 3: Checklists');
    expect(then()).toBe('Then: Food safety · End of day report');
    await user.keyboard('{ArrowLeft}');
    expect(top()).toHaveAccessibleName('3 of 3: End of day report');
    await user.keyboard('{ArrowLeft}');
    expect(top()).toHaveAccessibleName('2 of 3: Food safety');
    expect(dot('Food safety')).toHaveAttribute('aria-current', 'true');
    expect(then()).toBe('Then: End of day report · Checklists');
  });

  it('a swipe of more than 80px moves to the next card; a shorter one snaps back', async () => {
    stackFor('manager', 'Jo');
    renderApp('/', manager);
    const swipe = (dx: number) => {
      const li = top();
      fireEvent.pointerDown(li, { pointerId: 1, button: 0, clientX: 200 });
      fireEvent.pointerMove(li, { pointerId: 1, buttons: 1, clientX: 200 + dx / 2 });
      fireEvent.pointerMove(li, { pointerId: 1, buttons: 1, clientX: 200 + dx });
      fireEvent.pointerUp(li, { pointerId: 1, clientX: 200 + dx });
    };
    // Short: back where it was.
    swipe(-60);
    expect(top()).toHaveAccessibleName('1 of 3: Checklists');
    expect(then()).toBe('Then: Food safety · End of day report');
    // Exactly 80 isn't enough.
    swipe(-80);
    expect(top()).toHaveAccessibleName('1 of 3: Checklists');
    // Left past 80px: the next card.
    swipe(-120);
    expect(top()).toHaveAccessibleName('2 of 3: Food safety');
    expect(dot('Food safety')).toHaveAttribute('aria-current', 'true');
    expect(then()).toBe('Then: End of day report · Checklists');
    // Right past 80px: back one.
    swipe(120);
    expect(top()).toHaveAccessibleName('1 of 3: Checklists');
    // The drag lets go of the card after the gesture.
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(region('Smart stack').querySelector('.wstk-deck')).not.toHaveClass('dragging');
  });

  it('a tap on the top card\'s button still opens it', async () => {
    at('2026-10-05T09:00:00Z');
    stackFor('manager', 'Jo');
    const { user } = renderApp('/', manager);
    await user.click(within(top()).getByRole('link', { name: 'Start opening checks' }));
    // The pointer went down and up without moving, so it's a tap, not a swipe: the list opens.
    expect(screen.queryByRole('region', { name: 'Smart stack' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Freezer')).toBeInTheDocument();
  });

  it('with no checklists, there is no Checklists card', () => {
    stackFor('staff', 'Sam');
    localStorage.setItem('mgh.templates.v1', '[]');
    renderApp('/', staff);
    expect(names()).not.toContain(expect.stringMatching(/Checklists$/));
    expect(within(region('Smart stack')).queryByRole('button', { name: 'Show Checklists' })).not.toBeInTheDocument();
  });
});

describe('Last 7 days with no history', () => {
  it('says no days are sent yet instead of showing nothing', () => {
    // Example history is off in this file, and nothing has been sent.
    localStorage.setItem(key('manager', 'Jo'), JSON.stringify({ order: ['week'], hidden: [] }));
    renderApp('/', manager);
    const week = region('Last 7 days');
    expect(within(week).getByText('No days sent yet. Net sales, wages and covers show here once the first end of day report is in.')).toBeInTheDocument();
    expect(week.querySelector('.bars')).toBeNull();
    expect(week.querySelector('.wmeta')).toBeNull();
  });
});
