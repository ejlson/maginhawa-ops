/**
 * The managers' EOD with the report builder's approved version: figures, added inputs, blocking and submit.
 * Versions are approved with the real engine and put on the device, as demo mode does. Example figures only.
 */
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import {
  EOD_DEFINITION, VERIFIED_TEST_DAY, addFigure, approveDefinition, computeDayWith, connect, disconnect,
  saveDefinitionDraft, seedDefinitionRecord, submitDefinition, DEFAULT_SETTINGS, type ReportDefinition,
} from '@maginhawa/core';
import { setDemoDefinitions } from '../app/lib/definition';
import { deviceStore } from '../app/lib/store';
import { renderApp, seedVerifiedDraft } from './harness';
import { verifiedDraft } from '../../../packages/core/test/fixtures';

/** Approves a definition on the given day (it goes live the next day) and puts it on this device. */
function approveOnDevice(def: ReportDefinition, approvedOn = '2026-10-01') {
  const base = seedDefinitionRecord({ startsOn: '2026-09-01', by: 'Finance', at: '2026-09-01T09:00:00Z' });
  // The test day's expected figures, as the builder's "It's right, update" would set them.
  const now = computeDayWith(verifiedDraft(), DEFAULT_SETTINGS, { netSales: 250000 }, { ...base, versions: [{ ...base.versions[0]!, definition: def }] }).definition!.figures;
  const testDays = [{ ...VERIFIED_TEST_DAY, expect: Object.fromEntries(Object.keys(VERIFIED_TEST_DAY.expect).map((id) => [id, now[id]!])) }];
  let rec = saveDefinitionDraft(base, { definition: def, testDays, by: 'Ana', at: '2026-10-01T09:00:00Z' });
  rec = submitDefinition(rec, { summary: 'from the builder', by: 'Ana', at: '2026-10-01T09:00:00Z' });
  rec = approveDefinition(rec, { by: 'Ben', today: approvedOn, at: '2026-10-01T10:00:00Z' });
  setDemoDefinitions(rec);
  return rec;
}

const serviceChargeInNet = () => disconnect(disconnect(EOD_DEFINITION, 'Lunch service charge', 'lunchNet'), 'Dinner service charge', 'dinnerNet');
function cardFees() {
  let def = addFigure(EOD_DEFINITION, { id: 'pay.card', name: 'Card takings', kind: 'input', type: 'money', group: 'tips', required: true, help: 'From the card machine’s end-of-day slip' });
  def = addFigure(def, { id: 'cardFees', name: 'Card fees', kind: 'calc', type: 'money', formula: '[Card takings] × 1.75%' });
  def = addFigure(def, { id: 'netAfter', name: 'Net after card fees', kind: 'calc', type: 'money', formula: '[Day total net] − [Card fees]' });
  def = addFigure(def, { id: 'room.hire', name: 'Room hire', kind: 'input', type: 'money', group: 'events' });
  return connect(def, 'Net after card fees', 'email');
}

describe('the live EOD uses the approved version', () => {
  it('with no version on the device, the figures are today’s', async () => {
    setDemoDefinitions(null);
    await seedVerifiedDraft();
    renderApp('/close/review');
    expect(screen.getByTestId('day-total')).toHaveTextContent('£2,687.50');
  });

  it('a formula change shows on the review screen and in the submitted report', async () => {
    approveOnDevice(serviceChargeInNet());
    await seedVerifiedDraft();
    const { user } = renderApp('/close/review');
    expect(screen.getByTestId('day-total')).toHaveTextContent('£3,047.50');
    expect(screen.getByText(/^Wages 26\.3% · on track/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Send Monday · £3,047.50' }));
    await screen.findByRole('heading', { name: 'Day closed' });
    const saved = await deviceStore().get('BUN', '2026-10-05');
    expect(saved?.official?.totalNet).toBe(304750);
    expect(saved?.official?.calcVersion).toBe('definition-v2');
  });

  it('a version approved after the trading day isn’t used for it', async () => {
    approveOnDevice(serviceChargeInNet(), '2026-10-05'); // live from 6 Oct
    await seedVerifiedDraft();
    renderApp('/close/review');
    expect(screen.getByTestId('day-total')).toHaveTextContent('£2,687.50');
  });

  it('shows an added input in its section, with the hint finance wrote', async () => {
    approveOnDevice(cardFees());
    await seedVerifiedDraft();
    renderApp('/close/tips');
    const added = screen.getByRole('region', { name: 'Added by head office' });
    expect(within(added).getByText('Card takings')).toBeInTheDocument();
    expect(within(added).getByText('From the card machine’s end-of-day slip')).toBeInTheDocument();
  });

  it('an input in a section finance made up shows under Promotions & other', async () => {
    approveOnDevice(cardFees());
    await seedVerifiedDraft();
    renderApp('/close/promotions');
    expect(within(screen.getByRole('region', { name: 'Added by head office' })).getByText('Room hire')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Added by head office' })).getByText('Optional')).toBeInTheDocument();
  });

  it('a required added input stops sending until it’s filled in', async () => {
    approveOnDevice(cardFees());
    await seedVerifiedDraft();
    const { user } = renderApp('/close/review');
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /^Send Monday/ })).toBeDisabled();
    expect(screen.getByText('Card takings isn’t filled in')).toBeInTheDocument();
  });

  it('what the manager types works out the new figures, which show on review and are saved on submit', async () => {
    approveOnDevice(cardFees());
    await seedVerifiedDraft((d) => { d.extra = { 'pay.card': 290000 }; }); // £2,900 typed on the Tips screen
    const { user } = renderApp('/close/review');
    const figures = screen.getByRole('region', { name: 'Figures added by head office' });
    expect(within(figures).getByText('£50.75')).toBeInTheDocument();
    expect(within(figures).getByText('£2,636.75')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Send Monday · £2,687.50' }));
    await screen.findByRole('heading', { name: 'Day closed' });
    const saved = await deviceStore().get('BUN', '2026-10-05');
    expect(saved?.draft.extra).toEqual({ 'pay.card': 290000 });
    expect(saved?.official?.definition?.figures.netAfter).toBe(263675);
  });

  it('typing into an added input saves it on the report', async () => {
    approveOnDevice(cardFees());
    await seedVerifiedDraft();
    const { user } = renderApp('/close/tips');
    const box = within(screen.getByRole('region', { name: 'Added by head office' })).getByRole('textbox', { name: 'Card takings' });
    await user.click(box);
    await user.type(box, '2900');
    await user.tab();
    await new Promise((r) => setTimeout(r, 50));
    const saved = await deviceStore().get('BUN', '2026-10-05');
    expect(saved?.draft.extra?.['pay.card']).toBe(290000);
  });
});
