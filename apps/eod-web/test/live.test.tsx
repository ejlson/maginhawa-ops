/**
 * Two people at one site on the same report or checklist, from different devices.
 * The screen under test is Jo's (the kitchen iPad); otherDevice('Sam') is Sam's phone.
 * The clock is 22:00 BST unless a test moves it.
 */
import { describe, expect, it } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { otherDevice, poke, renderApp, seedVerifiedDraft } from './harness';
import { setNow } from '../app/lib/clock';
import { deviceStore } from '../app/lib/store';

describe('end-of-day report on two devices', () => {
  it('shows the other person\'s changes within a poll, and says who made them', async () => {
    await seedVerifiedDraft();
    renderApp('/close');
    const sam = otherDevice('Sam');
    await act(async () => { await sam.eod.refresh(); await sam.eod.edit((d) => { d.wages.wageCost = 90000; }); });
    await poke();
    expect(screen.getByText('Sam changed Wages at 22:00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Wages/ })).toHaveTextContent('£900.00');
  });

  it('a clash names who changed the section, and the person picks', async () => {
    await seedVerifiedDraft();
    const { user } = renderApp('/close/dinner');
    const sam = otherDevice('Sam');
    await act(async () => { await sam.eod.refresh(); await sam.eod.edit((d) => { d.sessions.dinner.gross = 250000; }); });

    await user.clear(screen.getByLabelText('Gross sales'));
    await user.type(screen.getByLabelText('Gross sales'), '2600');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sam changed Dinner at 22:00');
    expect(alert).toHaveTextContent('You both changed it. Which figures should stay?');
    // Nothing is lost while Jo decides.
    expect((await deviceStore().get('BUN', '2026-10-05'))?.draft.sessions.dinner.gross).toBe(250000);

    await user.click(within(alert).getByRole('button', { name: "Use Sam's" }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Gross sales')).toHaveValue('£2,500.00');
  });

  it('keep mine saves this person\'s figure over the other', async () => {
    await seedVerifiedDraft();
    const { user } = renderApp('/close/dinner');
    const sam = otherDevice('Sam');
    await act(async () => { await sam.eod.refresh(); await sam.eod.edit((d) => { d.sessions.dinner.gross = 250000; }); });
    await user.clear(screen.getByLabelText('Gross sales'));
    await user.type(screen.getByLabelText('Gross sales'), '2600');
    await user.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Keep mine' }));
    expect((await deviceStore().get('BUN', '2026-10-05'))?.draft.sessions.dinner.gross).toBe(260000);
  });

  it('the second person to press Submit sees who sent it, with a link to the sent report', async () => {
    await seedVerifiedDraft();
    const { user } = renderApp('/close/review');
    await user.click(screen.getByRole('checkbox'));
    // Sam sends it from a phone first.
    const sam = otherDevice('Sam');
    setNow(new Date('2026-10-05T22:48:00Z'));
    await act(async () => { await sam.eod.refresh(); expect((await sam.eod.submit()).ok).toBe(true); });

    await user.click(screen.getByRole('button', { name: /^Send Monday/ }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Already sent by Sam at 23:48');
    expect(alert).toHaveTextContent('Nothing was sent twice.');
    await user.click(within(alert).getByRole('link', { name: 'See the sent report' }));
    expect(await screen.findByRole('heading', { name: 'Day closed' })).toBeInTheDocument();
    expect(screen.getByText(/Sent at 23:48 by Sam/)).toBeInTheDocument();
    expect(await deviceStore().listByDate('2026-10-05')).toHaveLength(1);
  });

  it('says who else is working on the report', async () => {
    await seedVerifiedDraft();
    renderApp('/close');
    const sam = otherDevice('Sam');
    sam.eod.setWhere('Dinner');
    await act(async () => { await sam.eod.refresh(); });
    await poke();
    expect(screen.getByText('Sam is in Dinner')).toBeInTheDocument();
  });
});

describe('checklists on two devices', () => {
  const opening = '/checklists/' + encodeURIComponent('2026-10-05|opening|09:30');
  const run = { key: '2026-10-05|opening|09:30', templateId: 'opening', businessDate: '2026-10-05', dueTime: '09:30' };

  it('shows answers given on another device, and who gave them', async () => {
    setNow(new Date('2026-10-05T08:15:00Z')); // 09:15 BST
    const { user } = renderApp(opening);
    await user.type(screen.getByLabelText('Freezer'), '-19');
    const sam = otherDevice('Sam');
    await act(async () => { await sam.checklists.answer(run, 'walkin', 3); });
    await poke();
    expect(screen.getByLabelText('Walk-in fridge')).toHaveValue('3');
    // Who and when share the grey line under the check's name.
    expect(screen.getByText(/· Sam 09:15$/)).toBeInTheDocument();
    // Freezer fields keep the sign on its own button, so the field shows 19 and the button shows −.
    expect(screen.getByLabelText('Freezer')).toHaveValue('19');
    expect(screen.getByRole('button', { name: 'Below zero: Freezer' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('submitting a list someone else already submitted leaves their name on it', async () => {
    setNow(new Date('2026-10-05T08:15:00Z'));
    const { user } = renderApp(opening);
    await user.type(screen.getByLabelText('Walk-in fridge'), '3');
    await user.type(screen.getByLabelText('Reach-in fridge 1'), '4');
    await user.type(screen.getByLabelText('Freezer'), '-19');
    for (const name of ['Door seals clean, no gaps', 'Food covered and labelled', 'Hand-wash basins stocked', 'Probe thermometer cleaned and working']) {
      await user.click(within(screen.getByRole('radiogroup', { name })).getByRole('button', { name: 'Yes' }));
    }
    // Sam submits on a phone; Jo's screen locks without Jo pressing anything.
    const sam = otherDevice('Sam');
    await act(async () => { expect((await sam.checklists.finish(run)).already).toBe(false); });
    await poke();
    expect(await screen.findByText(/Submitted at 09:15 by Sam/)).toBeInTheDocument();
  });
});
