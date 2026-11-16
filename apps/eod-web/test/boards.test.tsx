/**
 * Five screens rebuilt to the Claude Design boards (design/redesign-canvas/project/*.dc.html):
 * P2 Switch site, P4 Lunch and Dinner in steps, P5 Checklists, P6 Search on phones, P9 Day closed.
 * Phones unless a test says otherwise (jsdom has no matchMedia, so useWide is false).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, seedVerifiedDraft, manager, staff } from './harness';
import { deviceStore } from '../app/lib/store';
import { people } from '../app/lib/people';
import { setNow } from '../app/lib/clock';

const desktop = () => {
  window.matchMedia = ((q: string) => ({ matches: /min-width/.test(q), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
};
const phone = () => { delete (window as { matchMedia?: unknown }).matchMedia; };

describe('Lunch and Dinner in steps (P4)', () => {
  const steps = (label = 'Lunch') => screen.getByRole('navigation', { name: `${label} steps` });
  const count = () => document.querySelector('.eod-count');

  it('a stepper names the four steps, marks the current one, and the bar counts it', async () => {
    const { user } = renderApp('/close/lunch');
    const buttons = within(steps()).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Till', 'Covers', 'Cash', 'Discounts']);
    expect(buttons[0]).toHaveAttribute('aria-current', 'step');
    expect(buttons.slice(1).every((b) => !b.hasAttribute('aria-current'))).toBe(true);
    expect(count()).toHaveTextContent(/^1\/4$/);
    // The old Saved in the bar is replaced by the count.
    expect(document.querySelector('header .saved')).toBeNull();

    await user.click(within(steps()).getByRole('button', { name: 'Cash' }));
    expect(within(steps()).getByRole('button', { name: 'Cash' })).toHaveAttribute('aria-current', 'step');
    expect(within(steps()).getByRole('button', { name: 'Till' })).not.toHaveAttribute('aria-current');
    expect(count()).toHaveTextContent(/^3\/4$/);
  });

  it('Till shows the till figures with their hints, then food and drink, and nothing from the other steps', () => {
    renderApp('/close/lunch');
    const hints: Record<string, string> = {
      'Gross sales': 'Total on the Z report',
      'Service charge': 'Goes to Tips',
      VAT: 'From the till',
      'Discounts and comps': 'Lines come next',
    };
    for (const [label, hint] of Object.entries(hints)) {
      const row = screen.getByLabelText(label).closest('label')!;
      expect(row).toHaveTextContent(`${label}${hint}`);
    }
    // Food and drink come after the till figures.
    const food = screen.getByLabelText('Food');
    expect(screen.getByLabelText('Discounts and comps').compareDocumentPosition(food) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText('Drink')).toBeInTheDocument();
    // The old "&" labels are gone.
    expect(screen.queryByLabelText('Discounts & comps')).not.toBeInTheDocument();
    for (const other of ['Booked covers', 'Walk-in covers', 'Till says']) expect(screen.queryByLabelText(other)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add discount, comp or void' })).not.toBeInTheDocument();
  });

  it('Covers, Cash and Discounts each show only their own fields', async () => {
    const { user } = renderApp('/close/lunch');
    const go = (name: string) => user.click(within(steps()).getByRole('button', { name }));

    await go('Covers');
    expect(screen.getByLabelText('Booked covers')).toBeInTheDocument();
    expect(screen.getByLabelText('Walk-in covers')).toBeInTheDocument();
    for (const other of ['Gross sales', 'Food', 'Till says']) expect(screen.queryByLabelText(other)).not.toBeInTheDocument();

    await go('Cash');
    expect(screen.getByRole('link', { name: /Counted in drawer/ })).toHaveAttribute('href', '/close/lunch/cash');
    expect(screen.getByLabelText('Till says')).toBeInTheDocument();
    for (const other of ['Gross sales', 'Booked covers']) expect(screen.queryByLabelText(other)).not.toBeInTheDocument();

    await go('Discounts');
    expect(screen.getByRole('heading', { name: 'Discount and comp lines' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add discount, comp or void' })).toBeInTheDocument();
    for (const other of ['Gross sales', 'Booked covers', 'Till says']) expect(screen.queryByLabelText(other)).not.toBeInTheDocument();
  });

  it('the reason chips show on the Cash step once the cash is out', async () => {
    const { user } = renderApp('/close/lunch');
    await user.click(within(steps()).getByRole('button', { name: 'Cash' }));
    expect(screen.queryByRole('radiogroup', { name: 'Reason for the cash difference' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Till says'), '20');
    expect(screen.getByRole('radiogroup', { name: 'Reason for the cash difference' })).toBeInTheDocument();
  });

  it('figures typed on one step are still there after visiting the others, and the net stays on the card', async () => {
    const { user } = renderApp('/close/lunch');
    await user.type(screen.getByLabelText('Gross sales'), '1200');
    await user.type(screen.getByLabelText('Service charge'), '120');
    await user.click(within(steps()).getByRole('button', { name: 'Covers' }));
    await user.type(screen.getByLabelText('Booked covers'), '30');
    // The card's net is the same on every step.
    expect(document.querySelector('.eod-card')).toHaveTextContent('£1,080.00');
    await user.click(within(steps()).getByRole('button', { name: 'Till' }));
    expect(screen.getByLabelText('Gross sales')).toHaveValue('£1,200.00');
    expect(screen.getByTestId('net')).toHaveTextContent('£1,080.00');
    expect(screen.getByTestId('net')).toHaveClass('vh');
    await user.click(within(steps()).getByRole('button', { name: 'Covers' }));
    expect(screen.getByLabelText('Booked covers')).toHaveValue('30');
  });

  it('on a phone, Next walks the steps, then saves lunch and goes to the next section not done', async () => {
    const { user } = renderApp('/close/lunch');
    for (const [label, at] of [['Next: covers', '2/4'], ['Next: cash', '3/4'], ['Next: discounts', '4/4']] as const) {
      await user.click(screen.getByRole('button', { name: label }));
      expect(count()).toHaveTextContent(at);
    }
    // Only one button at the bottom at a time.
    expect(screen.queryByRole('button', { name: /^Next: (covers|cash|discounts)$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save / })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next: dinner' }));
    // Dinner opens on its own first step.
    expect(await screen.findByRole('navigation', { name: 'Dinner steps' })).toBeInTheDocument();
    expect(within(steps('Dinner')).getByRole('button', { name: 'Till' })).toHaveAttribute('aria-current', 'step');
    expect(document.querySelector('.eod-card')).toHaveTextContent('Dinner net · updates as you type');
    // Lunch is marked done.
    await user.click(screen.getByRole('link', { name: 'End of day report' }));
    expect(await screen.findByRole('img', { name: '1 of 8 sections done' })).toBeInTheDocument();
  });

  it('the last step skips sections already done', async () => {
    await seedVerifiedDraft(); // lunch, dinner, delivery and wages done
    const { user } = renderApp('/close/dinner');
    await user.click(within(steps('Dinner')).getByRole('button', { name: 'Discounts' }));
    await user.click(screen.getByRole('button', { name: 'Next: promotions & other' }));
    // Wages is done in the example, so Promotions goes on to Tips.
    expect(await screen.findByRole('button', { name: 'Next: tips & service charge' })).toBeInTheDocument();
  });

  it('with everything else done, the last step reads Review and send and goes to Review', async () => {
    await seedVerifiedDraft((d) => {
      d.completed = { lunch: false, dinner: true, delivery: true, promotions: true, wages: true, tips: true, feedback: true, handover: true };
    });
    const { user } = renderApp('/close/lunch');
    await user.click(within(steps()).getByRole('button', { name: 'Discounts' }));
    await user.click(screen.getByRole('button', { name: 'Review and send' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ready to send?' })).toBeInTheDocument();
  });

  it('under the button: how it saves, then the time it last saved on this phone', async () => {
    const { user } = renderApp('/close/lunch');
    const foot = () => screen.getByRole('button', { name: 'Next: covers' }).parentElement!;
    expect(foot()).toHaveTextContent('Saves on this phone as you type');
    await user.type(screen.getByLabelText('Gross sales'), '100');
    await user.tab();
    expect(await within(foot()).findByText('Saved on this phone · 22:00')).toBeInTheDocument();
  });

  it('other sections have one phone button, Next: the following section, which saves and moves on', async () => {
    const { user } = renderApp('/close/delivery');
    expect(screen.queryByRole('button', { name: 'Save delivery' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /steps$/ })).not.toBeInTheDocument();
    // No stepper, so the bar keeps Saved rather than a count.
    expect(document.querySelector('.eod-count')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next: promotions & other' }));
    expect(await screen.findByRole('button', { name: 'Next: wages' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'End of day report' }));
    expect(await screen.findByRole('img', { name: '1 of 8 sections done' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Sales' }).querySelector('.cl-hd')).toHaveTextContent('Sales1 of 4 done');
  });

  it('Handover, the last section, goes round to the first one not done', async () => {
    const { user } = renderApp('/close/handover');
    await user.click(screen.getByRole('button', { name: 'Next: lunch' }));
    expect(await screen.findByRole('navigation', { name: 'Lunch steps' })).toBeInTheDocument();
  });

  it('the back link names the End of day report', () => {
    renderApp('/close/lunch');
    expect(screen.getByRole('link', { name: 'End of day report' })).toHaveAttribute('href', '/close');
  });
});

describe('Day closed (P9)', () => {
  const send = async (change?: Parameters<typeof seedVerifiedDraft>[0]) => {
    await seedVerifiedDraft(change);
    const r = renderApp('/close/review');
    await r.user.click(screen.getByRole('checkbox'));
    await r.user.click(screen.getByRole('button', { name: 'Send Monday · £2,687.50' }));
    await screen.findByRole('heading', { name: 'Day closed' });
    return r;
  };
  const next = () => screen.getByRole('region', { name: 'What happens next' });
  const rows = () => [...next().querySelectorAll('.li .tx > span:first-child')].map((e) => e.textContent);

  it('the card has the day, its net and who has it now; the old rows and strip are gone', async () => {
    await send();
    const card = document.querySelector<HTMLElement>('.sent-card')!;
    expect(within(card).getByRole('heading', { name: 'Day closed' })).toBeInTheDocument();
    expect(card).toHaveTextContent('Bunso · Monday 5 Oct · £2,687.50 net');
    expect(card.querySelector('.sent-pill')).toHaveTextContent(/^Saved on this device · 22:00$/);
    expect(rows()).toEqual(['Kept on this device', 'Need to change something?']);
    for (const old of ['Received by head office', 'Figures checked again', 'Saved on this device', 'Handover waits for the opener']) {
      expect(within(next()).queryByText(old)).not.toBeInTheDocument();
    }
    // The wages / cash / covers strip is gone.
    expect(document.querySelector('.hm')).toBeNull();
    expect(screen.queryByText('29.8%')).not.toBeInTheDocument();
    expect(screen.queryByText('Balanced')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Done' })).toHaveAttribute('href', '/');
  });

  it('handover notes and repairs add their own rows', async () => {
    await send((d) => {
      d.handover = [{ id: 'h1', category: 'Stock', body: 'Low on limes', raiseRepair: false }, { id: 'h2', category: 'Other', body: '   ', raiseRepair: false }];
      d.feedback = [{ id: 'f1', category: 'Maintenance', body: 'Dishwasher leaking', raiseRepair: true }];
    });
    expect(rows()).toEqual(['Kept on this device', 'Handover goes to the opener', 'Repair raised', 'Need to change something?']);
    // A blank note doesn't count.
    expect(next()).toHaveTextContent('1 note for tomorrow morning');
    expect(next()).toHaveTextContent('1 from feedback');
  });

  it('once head office approves it, the pill says so', async () => {
    const r = await send();
    r.unmount();
    await deviceStore().setStatus('BUN', '2026-10-05', 'approved', { by: 'Ana' });
    renderApp('/close/done');
    expect(await screen.findByText(/^Approved by head office/)).toHaveClass('sent-pill');
  });
});

describe('Checklists page on a phone (P5)', () => {
  const opening = '/checklists/' + encodeURIComponent('2026-10-05|opening|09:30');

  it('the same top bar as Today (site, search, you), then the title with Edit lists', () => {
    setNow(new Date('2026-10-05T07:00:00Z')); // 08:00 BST
    renderApp('/checklists');
    const bar = document.querySelector<HTMLElement>('header.homenav')!;
    expect(within(bar).getByRole('button', { name: /Bunso/ })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Search' })).toBeInTheDocument();
    const h1 = screen.getByRole('heading', { level: 1, name: 'Checklists' });
    expect(within(h1.parentElement!).getByRole('link', { name: 'Edit lists' })).toHaveAttribute('href', '/checklists/edit');
    expect(screen.queryByText(/Do them any time of day/)).not.toBeInTheDocument();
  });

  it('staff get the same bar without Edit lists', () => {
    renderApp('/checklists', staff);
    expect(document.querySelector('header.homenav')).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit lists' })).not.toBeInTheDocument();
  });

  it('a phase keeps its bar with the way back to All', () => {
    renderApp('/checklists?phase=mid-shift');
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('href', '/checklists');
    expect(screen.getByRole('heading', { level: 1, name: 'Mid-shift checklists' })).toBeInTheDocument();
  });

  it('the card has a ring with the share done and what is due next', () => {
    setNow(new Date('2026-10-05T07:00:00Z')); // 08:00 BST, nothing done
    renderApp('/checklists');
    const card = document.querySelector<HTMLElement>('.lists-ring')!;
    const ring = within(card).getByRole('img', { name: '0 of 6 done' });
    expect(ring).toHaveTextContent('0%');
    expect(card).toHaveTextContent('Next due · Opening checks at 09:30');
  });

  it('a list whose title has its time does not repeat it', () => {
    setNow(new Date('2026-10-05T10:45:00Z')); // 11:45 BST, Hot holding · 12:00 next
    renderApp('/checklists');
    expect(document.querySelector('.lists-ring')).toHaveTextContent(/Next due · Hot holding · 12:00(?! at)/);
  });

  it('a failed check not fixed yet is listed under Needs fixing, and goes once fixed', async () => {
    setNow(new Date('2026-10-05T08:15:00Z')); // 09:15 BST
    const run = renderApp(opening);
    await run.user.type(run.getByLabelText('Walk-in fridge'), '9.2');
    expect(screen.getByText('Too warm: 9.2°C')).toBeInTheDocument();
    run.unmount();

    const lists = renderApp('/checklists');
    const fix = screen.getByRole('region', { name: 'Needs fixing' });
    expect(fix.querySelector('.cl-hd')).toHaveTextContent(/^Needs fixing1 failed$/);
    const link = within(fix).getByRole('link');
    expect(link).toHaveAttribute('href', opening);
    expect(link).toHaveTextContent(/^Walk-in fridge · Too warm: 9\.2°C/);
    expect(link).toHaveTextContent('Opening checks · tap to say what you did');
    expect(link).toHaveTextContent(/Fix it$/);
    // It comes before the lists to do.
    expect(fix.compareDocumentPosition(screen.getByRole('heading', { name: 'To do' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await lists.user.click(link);
    const panel = await screen.findByRole('group', { name: 'Fix Walk-in fridge' });
    await lists.user.click(within(panel).getByRole('button', { name: 'Moved food to another fridge' }));
    await lists.user.click(within(panel).getByRole('button', { name: 'Save what you did' }));
    expect(await screen.findByText(/Dealt with: moved food to another fridge/)).toBeInTheDocument();
    lists.unmount();
    renderApp('/checklists');
    expect(screen.queryByRole('region', { name: 'Needs fixing' })).not.toBeInTheDocument();
  });

  it('with nothing failed there is no Needs fixing', () => {
    renderApp('/checklists');
    expect(screen.queryByRole('region', { name: 'Needs fixing' })).not.toBeInTheDocument();
  });
});

describe('Search (P6)', () => {
  // jsdom has no scrollIntoView; the search list calls it to keep the picked row in view.
  const had = Element.prototype.scrollIntoView;
  beforeEach(() => { Element.prototype.scrollIntoView = () => {}; });
  afterEach(() => { Element.prototype.scrollIntoView = had; phone(); });

  const open = async (who = manager) => {
    const r = renderApp('/', who);
    await r.user.click(within(document.querySelector<HTMLElement>('header.homenav')!).getByRole('button', { name: 'Search' }));
    return { ...r, dialog: screen.getByRole('dialog', { name: 'Search or jump to' }) };
  };
  const labels = (dialog: HTMLElement) => within(dialog).queryAllByRole('option').map((o) => o.querySelector('.tx > span')!.textContent);

  it('on a phone: Cancel closes it, and there are no keyboard hints', async () => {
    const { user, dialog } = await open();
    expect(dialog.querySelector('.kbd')).toBeNull();
    expect(dialog.querySelector('.cmdk-foot')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Search or jump to' })).not.toBeInTheDocument();
  });

  it('Clear shows once something is typed, and empties the field', async () => {
    const { user, dialog } = await open();
    const q = within(dialog).getByRole('combobox', { name: 'Search' });
    expect(within(dialog).queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    await user.type(q, 'probe');
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }));
    expect(q).toHaveValue('');
    expect(within(dialog).queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('quick action tiles show with an empty search, and open their screen', async () => {
    const { user, dialog } = await open();
    const quick = within(dialog).getByRole('region', { name: 'Quick actions' });
    expect(within(quick).getAllByRole('button').map((b) => b.textContent)).toEqual(['Log a temp', 'Count cash', 'Report a problem']);
    await user.type(within(dialog).getByRole('combobox', { name: 'Search' }), 'x');
    expect(within(dialog).queryByRole('region', { name: 'Quick actions' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }));
    await user.click(within(within(dialog).getByRole('region', { name: 'Quick actions' })).getByRole('button', { name: 'Count cash' }));
    expect(screen.queryByRole('dialog', { name: 'Search or jump to' })).not.toBeInTheDocument();
    expect(await screen.findByLabelText('£0.00')).toBeInTheDocument();
  });

  it('staff, who do not close, get no Count cash tile', async () => {
    const { dialog } = await open(staff);
    const quick = within(dialog).getByRole('region', { name: 'Quick actions' });
    expect(within(quick).getAllByRole('button').map((b) => b.textContent)).toEqual(['Log a temp', 'Report a problem']);
  });

  it('filter chips: All plus each group, and a chip shows only its group', async () => {
    const { user, dialog } = await open();
    const chips = within(dialog).getByRole('group', { name: 'Show' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Checklists', 'Food safety', 'Actions', 'Go to']);
    expect(within(chips).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(chips).getByRole('button', { name: 'Food safety' }));
    expect(within(chips).getByRole('button', { name: 'Food safety' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(chips).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(labels(dialog)).toEqual(['Log a probe reading', 'Check in a delivery', 'Allergen matrix']);
    // A chip hides the quick actions too.
    expect(within(dialog).queryByRole('region', { name: 'Quick actions' })).not.toBeInTheDocument();
    // The chip and the words work together.
    await user.type(within(dialog).getByRole('combobox', { name: 'Search' }), 'delivery');
    expect(labels(dialog)).toEqual(['Check in a delivery']);

    await user.click(within(chips).getByRole('button', { name: 'All' }));
    expect(labels(dialog)).toContain('Start Delivery check');
  });

  it('the matching words are marked, whatever their case', async () => {
    const { user, dialog } = await open();
    await user.type(within(dialog).getByRole('combobox', { name: 'Search' }), 'PROBE read');
    const row = within(dialog).getByRole('option', { name: /Log a probe reading/ });
    expect([...row.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['probe', 'read']);
    expect(row.querySelector('.tx > span')).toHaveTextContent('Log a probe reading');
  });

  it('regex characters typed are matched as text', async () => {
    const { user, dialog } = await open();
    await user.type(within(dialog).getByRole('combobox', { name: 'Search' }), '(');
    expect(within(dialog).getByText('Nothing matches “(”.')).toBeInTheDocument();
  });

  it('on desktop it keeps esc and ↵ hints and the footer, without Cancel, chips or tiles', async () => {
    desktop();
    const { user } = renderApp('/', manager);
    await user.keyboard('{Control>}k{/Control}');
    const dialog = screen.getByRole('dialog', { name: 'Search or jump to' });
    expect(within(dialog).getByText('esc')).toHaveClass('kbd');
    expect(dialog.querySelector('[aria-selected="true"] .kbd')).toHaveTextContent('↵');
    expect(dialog.querySelector('.cmdk-foot')).toHaveTextContent('Move');
    expect(within(dialog).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('group', { name: 'Show' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('region', { name: 'Quick actions' })).not.toBeInTheDocument();
  });
});

describe('Switch site sheet (P2)', () => {
  const joAt = (siteCode: string, otherSites: string[] = []) =>
    people.add({ name: 'Jo', role: 'manager', siteCode, otherSites, email: 'jo@example.com', addedBy: 'Ana' });
  const openSheet = async (name: string) => {
    const r = renderApp('/', manager);
    await r.user.click(screen.getByRole('button', { name: /^Bunso/ }));
    return { ...r, sheet: screen.getByRole('dialog', { name }) };
  };

  it('two sites: Switch site, All my sites, You\'re here on the current one, and a ring for each', async () => {
    await seedVerifiedDraft(); // Bunso: 4 of 8 done
    joAt('BUN', ['GUA']);
    const { user, sheet } = await openSheet('Switch site');
    const all = within(sheet).getByRole('button', { name: /^All my sites/ });
    expect(all).toHaveTextContent('Tonight at your 2 sites, side by side');
    const [bun, gua] = within(sheet).getAllByRole('option');
    expect(bun).toHaveTextContent("You're here");
    expect(gua).not.toHaveTextContent("You're here");
    expect(within(bun!).getByRole('img', { name: '4 of 8 sections done' })).toBeInTheDocument();
    expect(within(gua!).getByRole('img', { name: '0 of 8 sections done' })).toBeInTheDocument();
    // No search with only two sites.
    expect(within(sheet).queryByLabelText('Find a site')).not.toBeInTheDocument();
    expect(sheet).toHaveTextContent("Circles show how much of tonight's close is done.");
    expect(sheet).not.toHaveTextContent('Each site keeps its own EOD');
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Switch site' })).not.toBeInTheDocument();
  });

  it('another site\'s ring comes from its saved report: a draft part done, a sent one full', async () => {
    await seedVerifiedDraft((d) => { d.siteCode = 'GUA'; });
    joAt('BUN', ['GUA', 'BEL']);
    const { submitReport } = await import('@maginhawa/core');
    const { settingsFor } = await import('../app/lib/draft');
    const bel = await seedVerifiedDraft((d) => { d.siteCode = 'BEL'; d.confirmed = true; });
    await submitReport(bel, { store: deviceStore(), settings: settingsFor('BEL'), submittedBy: 'Sam' });
    const { sheet } = await openSheet('Switch site');
    const opt = (name: RegExp) => within(sheet).getByRole('option', { name });
    expect(await within(opt(/Guanabana/)).findByRole('img', { name: '4 of 8 sections done' })).toBeInTheDocument();
    expect(await within(opt(/Belly/)).findByRole('img', { name: '8 of 8 sections done' })).toBeInTheDocument();
  });

  it('more than three sites gets a site search', async () => {
    joAt('BUN', ['GUA', 'BEL', 'MKT']);
    const { user, sheet } = await openSheet('Switch site');
    expect(within(sheet).getByRole('button', { name: /^All my sites/ })).toHaveTextContent('Tonight at your 4 sites');
    await user.type(within(sheet).getByLabelText('Find a site'), 'bel');
    expect(within(sheet).getAllByRole('option').map((o) => o.textContent)).toEqual([expect.stringMatching(/Belly/)]);
  });

  it('one site: Your site, with no All my sites, no search and no rings to compare', async () => {
    joAt('BUN');
    const { sheet } = await openSheet('Your site');
    expect(within(sheet).queryByRole('button', { name: /^All my sites/ })).not.toBeInTheDocument();
    expect(within(sheet).queryByLabelText('Find a site')).not.toBeInTheDocument();
    expect(within(sheet).getByRole('option')).toHaveTextContent("You're here");
    expect(sheet).toHaveTextContent('You only work at Bunso for now');
  });
});
