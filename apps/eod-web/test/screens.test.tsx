import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, seedVerifiedDraft, admin, staff } from './harness';
import { deviceStore, resetDemoEod } from '../app/lib/store';

describe('sign-in', () => {
  it('sends people who are not signed in to sign-in', async () => {
    renderApp('/close', null);
    expect(await screen.findByRole('heading', { name: 'Close the day' })).toBeInTheDocument();
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
  });

  it('signs a manager in and lands on the app home', async () => {
    const { user } = renderApp('/sign-in', null);
    await user.type(screen.getByPlaceholderText('e.g. Jo'), 'Sam');
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(await screen.findByRole('heading', { name: /, Sam$/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Start today's EOD" })).toBeInTheDocument();
  });
});

describe('tab bar', () => {
  it('home is marked as the current tab', () => {
    renderApp('/');
    const tabs = screen.getByRole('navigation', { name: 'Main' });
    expect(within(tabs).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: 'EOD' })).not.toHaveAttribute('aria-current');
  });

  it('shows on the EOD and checklists screens, and not inside a task', () => {
    const { unmount } = renderApp('/close');
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'EOD' })).toHaveAttribute('aria-current', 'page');
    unmount();
    renderApp('/close/lunch');
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });
});

describe('home', () => {
  it('shows today\'s EOD and the trading day', () => {
    renderApp('/');
    expect(screen.getByText('Monday 5 October')).toBeInTheDocument();
    expect(screen.getByText('8 sections to go')).toBeInTheDocument();
    expect(screen.getByText('Start lunch')).toBeInTheDocument();
  });
});

describe('roles', () => {
  it('staff do checklists but not the EOD', () => {
    renderApp('/', staff);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('link', { name: 'EOD' })).not.toBeInTheDocument();
    expect(screen.queryByText("Today's EOD")).not.toBeInTheDocument();
    expect(screen.queryByText('End-of-day report')).not.toBeInTheDocument();
  });

  it('staff are sent home from the EOD screens', () => {
    renderApp('/close/lunch', staff);
    expect(screen.queryByLabelText('Gross sales')).not.toBeInTheDocument();
    expect(screen.getByText('Monday 5 October')).toBeInTheDocument();
  });

  it('only head office sees all sites', () => {
    renderApp('/head-office');
    expect(screen.queryByRole('table', { name: 'Sites' })).not.toBeInTheDocument();
  });
});

describe('lunch', () => {
  it('works out net sales as the manager types (discounts subtracted)', async () => {
    const { user } = renderApp('/close/lunch');
    await user.type(screen.getByLabelText('Gross sales'), '£1,200.00');
    await user.type(screen.getByLabelText('Service charge'), '120');
    await user.type(screen.getByLabelText('VAT'), '180');
    await user.type(screen.getByLabelText('Discounts & comps'), '50');
    expect(screen.getByTestId('net')).toHaveTextContent('£850.00');
  });

  it('editing a filled field replaces the figure instead of adding to "£180.00"', async () => {
    const { user } = renderApp('/close/lunch');
    const vat = screen.getByLabelText('VAT');
    await user.type(vat, '180');
    await user.tab();
    expect(vat).toHaveValue('£180.00');
    await user.click(vat);
    expect(vat).toHaveValue('180');
    await user.clear(vat);
    await user.type(vat, '175.5');
    await user.tab();
    expect(vat).toHaveValue('£175.50');
  });

  it('flags food and drink that don\'t add up, until confirmed', async () => {
    const { user } = renderApp('/close/lunch');
    await user.type(screen.getByLabelText('Gross sales'), '1000');
    await user.type(screen.getByLabelText('Food'), '600');
    await user.type(screen.getByLabelText('Drink'), '300');
    expect(screen.getByText('£100.00 under net')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "It's right" }));
    expect(screen.getByText('Confirmed by you')).toBeInTheDocument();
  });

  it('asks for a reason when cash is out by more than £1', async () => {
    const { user } = renderApp('/close/lunch');
    await user.type(screen.getByLabelText('Till says'), '20');
    // Nothing counted: £0 − £150 float − £20 till = £170 short.
    expect(screen.getByTestId('cash-status')).toHaveTextContent('£170.00 short');
    expect(screen.getByText('Needed to submit')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Miscount, recounted' }));
    expect(screen.getByRole('button', { name: 'Miscount, recounted' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Needed to submit')).not.toBeInTheDocument();
  });

  it('adds a discount line and shows what is still to list', async () => {
    const { user } = renderApp('/close/lunch');
    await user.type(screen.getByLabelText('Discounts & comps'), '50');
    await user.click(screen.getByRole('button', { name: 'Add discount, comp or void' }));
    await user.click(screen.getByRole('button', { name: 'Staff meal 20%' }));
    await user.type(screen.getByLabelText('Line amount'), '9.40');
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    expect(screen.getByText('£40.60 still to list')).toBeInTheDocument();
  });

  it('saving marks the section done on the hub', async () => {
    const { user } = renderApp('/close/lunch');
    await user.type(screen.getByLabelText('Gross sales'), '100');
    await user.click(screen.getByRole('button', { name: 'Save lunch' }));
    expect(await screen.findByRole('heading', { name: "Today's EOD" })).toBeInTheDocument();
    expect(screen.getByText('1 of 8 sections done')).toBeInTheDocument();
  });
});

describe('cash count', () => {
  it('only lists the notes and coins that were added', async () => {
    const { user } = renderApp('/close/lunch/cash');
    expect(screen.queryByLabelText('Number of £50')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '£20' }));
    await user.type(screen.getByLabelText('Number of £20'), '10');
    await user.click(screen.getByRole('button', { name: '50p' }));
    await user.type(screen.getByLabelText('Number of 50p'), '4');
    expect(screen.getByLabelText('£202.00')).toBeInTheDocument();
    expect(screen.getByTestId('taken')).toHaveTextContent('£52.00 taken');
    expect(screen.queryByLabelText('Number of £50')).not.toBeInTheDocument();
  });

  it('removes a denomination left blank', async () => {
    const { user } = renderApp('/close/lunch/cash');
    await user.click(screen.getByRole('button', { name: '£5' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByLabelText('Number of £5')).not.toBeInTheDocument();
  });
});

describe('hub', () => {
  it('switching a service off skips its section', async () => {
    const { user } = renderApp('/close');
    await user.click(screen.getByRole('switch', { name: 'Lunch ran today' }));
    expect(screen.getByText("Didn't run today")).toBeInTheDocument();
    expect(screen.getByText('0 of 7 sections done')).toBeInTheDocument();
  });
});

describe('wages, delivery, notes', () => {
  it('wage % turns amber over 30%', async () => {
    await seedVerifiedDraft((d) => { d.wages.wageCost = null; d.completed.wages = false; });
    const { user } = renderApp('/close/wages');
    await user.type(screen.getByLabelText('Wage cost'), '850');
    expect(screen.getByTestId('wage-pct')).toHaveTextContent('31.6%');
    expect(screen.getByText('Between 30% and 35%')).toBeInTheDocument();
  });

  it('delivery uses each platform\'s share', async () => {
    const { user } = renderApp('/close/delivery');
    await user.type(screen.getByLabelText('Deliveroo gross'), '300');
    expect(screen.getByLabelText('£137.50')).toBeInTheDocument();
  });

  it('adds a handover note for the opener', async () => {
    const { user } = renderApp('/close/handover');
    await user.click(screen.getByRole('radio', { name: 'Stock' }));
    await user.type(screen.getByLabelText('Note'), 'Low on limes');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(screen.getByText('Low on limes')).toBeInTheDocument();
    expect(screen.getByText('1 note')).toBeInTheDocument();
  });
});

describe('review and submit', () => {
  it('shows the verified day total and wage %', async () => {
    await seedVerifiedDraft();
    renderApp('/close/review');
    expect(screen.getByTestId('day-total')).toHaveTextContent('£2,687.50');
    expect(screen.getByText('29.8%')).toBeInTheDocument();
  });

  it('keeps Submit off until the confirmation is ticked', async () => {
    await seedVerifiedDraft();
    const { user } = renderApp('/close/review');
    const submit = screen.getByRole('button', { name: 'Submit Monday · £2,687.50' });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    expect(submit).toBeEnabled();
  });

  it('an unexplained cash difference blocks submit, even when ticked', async () => {
    await seedVerifiedDraft((d) => { d.sessions.dinner.cash.tillCash = 40000; });
    const { user } = renderApp('/close/review');
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /Submit Monday/ })).toBeDisabled();
    expect(screen.getByText('Fix 1 issue to submit.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fix in Dinner' })).toBeInTheDocument();
  });

  it('submits, shows Day closed, and locks the day', async () => {
    await seedVerifiedDraft();
    const { user } = renderApp('/close/review');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Submit Monday · £2,687.50' }));
    expect(await screen.findByRole('heading', { name: 'Day closed' })).toBeInTheDocument();
    const saved = await deviceStore().get('BUN', '2026-10-05');
    expect(saved?.status).toBe('submitted');
    expect(saved?.official?.totalNet).toBe(268750);
  });
});

describe('Submit all on the EOD overview', () => {
  it('asks first, then submits and locks the day', async () => {
    await seedVerifiedDraft();
    const { user } = renderApp('/close');
    await user.click(screen.getByRole('button', { name: 'Submit all' }));
    const ask = screen.getByRole('alertdialog', { name: "Submit Monday's EOD?" });
    expect(ask).toHaveTextContent('£2,687.50 net');
    expect(ask).toHaveTextContent("Once submitted, it can't be edited.");
    // Escape backs out without sending.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect((await deviceStore().get('BUN', '2026-10-05'))?.status).not.toBe('submitted');

    await user.click(screen.getByRole('button', { name: 'Submit all' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('heading', { name: 'Day closed' })).toBeInTheDocument();
    const saved = await deviceStore().get('BUN', '2026-10-05');
    expect(saved?.status).toBe('submitted');
    expect(saved?.draft.confirmed).toBe(true);
  });

  it('stays greyed out until the sections are finished', async () => {
    await seedVerifiedDraft((d) => { d.completed.wages = false; });
    renderApp('/close');
    expect(screen.getByRole('button', { name: 'Submit all' })).toBeDisabled();
    expect(screen.getByText('Finish the sections, then submit here.')).toBeInTheDocument();
  });

  it('points to Review when something blocks it', async () => {
    await seedVerifiedDraft((d) => { d.sessions.dinner.cash.tillCash = 40000; });
    renderApp('/close');
    expect(screen.getByRole('button', { name: 'Submit all' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'See Review' })).toBeInTheDocument();
  });
});

describe('demo reset', () => {
  it("clears today's EOD, even once sent, and leaves other days alone", async () => {
    await seedVerifiedDraft((d) => { d.confirmed = true; });
    const other = await seedVerifiedDraft((d) => { d.businessDate = '2026-10-04'; });
    const { user } = renderApp('/close');
    await user.click(screen.getByRole('button', { name: 'Submit all' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('heading', { name: 'Day closed' })).toBeInTheDocument();

    resetDemoEod('BUN', '2026-10-05');
    expect(await deviceStore().get('BUN', '2026-10-05')).toBeNull();
    expect((await deviceStore().get('BUN', other.businessDate))?.draft.businessDate).toBe('2026-10-04');
  });
});

describe('head office', () => {
  it('lists submitted sites and approves clean closes', async () => {
    await seedVerifiedDraft((d) => { d.confirmed = true; });
    const { submitReport } = await import('@maginhawa/core');
    const { settingsFor } = await import('../app/lib/draft');
    const d = (await deviceStore().get('BUN', '2026-10-05'))!.draft;
    await submitReport(d, { store: deviceStore(), settings: settingsFor('BUN'), submittedBy: 'Jo' });

    const { user } = renderApp('/head-office', admin);
    const table = await screen.findByRole('table', { name: 'Sites' });
    const bunso = within(table).getByText('Bunso').closest('[role="row"]') as HTMLElement;
    expect(await within(bunso).findByText('£2,687.50')).toBeInTheDocument();
    expect(within(table).getByText('Mamasons Kentish Town').closest('[role="row"]')).toHaveTextContent('Not started');
    await user.click(screen.getByRole('button', { name: 'Approve 1 clean close' }));
    expect(await within(bunso).findByText('Approved')).toBeInTheDocument();
  });

  it('opens a restaurant\'s page from the sites table, and back', async () => {
    const { user } = renderApp('/head-office', admin);
    const table = await screen.findByRole('table', { name: 'Sites' });
    await user.click(within(table).getByRole('row', { name: 'Ramo: see trends' }));
    expect(await screen.findByRole('heading', { name: 'Ramo' })).toBeInTheDocument();
    // Tests run without example data, so there's no history to chart yet.
    expect(screen.getByText('Not enough history yet. Trends appear after a few days of closes.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Week' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /All sites/ }));
    expect(await screen.findByRole('heading', { name: 'All sites' })).toBeInTheDocument();
  });

  it('managers can\'t open a restaurant page', () => {
    renderApp('/head-office/ram');
    expect(screen.queryByRole('heading', { name: 'Ramo' })).not.toBeInTheDocument();
  });
});
