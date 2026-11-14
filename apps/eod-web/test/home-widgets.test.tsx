/** The home as widgets (designs W1–W8): each role's starting set, Customise, compact tiles, rings, sets by shift, Your day and Smart stack. */
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
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
  it('staff: Checklists, Food safety and Recipes; never the EOD, Last 7 days or On shift', () => {
    renderApp('/', staff);
    expect(widgets()).toEqual(['Checklists', 'Food safety', 'Recipes']);
    for (const name of ['End of day report', 'Last 7 days', 'On shift']) expect(screen.queryByRole('region', { name })).not.toBeInTheDocument();
    // Off by default, and can be added.
    for (const name of ['Handover', 'Repairs', 'Stock', 'Your day', 'Smart stack', 'Quick actions']) expect(screen.queryByRole('region', { name })).not.toBeInTheDocument();
  });

  it('staff can\'t add the EOD, Last 7 days or On shift from Customise either', async () => {
    const { user } = renderApp('/', staff);
    await user.click(screen.getByRole('link', { name: 'Customise' }));
    expect(screen.getByRole('heading', { name: 'Customise home', level: 1 })).toBeInTheDocument();
    expect(onHome()).toEqual(['Checklists', 'Food safety', 'Recipes']);
    expect(addable()).toEqual(['Your day', 'Smart stack', 'Quick actions', 'Stock', 'Repairs', 'Handover']);
    for (const name of ['End of day report', 'Last 7 days', 'On shift']) expect([...onHome(), ...addable()]).not.toContain(name);
  });

  it('supervisors: Checklists, the EOD, Stock, Food safety and Recipes; On shift to add; no Last 7 days', async () => {
    const { user } = renderApp('/', supervisor);
    expect(widgets()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Recipes']);
    expect(screen.queryByRole('region', { name: 'On shift' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Customise' }));
    expect(addable()).toEqual(['Your day', 'Smart stack', 'Quick actions', 'Repairs', 'Handover', 'On shift']);
    expect([...onHome(), ...addable()]).not.toContain('Last 7 days');
    // Adding On shift puts it on their home.
    await user.click(screen.getByRole('button', { name: 'Add On shift' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(widgets().at(-1)).toBe('On shift');
  });

  it('managers: the supervisor\'s set plus Repairs; Last 7 days is under Add widgets', async () => {
    const { user } = renderApp('/', manager);
    expect(widgets()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Recipes', 'Repairs']);
    await user.click(screen.getByRole('link', { name: 'Customise' }));
    expect(onHome()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Recipes', 'Repairs']);
    expect(addable()).toEqual(['Your day', 'Smart stack', 'Quick actions', 'Handover', 'On shift', 'Last 7 days']);
  });

  it('head office in a site starts with the manager\'s set', () => {
    renderApp('/', { ...admin, inSite: true });
    expect(widgets()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Recipes', 'Repairs']);
  });

  it('who can have each widget, and a saved layout only keeps what the person may have', () => {
    expect(widgetAllowed('eod', 'staff', false)).toBe(false);
    expect(widgetAllowed('week', 'supervisor', true)).toBe(false);
    expect(widgetAllowed('onshift', 'staff', false)).toBe(false);
    expect(DEFAULT_LAYOUT).toEqual({
      staff: ['checklists', 'food', 'recipes'],
      supervisor: ['checklists', 'eod', 'stock', 'food', 'recipes'],
      manager: ['checklists', 'eod', 'stock', 'food', 'recipes', 'repairs'],
      headoffice: ['checklists', 'eod', 'stock', 'food', 'recipes', 'repairs'],
    });
    // Off by default for everyone.
    for (const id of ['handover', 'onshift', 'week', 'day', 'stack', 'quick'] as const) {
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
    expect(onHome()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Recipes', 'Repairs']);
    expect(saved('manager', 'Jo').order).toEqual(['checklists', 'eod', 'stock', 'food', 'recipes', 'repairs']);
  });

  it('the arrows move a widget; the first can\'t go earlier and the last can\'t go later', async () => {
    const { user } = renderApp('/home/customise', manager);
    expect(screen.getByRole('button', { name: 'Move Checklists earlier' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Repairs later' })).toBeDisabled();
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
    expect(widgets()).toEqual(['End of day report', 'Checklists', 'Stock', 'Food safety', 'Recipes', 'Smart stack']);
    expect(saved('manager', 'Jo')).toMatchObject({ order: ['eod', 'checklists', 'stock', 'food', 'recipes', 'stack'] });
    expect(saved('manager', 'Jo').hidden).toContain('repairs');
    // Still there next time.
    unmount();
    renderApp('/', manager);
    expect(widgets()[0]).toBe('End of day report');
  });

  it('layouts are per person and role: the supervisor called Jo keeps the usual layout', () => {
    localStorage.setItem(key('manager', 'Jo'), JSON.stringify({ order: ['stock'], hidden: [] }));
    renderApp('/', supervisor);
    expect(widgets()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Recipes']);
  });

  it('Reset goes back to the usual layout, with Undo', async () => {
    const { user } = renderApp('/home/customise', manager);
    await user.click(screen.getByRole('button', { name: 'Hide Checklists' }));
    await user.click(screen.getByRole('button', { name: 'Move Repairs earlier' }));
    expect(onHome()).toEqual(['End of day report', 'Stock', 'Food safety', 'Repairs', 'Recipes']);
    await user.click(screen.getByRole('button', { name: 'Reset to the usual layout' }));
    expect(screen.getByRole('status')).toHaveTextContent('Back to the usual layout');
    expect(onHome()).toEqual(['Checklists', 'End of day report', 'Stock', 'Food safety', 'Recipes', 'Repairs']);
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
  it('puts late checklists first, then what needs doing now, and counts them', () => {
    at('2026-10-05T09:00:00Z'); // 10:00 BST: Opening checks 30 min late
    localStorage.setItem(key('manager', 'Jo'), JSON.stringify({ order: ['stack'], hidden: [] }));
    renderApp('/', manager);
    const stack = region('Smart stack');
    const cards = within(within(stack).getByRole('list', { name: 'Most urgent first' })).getAllByRole('listitem');
    expect(cards[0]).toHaveTextContent(/^ChecklistOpening checks30 min lateStart$/);
    expect(cards[0]).toHaveClass('bad');
    expect(within(cards[0]!).getByRole('link')).toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|opening|09:30'));
    expect(stack.querySelector('.wmeta')).toHaveTextContent(`1 of ${cards.length}`);
    // Everything urgent (red) comes before anything that's only to do today.
    const tones = cards.map((c) => c.classList.contains('bad'));
    expect(tones.indexOf(false)).toBeGreaterThan(tones.lastIndexOf(true));
  });

  it('every overdue checklist comes before anything else; one only due waits behind the urgent things', () => {
    at('2026-10-05T10:50:00Z'); // 11:50 BST: Opening checks missed, Hot holding 12:00 due
    localStorage.setItem(key('manager', 'Jo'), JSON.stringify({ order: ['stack'], hidden: [] }));
    renderApp('/', manager);
    const cards = within(region('Smart stack')).getAllByRole('listitem');
    const kinds = cards.map((c) => c.querySelector('small')!.textContent);
    expect(cards[0]).toHaveTextContent(/^ChecklistOpening checksMissed/);
    const due = cards.findIndex((c) => /Hot holding · 12:00/.test(c.textContent ?? ''));
    expect(cards[due]).toHaveTextContent('Due in 10 min');
    // The urgent food safety items are ahead of the due list.
    expect(kinds.slice(1, due).every((k) => k === 'Food safety')).toBe(true);
    expect(due).toBeGreaterThan(1);
  });

  it('a late list comes before a missed one: it can still be done in its window', () => {
    at('2026-10-05T11:10:00Z'); // 12:10 BST: Hot holding 12:00 is 10 min late; Opening checks missed
    localStorage.setItem(key('manager', 'Jo'), JSON.stringify({ order: ['stack'], hidden: [] }));
    renderApp('/', manager);
    const cards = within(region('Smart stack')).getAllByRole('listitem');
    expect(cards[0]).toHaveTextContent(/^ChecklistHot holding · 12:0010 min lateStart$/);
    expect(cards[0]).toHaveClass('bad');
    expect(within(cards[0]!).getByRole('link')).toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|hothold|12:00'));
    expect(cards[1]).toHaveTextContent(/^ChecklistOpening checksMissed/);
    expect(cards[1]).toHaveClass('warn');
    expect(within(cards[1]!).getByRole('link')).toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|opening|09:30'));
  });

  it('with no checklists, there are no checklist cards', () => {
    localStorage.setItem(key('staff', 'Sam'), JSON.stringify({ order: ['stack'], hidden: [] }));
    localStorage.setItem('mgh.templates.v1', '[]');
    renderApp('/', staff);
    expect(within(region('Smart stack')).queryByText('Checklist')).not.toBeInTheDocument();
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
