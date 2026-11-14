import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, seedVerifiedDraft, admin, staff } from './harness';
import { deviceStore, resetDemoEod } from '../app/lib/store';
import { setNow } from '../app/lib/clock';

describe('sign-in', () => {
  it('sends people who are not signed in to sign-in', async () => {
    renderApp('/close', null);
    expect(await screen.findByRole('heading', { name: 'End of day report' })).toBeInTheDocument();
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
  });

  it('signs a manager in and lands on the app home', async () => {
    const { user } = renderApp('/sign-in', null);
    await user.type(screen.getByPlaceholderText('e.g. Jo'), 'Sam');
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(await screen.findByRole('heading', { name: /, Sam$/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Start\ lunch,/ })).toHaveAttribute('href', '/close/lunch');
  });
});

describe('tab bar', () => {
  it('home is marked as the current tab', () => {
    renderApp('/');
    const tabs = screen.getByRole('navigation', { name: 'Main' });
    expect(within(tabs).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: 'EOD' })).not.toHaveAttribute('aria-current');
    expect(within(tabs).getAllByRole('link').map((l) => l.querySelector('.tab-l')?.textContent)).toEqual(['Today', 'EOD', 'Checklists', 'More']);
    expect(within(tabs).getByRole('link', { name: /^Checklists/ })).toHaveAttribute('href', '/checklists');
  });

  it('shows on the EOD and checklists screens, and not inside a task', () => {
    const { unmount } = renderApp('/close');
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'EOD' })).toHaveAttribute('aria-current', 'page');
    unmount();
    renderApp('/close/lunch');
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('every tab keeps its name for screen readers, though only the selected one shows it', () => {
    renderApp('/checklists');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const tabs = within(nav).getAllByRole('link');
    expect(tabs.map((t) => t.querySelector('.tab-l')?.textContent)).toEqual(['Today', 'EOD', 'Checklists', 'More']);
    for (const name of ['Today', 'EOD', 'Checklists', 'More']) {
      expect(within(nav).getByRole('link', { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    const on = tabs.filter((t) => t.classList.contains('on'));
    expect(on).toHaveLength(1);
    expect(on[0]).toHaveAccessibleName(/^Checklists/);
    expect(on[0]).toHaveAttribute('aria-current', 'page');
    expect(tabs.filter((t) => t.hasAttribute('aria-current'))).toEqual(on);
  });

  it('a red dot on Checklists means one is late or missed', () => {
    setNow(new Date('2026-10-05T09:00:00Z')); // 10:00 BST, opening was due 09:30
    const { unmount } = renderApp('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const dots = nav.querySelectorAll('.tab-dot');
    expect(dots).toHaveLength(1);
    expect(dots[0]!.closest('a')).toHaveAttribute('href', '/checklists');
    expect(dots[0]).toHaveAttribute('aria-hidden', 'true');
    // The dot doesn't change the tab's name.
    // The dot is said out loud too.
    expect(within(nav).getByRole('link', { name: /^Checklists/ })).toHaveAccessibleName('Checklists, 1 late or missed');
    unmount();

    setNow(new Date('2026-10-05T07:00:00Z')); // 08:00 BST, nothing due yet
    renderApp('/');
    expect(screen.getByRole('navigation', { name: 'Main' }).querySelector('.tab-dot')).toBeNull();
  });

  it('head office phone tabs keep their names too', () => {
    renderApp('/head-office', admin);
    const nav = screen.getByRole('navigation', { name: 'Head office' });
    const tabs = within(nav).getAllByRole('link');
    expect(tabs.map((t) => t.querySelector('.tab-l')?.textContent)).toEqual(['Today', 'Days', 'Reports', 'More']);
    for (const name of ['Today', 'Days', 'Reports', 'More']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(nav).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Today' })).toHaveClass('on');
  });
});

describe('home', () => {
  it('shows today\'s EOD and the trading day', () => {
    renderApp('/'); // 22:00 BST
    expect(screen.getByText(/^Monday 5 October( · dinner service)?$/)).toBeInTheDocument();
    expect(screen.getByText('EOD · 0 of 8 sections done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Start\ lunch,/ })).toHaveTextContent('Up nextLunch · from the till report');
  });
});

describe('roles', () => {
  it('staff do checklists but not the EOD', () => {
    renderApp('/', staff);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('link', { name: 'EOD' })).not.toBeInTheDocument();
    expect(screen.queryByText("Today's EOD")).not.toBeInTheDocument();
    expect(screen.queryByText("Tonight's report")).not.toBeInTheDocument();
  });

  it('staff are sent home from the EOD screens', () => {
    renderApp('/close/lunch', staff);
    expect(screen.queryByLabelText('Gross sales')).not.toBeInTheDocument();
    // They land on their own home (22:00 BST, so the date line names the service).
    expect(screen.getByRole('heading', { name: 'Hi Sam' })).toBeInTheDocument();
    expect(screen.getByText('Monday 5 October · dinner service')).toBeInTheDocument();
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
    expect(await screen.findByRole('heading', { name: 'End of day report' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '1 of 8 sections done' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Sales' }).querySelector('.cl-hd')).toHaveTextContent('Sales1 of 4 done');
    // No covers entered yet, so the card doesn't say "0 covers".
    expect(screen.getByText('Day net so far')).toBeInTheDocument();
    expect(screen.queryByText(/^0 covers/)).not.toBeInTheDocument();
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
    expect(screen.getByRole('img', { name: '0 of 7 sections done' })).toBeInTheDocument();
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
    const card = document.querySelector<HTMLElement>('.rv-card')!;
    expect(card).toHaveTextContent('Monday 5 Oct · day net');
    expect(card).toHaveTextContent('£2,687.50');
    expect(within(card).getByText(/^Wages 29\.8% · on track/)).toBeInTheDocument();
  });

  it('keeps Send off until the figures are ticked as right', async () => {
    await seedVerifiedDraft();
    const { user } = renderApp('/close/review');
    const send = screen.getByRole('button', { name: 'Send Monday · £2,687.50' });
    expect(send).toBeDisabled();
    expect(screen.getByText('Tick to say the figures are right')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'I confirm these figures match the till reports and the cash I counted' }));
    expect(send).toBeEnabled();
    expect(screen.getByText('Goes to head office straight away')).toBeInTheDocument();
  });

  it('an unexplained cash difference blocks submit, even when ticked', async () => {
    await seedVerifiedDraft((d) => { d.sessions.dinner.cash.tillCash = 40000; });
    const { user } = renderApp('/close/review');
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /^Send Monday/ })).toBeDisabled();
    expect(screen.getByText('Finish dinner first')).toBeInTheDocument();
    const checks = screen.getByRole('region', { name: 'Before you send' });
    expect(within(checks).getByRole('heading', { name: 'Before you send' })).toBeInTheDocument();
    expect(checks.querySelector('.hd')).toHaveTextContent('1 to finish');
    const row = checks.querySelector<HTMLElement>('.rv-check')!;
    expect(row.querySelector('small')).toHaveClass('t-bad');
    expect(row).toHaveTextContent('Add a reason to submit.');
    expect(within(row).getByRole('link', { name: /^Finish\s*Dinner$/ })).toHaveAttribute('href', '/close/dinner');
  });

  it('the card links each session to its section, and says when one didn\'t run', async () => {
    await seedVerifiedDraft((d) => { d.ran.lunch = false; d.sessions.dinner.booked = 40; d.sessions.dinner.walkins = 12; });
    renderApp('/close/review');
    expect(screen.getByRole('link', { name: 'End of day report' })).toHaveAttribute('href', '/close');
    expect(screen.getByRole('heading', { level: 1, name: 'Ready to send?' })).toBeInTheDocument();
    const strip = document.querySelector<HTMLElement>('.rv-strip')!;
    const links = within(strip).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/close/lunch', '/close/dinner', '/close/delivery']);
    expect(links[0]).toHaveTextContent("Didn't runLunch");
    expect(links[1]).toHaveTextContent(/^£[\d,]+\.\d\dDinner$/);
    expect(links[2]).toHaveTextContent(/^£[\d,]+\.\d\dDelivery$/);
    expect(document.querySelector('.rv-card')).toHaveTextContent(/· 52 covers/);
    // The old breakdown is gone; the figures are a tap away in End of day.
    expect(screen.queryByRole('heading', { name: 'The day' })).not.toBeInTheDocument();
  });

  it('on the verified example, the strip shows the session nets and the card the covers', async () => {
    await seedVerifiedDraft();
    renderApp('/close/review');
    const strip = document.querySelector<HTMLElement>('.rv-strip')!;
    expect(within(strip).getByRole('link', { name: /Lunch/ })).toHaveTextContent('£850.00');
    expect(document.querySelector('.rv-card')).toHaveTextContent('Wages 29.8% · on track · 105 covers');
  });

  it('with nothing to look at, it says All checked', async () => {
    await seedVerifiedDraft();
    renderApp('/close/review');
    const checks = screen.getByRole('region', { name: 'All checked' });
    expect(within(checks).getByRole('heading', { name: 'All checked' })).toBeInTheDocument();
    expect(checks).toHaveTextContent('Everything checks out');
    expect(within(checks).queryByRole('link')).not.toBeInTheDocument();
  });

  it('a warning gets a Check chip, and the wage line says close to target; it doesn\'t stop sending', async () => {
    await seedVerifiedDraft((d) => { d.wages.wageCost = 85000; }); // 31.6%, between 30% and 35%
    const { user } = renderApp('/close/review');
    const checks = screen.getByRole('region', { name: 'Before you send' });
    expect(checks.querySelector('.hd')).toHaveTextContent(/^Before you send1 to check$/);
    const row = checks.querySelector<HTMLElement>('.rv-check')!;
    expect(row).toHaveTextContent('Wages 31.6% of net');
    expect(row.querySelector('small')).toHaveClass('t-warn');
    expect(within(row).getByRole('link', { name: /^Check\s*Wages/ })).toHaveAttribute('href', '/close/wages');
    expect(document.querySelector('.rv-card')).toHaveTextContent('Wages 31.6% · close to target');
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /^Send Monday/ })).toBeEnabled();
  });

  it('wages over the red line say over target', async () => {
    await seedVerifiedDraft((d) => { d.wages.wageCost = 100000; });
    renderApp('/close/review');
    expect(document.querySelector('.rv-card')).toHaveTextContent(/Wages [\d.]+% · over target/);
  });

  it('with no wages entered, the card says so', async () => {
    await seedVerifiedDraft((d) => { d.wages.wageCost = null as unknown as number; d.completed.wages = false; });
    renderApp('/close/review');
    expect(document.querySelector('.rv-card')).toHaveTextContent('Wages not entered');
  });

  it('several things to finish: counted, each with a Finish chip, and the note says how many', async () => {
    await seedVerifiedDraft((d) => { d.completed.wages = false; d.sessions.dinner.cash.tillCash = 40000; });
    renderApp('/close/review');
    const checks = screen.getByRole('region', { name: 'Before you send' });
    expect(checks.querySelector('.hd')).toHaveTextContent('2 to finish');
    expect(within(checks).getByRole('link', { name: /^Finish\s*Wages/ })).toHaveAttribute('href', '/close/wages');
    expect(within(checks).getByRole('link', { name: /^Finish\s*Dinner$/ })).toHaveAttribute('href', '/close/dinner');
    expect(screen.getByText('Finish 2 things first')).toBeInTheDocument();
  });

  it('an explained cash difference is listed under Already explained, without a chip', async () => {
    await seedVerifiedDraft((d) => { d.sessions.dinner.cash.tillCash = 40000; d.sessions.dinner.cash.reason = 'Float error' as never; });
    renderApp('/close/review');
    const checks = screen.getByRole('region', { name: 'All checked' });
    expect(within(checks).getByRole('heading', { name: 'All checked' })).toBeInTheDocument();
    const ok = [...checks.querySelectorAll<HTMLElement>('.sub')].find((g) => g.textContent?.startsWith('Already explained'))!;
    expect(ok).toHaveTextContent('Reason: Float error');
    expect(within(ok).queryByRole('link')).not.toBeInTheDocument();
  });

  it('the card keeps tips and the cash difference in view, tips linking to Tips', async () => {
    await seedVerifiedDraft(); // tips go to tronc in the verified example
    renderApp('/close/review');
    const extra = document.querySelector<HTMLElement>('.rv-card .rv-extra')!;
    expect(extra).toHaveTextContent(/^Tips £228\.40 · to tronc · Cash difference £0\.00$/);
    expect(within(extra).getByRole('link', { name: 'Tips £228.40 · to tronc' })).toHaveAttribute('href', '/close/tips');
  });

  it('tips not going to tronc say only the amount', async () => {
    await seedVerifiedDraft((d) => { d.tips.toTronc = false; });
    renderApp('/close/review');
    const extra = document.querySelector<HTMLElement>('.rv-card .rv-extra')!;
    expect(within(extra).getByRole('link', { name: 'Tips £228.40' })).toHaveAttribute('href', '/close/tips');
    expect(extra).not.toHaveTextContent('tronc');
  });

  it('an unexplained cash difference shows its amount on the card', async () => {
    await seedVerifiedDraft((d) => { d.sessions.dinner.cash.tillCash = 40000; });
    renderApp('/close/review');
    const extra = document.querySelector<HTMLElement>('.rv-card .rv-extra')!;
    // The till now expects £400.00 for dinner, £52.00 more than the cash counted.
    expect(extra).toHaveTextContent(/Cash difference −£52\.00$/);
  });

  it('the Delivery cell says Didn\'t run when delivery is off', async () => {
    await seedVerifiedDraft((d) => { d.ran.delivery = false; });
    renderApp('/close/review');
    const strip = document.querySelector<HTMLElement>('.rv-strip')!;
    const delivery = within(strip).getByRole('link', { name: /Delivery$/ });
    expect(delivery).toHaveAttribute('href', '/close/delivery');
    expect(delivery).toHaveTextContent("Didn't runDelivery");
  });

  it('the tick reads as one plain sentence and sits in the footer by Send', async () => {
    await seedVerifiedDraft();
    renderApp('/close/review');
    const tick = screen.getByRole('checkbox', { name: 'I confirm these figures match the till reports and the cash I counted' });
    expect(tick).not.toBeChecked();
    expect(screen.queryByText(/counted\.$/)).not.toBeInTheDocument();
    expect(tick.closest('label')!.parentElement).toContainElement(screen.getByRole('button', { name: /^Send Monday/ }));
  });

  it('submits, shows Day closed, and locks the day', async () => {
    await seedVerifiedDraft();
    const { user } = renderApp('/close/review');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Send Monday · £2,687.50' }));
    const heading = await screen.findByRole('heading', { name: 'Day closed' });
    // Straight after sending, the one animated moment plays, with the day's key figures.
    expect(heading.closest('main')).toHaveClass('celebrate');
    expect(screen.getByText('29.8%')).toBeInTheDocument();
    const saved = await deviceStore().get('BUN', '2026-10-05');
    expect(saved?.status).toBe('submitted');
    expect(saved?.official?.totalNet).toBe(268750);
  });

  it('reopened later as a receipt, Day closed stays still', async () => {
    await seedVerifiedDraft();
    const { user } = renderApp('/close/review');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Send Monday · £2,687.50' }));
    await screen.findByRole('heading', { name: 'Day closed' });
    await user.click(screen.getByRole('link', { name: 'Done' }));
    renderApp('/close/done');
    const headings = await screen.findAllByRole('heading', { name: 'Day closed' });
    expect(headings.at(-1)!.closest('main')).not.toHaveClass('celebrate');
  });
});

describe('End of day overview (design P3)', () => {
  const head = (name: string) => screen.getByRole('region', { name }).querySelector('.cl-hd')!;
  const bar = () => screen.getByRole('region', { name: "What's left" });
  const card = () => document.querySelector<HTMLElement>('.close-card')!;
  /** The verified example with every section marked done, then any change. */
  const allDone = (change?: (d: Parameters<NonNullable<Parameters<typeof seedVerifiedDraft>[0]>>[0]) => void) => seedVerifiedDraft((d) => {
    d.completed = { lunch: true, dinner: true, delivery: true, promotions: true, wages: true, tips: true, feedback: true, handover: true };
    change?.(d);
  });

  it('a fresh day: site and date on top, the net card with a ring, three groups all to do, and Start lunch', () => {
    renderApp('/close'); // Monday 5 October, nothing entered
    expect(screen.getByRole('heading', { level: 1, name: 'End of day report' })).toBeInTheDocument();
    expect(screen.queryByText("Today's EOD")).not.toBeInTheDocument();
    // No top Nav: the site and the day sit in the top row, with the saved state.
    expect(screen.getByText('Bunso · Mon 5 Oct')).toBeInTheDocument();
    expect(screen.getByText('Not started')).toBeInTheDocument();
    expect(card()).toHaveAttribute('role', 'status');
    expect(card()).toHaveTextContent('Day net so far');
    expect(card()).toHaveTextContent('£0.00');
    expect(within(card()).getByRole('img', { name: '0 of 8 sections done' })).toHaveTextContent('0/8');
    expect(head('Sales')).toHaveTextContent(/^Sales4 to do$/);
    expect(head('Team')).toHaveTextContent('2 to do');
    expect(head('Wrap up')).toHaveTextContent('2 to do');
    // Each group lists its sections, in order, each opening the section.
    const rows = (g: string) => within(screen.getByRole('region', { name: g })).getAllByRole('link');
    expect(rows('Sales').map((l) => l.getAttribute('href'))).toEqual(['/close/lunch', '/close/dinner', '/close/delivery', '/close/promotions']);
    expect(rows('Team').map((l) => l.getAttribute('href'))).toEqual(['/close/wages', '/close/tips']);
    expect(rows('Wrap up').map((l) => l.getAttribute('href'))).toEqual(['/close/feedback', '/close/handover']);
    // Submit all stays under the groups; the toggles for what ran stay below.
    expect(screen.getByRole('button', { name: 'Submit all' })).toBeDisabled();
    expect(screen.getByRole('region', { name: 'What ran today' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Lunch ran today' })).toBeChecked();
    // The floating bar: everything left, and the first step.
    expect(bar()).toHaveTextContent('8 left · Lunch, Dinner, Delivery…');
    expect(bar()).toHaveTextContent('Next: start lunch');
    expect(within(bar()).getByRole('link', { name: /^Start lunch,\s*Go$/ })).toHaveAttribute('href', '/close/lunch');
    // The old Foot buttons are gone.
    expect(screen.queryByRole('link', { name: /^Review and (submit|send)/ })).not.toBeInTheDocument();
  });

  it('part way: group meta counts what is done, and the bar continues with the next unfinished section', async () => {
    // The verified example: lunch, dinner, delivery and wages done; promotions, tips and the wrap-up not yet.
    await seedVerifiedDraft();
    renderApp('/close');
    expect(head('Sales')).toHaveTextContent(/^Sales3 of 4 done$/);
    expect(head('Team')).toHaveTextContent(/^Team1 of 2 done$/);
    expect(head('Wrap up')).toHaveTextContent(/^Wrap up2 to do$/);
    expect(screen.getByRole('img', { name: '4 of 8 sections done' })).toHaveTextContent('4/8');
    expect(bar()).toHaveTextContent(/^4 left · Promotions[^·]*, Tips[^·]*, Feedback…/);
    // The Go link names the same action as the big line.
    const verb = /Next: (start|finish) promotions & other/.exec(bar().textContent ?? '')?.[1];
    expect(verb).toBeDefined();
    expect(within(bar()).getByRole('link', { name: new RegExp(`^${verb === 'start' ? 'Start' : 'Finish'} promotions & other,\\s*Go$`) })).toHaveAttribute('href', '/close/promotions');
    expect(within(bar()).queryByRole('link', { name: /^(Continue|Start) with / })).not.toBeInTheDocument();
    // Each row shows its amount; the card has the net so far and the wage line from the verified example.
    expect(within(screen.getByRole('region', { name: 'Sales' })).getAllByRole('link')[0]!.querySelector('.amt')).toHaveTextContent('£850.00');
    expect(card()).toHaveTextContent('Day net so far£2,687.50');
    expect(card()).toHaveTextContent('Wages so far 29.8%');
  });

  it('a session switched off is left out of its group count', async () => {
    await allDone((d) => { d.ran.delivery = false; d.completed.lunch = false; });
    renderApp('/close');
    expect(head('Sales')).toHaveTextContent(/^Sales2 of 3 done$/);
    expect(screen.getByRole('img', { name: '6 of 7 sections done' })).toBeInTheDocument();
    expect(bar()).toHaveTextContent(/^1 left · Lunch/);
    expect(within(bar()).getByRole('link', { name: /^Finish lunch,\s*Go$/ })).toHaveAttribute('href', '/close/lunch');
    // Lunch has the example's figures in it, so it's finish, not start.
    expect(bar()).toHaveTextContent('Next: finish lunch');
  });

  it('a group whose sessions all did not run says so', async () => {
    await allDone((d) => { d.ran = { lunch: false, dinner: false, delivery: false }; d.completed.promotions = false; });
    renderApp('/close');
    expect(head('Sales')).toHaveTextContent(/^Sales1 to do$/);
  });

  it('everything done: All done everywhere, and the bar says review and send', async () => {
    await allDone();
    renderApp('/close');
    for (const g of ['Sales', 'Team', 'Wrap up']) expect(head(g)).toHaveTextContent('All done');
    expect(screen.getByRole('img', { name: '8 of 8 sections done' })).toHaveTextContent('8/8');
    expect(card()).toHaveTextContent('Day net£2,687.50');
    expect(card()).not.toHaveTextContent('so far£');
    expect(bar()).toHaveTextContent('All 8 sections done');
    expect(bar()).toHaveTextContent('Next: review and send');
    expect(within(bar()).getByRole('link', { name: /^Review and send,\s*Go$/ })).toHaveAttribute('href', '/close/review');
  });

  it('once sent, the bar goes to today\'s report and Submit all goes', async () => {
    await seedVerifiedDraft((d) => { d.confirmed = true; });
    const first = renderApp('/close');
    await first.user.click(screen.getByRole('button', { name: 'Submit all' }));
    await first.user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('heading', { name: 'Day closed' });
    first.unmount();
    renderApp('/close');
    expect(await screen.findByText('Sent to head office')).toBeInTheDocument();
    expect(bar()).toHaveTextContent("See today's report");
    expect(within(bar()).getByRole('link', { name: /^See today's report,\s*Go$/ })).toHaveAttribute('href', '/close/done');
    expect(screen.queryByRole('button', { name: 'Submit all' })).not.toBeInTheDocument();
    expect(screen.getByText('Sent', { selector: '.close-saved' })).toBeInTheDocument();
  });
});

describe('pick up where you left off', () => {
  it('after time away, the overview offers the exact field and goes back to it', async () => {
    const { user } = renderApp('/close/lunch');
    await user.click(screen.getByRole('textbox', { name: 'Service charge' }));
    const key = Object.keys(localStorage).find((k) => k.startsWith('maginhawa.resume.'))!;
    const place = JSON.parse(localStorage.getItem(key)!);
    expect(place).toMatchObject({ section: 'lunch', field: 'Service charge' });
    // Ten minutes away.
    localStorage.setItem(key, JSON.stringify({ ...place, at: place.at - 10 * 60_000 }));
    renderApp('/close');
    expect(await screen.findByText('Lunch · Service charge')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Carry on with Lunch/ })[0]).toHaveAttribute('href', '/close/lunch?at=Service%20charge');
    // The What's left bar offers the same place.
    const bar = screen.getByRole('region', { name: "What's left" });
    expect(bar).toHaveTextContent('Next: carry on with lunch');
    expect(within(bar).getByRole('link', { name: /^Carry on with Lunch,\s*Go$/ })).toHaveAttribute('href', '/close/lunch?at=Service%20charge');
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
    await user.click(within(table).getByRole('row', { name: 'Guanabana: details' }));
    const panel = screen.getByRole('dialog', { name: 'Guanabana details' });
    expect(within(panel).getByText('Not started yet.')).toBeInTheDocument();
    await user.click(within(panel).getByRole('link', { name: "See Guanabana's trends" }));
    expect(await screen.findByRole('heading', { name: 'Guanabana' })).toBeInTheDocument();
    // Tests run without example data, so there's no history to chart yet.
    expect(screen.getByText('Not enough history yet. Trends appear after a few days of closes.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Week' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /All sites/ }));
    expect(await screen.findByRole('heading', { name: 'All sites' })).toBeInTheDocument();
  });

  it('managers can\'t open a restaurant page', () => {
    renderApp('/head-office/gua');
    expect(screen.queryByRole('heading', { name: 'Guanabana' })).not.toBeInTheDocument();
  });
});
