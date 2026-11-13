import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from './harness';
import { setNow } from '../app/lib/clock';

const at = (iso: string) => setNow(new Date(iso));
const opening = '/checklists/' + encodeURIComponent('2026-10-05|opening|09:30');
const bar = '/checklists/' + encodeURIComponent('2026-10-05|bar|16:30');

describe('checklists are available all day, separate from the end-of-day report', () => {
  it('in the morning, home puts the late checklist first', () => {
    at('2026-10-05T09:00:00Z'); // 10:00 BST, opening was due 09:30
    renderApp('/');
    expect(screen.getByRole('link', { name: 'Do now: Opening checks' })).toBeInTheDocument();
    // One button only; the EOD stays one tap away as a row.
    expect(screen.queryByRole('link', { name: "Start today's EOD" })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^End-of-day report/ })).toBeInTheDocument();
    // The top card shows it, once; it isn't repeated under Needs you.
    expect(screen.getByRole('link', { name: 'Next checklist: Opening checks, 30 min late' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Needs you' })).not.toBeInTheDocument();
  });

  it('during the day, before anything is due, the top card shows the next checklist', () => {
    at('2026-10-05T07:00:00Z'); // 08:00 BST
    renderApp('/');
    expect(screen.getByRole('link', { name: /^Next checklist: Opening checks/ })).toBeInTheDocument();
  });

  it('in the evening, the end-of-day report is the main button and checklists stay open', () => {
    renderApp('/'); // 22:00 BST
    expect(screen.getByRole('link', { name: "Start today's EOD" })).toHaveClass('b1');
    // Today groups checklists by part of the day. One list opens directly; several open the filtered list.
    expect(screen.getByRole('link', { name: /^To do ?Opening/ })).toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|opening|09:30'));
    expect(screen.getByRole('link', { name: /Mid-shift/ })).toHaveAttribute('href', '/checklists?phase=mid-shift');
    expect(screen.getByRole('link', { name: /^To do ?Closing/ })).toHaveTextContent('Closing checks · 23:00');
  });

  it('a phase opens the checklists filtered to it', () => {
    renderApp('/checklists?phase=mid-shift');
    expect(screen.getByRole('heading', { name: 'Mid-shift checklists' })).toBeInTheDocument();
    expect(screen.getByText('Bar opening')).toBeInTheDocument();
    expect(screen.queryByText('Opening checks')).not.toBeInTheDocument();
  });

  it('the checklists screen groups today\'s lists by time', () => {
    at('2026-10-05T10:45:00Z'); // 11:45 BST
    renderApp('/checklists');
    expect(screen.getByText('Missed', { selector: '.sl span' })).toBeInTheDocument();
    expect(screen.getByText('Hot holding · 12:00')).toBeInTheDocument();
    expect(screen.getByText('Due in 15 min')).toBeInTheDocument();
    expect(screen.getByText('Delivery check')).toBeInTheDocument();
  });
});

describe('doing a checklist', () => {
  it('a failed temperature blocks finishing until it is fixed, then sets a re-check', async () => {
    at('2026-10-05T08:15:00Z'); // 09:15 BST
    const { user } = renderApp(opening);
    await user.type(screen.getByLabelText('Walk-in fridge'), '9.2');
    expect(screen.getByText('Too warm: 9.2°C')).toBeInTheDocument();
    // A failure comes first: it has to be dealt with whatever else is left.
    expect(screen.getByRole('button', { name: 'Fix walk-in fridge, then 6 left' })).toBeDisabled();

    await user.type(screen.getByLabelText('Reach-in fridge 1'), '4');
    await user.type(screen.getByLabelText('Freezer'), '-19');
    for (const name of ['Door seals clean, no gaps', 'Food covered and labelled', 'Hand-wash basins stocked', 'Probe thermometer cleaned and working']) {
      await user.click(within(screen.getByRole('radiogroup', { name })).getByRole('button', { name: 'Yes' }));
    }
    expect(screen.getByRole('button', { name: 'Fix walk-in fridge first' })).toBeDisabled();

    // The failure is dealt with in its own row: no separate page.
    const fixPanel = screen.getByRole('group', { name: 'Fix Walk-in fridge' });
    expect(within(fixPanel).getByRole('button', { name: 'Pick what you did' })).toBeDisabled();
    await user.click(within(fixPanel).getByRole('button', { name: 'Moved food to another fridge' }));
    // The re-check is already set (30 minutes); Change offers 15, 30 or 60.
    expect(fixPanel).toHaveTextContent('Check again at');
    await user.click(within(fixPanel).getByRole('button', { name: 'Change' }));
    await user.click(within(fixPanel).getByRole('button', { name: '30 min' }));
    expect(within(fixPanel).getByRole('switch', { name: 'Report a fault' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(fixPanel).getByRole('button', { name: 'Save what you did' }));

    expect(await screen.findByText(/Dealt with: moved food to another fridge/)).toBeInTheDocument();
    // Everything answered and dealt with: the card at the top becomes a finish card.
    expect(screen.getByText('All 7 checks done')).toBeInTheDocument();
    expect(screen.getByText('Problem fixed')).toBeInTheDocument();
    // Answers save as you go; nothing is locked from inside the list.
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    expect(screen.getByText('Saved. Submit it with the others under the checklists.')).toBeInTheDocument();
    await user.click(screen.getAllByRole('link', { name: 'Checklists' })[0]!);

    expect(await screen.findByRole('heading', { name: 'Ready to submit' })).toBeInTheDocument();
    expect(screen.getByText('Ready to submit', { selector: '.pill' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit all' }));
    // It asks first, because submitting locks the records.
    const ask = screen.getByRole('alertdialog', { name: 'Submit this checklist?' });
    expect(ask).toHaveTextContent("Once submitted, it can't be edited.");
    // Escape backs out without locking anything.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit all' }));
    expect(screen.queryByText('Completed · fixed')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Completed · fixed')).toBeInTheDocument();
    expect(screen.getByText('1 checklist submitted and locked.')).toBeInTheDocument();
    expect(screen.getByText('Re-check walk-in fridge')).toBeInTheDocument();
  });

  it('a manager\'s own list with different answer types', async () => {
    at('2026-10-05T15:20:00Z'); // 16:20 BST
    const { user } = renderApp(bar);
    await user.type(screen.getByLabelText('Float in the till'), '140');
    expect(screen.getByText('Too low: £140')).toBeInTheDocument();
    const garnish = screen.getByRole('group', { name: 'Garnishes prepped' });
    await user.click(within(garnish).getByRole('button', { name: 'Limes' }));
    await user.click(within(garnish).getByRole('button', { name: 'Calamansi' }));
    expect(within(garnish).getByRole('button', { name: 'Limes' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(garnish).getByRole('button', { name: 'Calamansi' })).toHaveAttribute('aria-pressed', 'true');
    await user.type(screen.getByLabelText('Open juice use-by date'), '2026-10-01');
    expect(screen.getByText('Date has passed')).toBeInTheDocument();
    expect(screen.getByLabelText('Take a photo: Photo of the bar top')).toBeInTheDocument();
  });

  it('answers are saved on the device as they are given', async () => {
    at('2026-10-05T08:15:00Z');
    const { user, unmount } = renderApp(opening);
    await user.type(screen.getByLabelText('Reach-in fridge 1'), '4.1');
    unmount();
    renderApp('/checklists');
    const row = screen.getByText('Opening checks').closest('a')!;
    expect(within(row).getByRole('img', { name: 'In progress' })).toBeInTheDocument();
  });
});

describe('changing your mind', () => {
  it('tapping the chosen answer again clears it', async () => {
    at('2026-10-05T08:15:00Z');
    const { user } = renderApp(opening);
    const seals = screen.getByRole('radiogroup', { name: 'Door seals clean, no gaps' });
    await user.click(within(seals).getByRole('button', { name: 'Yes' }));
    expect(within(seals).getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '6 left to answer' })).toBeInTheDocument();
    await user.click(within(seals).getByRole('button', { name: 'Yes' }));
    expect(within(seals).getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '7 left to answer' })).toBeInTheDocument();
  });
});

describe('old links', () => {
  it('the old Fix page address opens the list, where the fix panel is', () => {
    at('2026-10-05T08:15:00Z');
    renderApp(opening + '/fix/walkin');
    expect(screen.getByRole('radiogroup', { name: 'Door seals clean, no gaps' })).toBeInTheDocument();
  });
});
