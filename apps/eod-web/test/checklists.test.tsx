import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from './harness';
import { setNow } from '../app/lib/clock';
import { deviceChecklistStore } from '../app/lib/store';

const at = (iso: string) => setNow(new Date(iso));
const opening = '/checklists/' + encodeURIComponent('2026-10-05|opening|09:30');
const bar = '/checklists/' + encodeURIComponent('2026-10-05|bar|16:30');
const hot12 = '/checklists/' + encodeURIComponent('2026-10-05|hothold|12:00');

/** Lists finished earlier today (the store writes synchronously). */
function seedDone(...keys: string[]) {
  for (const key of keys) {
    const [, templateId, dueTime] = key.split('|');
    void deviceChecklistStore().apply('BUN', [{ kind: 'finish', run: { key, templateId: templateId!, businessDate: '2026-10-05', dueTime: dueTime! }, by: 'Sam', at: '2026-10-05T08:00:00Z' }]);
  }
}

describe('checklists are available all day, separate from the end-of-day report', () => {
  it('in the morning, home puts the late checklist first', () => {
    at('2026-10-05T09:00:00Z'); // 10:00 BST, opening was due 09:30
    renderApp('/');
    // The one Up next pill in the main card goes straight to the late list.
    const hero = document.querySelector<HTMLElement>('.hero')!;
    expect(within(hero).getByRole('link', { name: /^Do\ now:\ Opening\ checks,/ })).toHaveAttribute('href', opening);
    // The main card doesn't offer the EOD; the EOD stays one tap away in its own widget.
    expect(within(hero).queryByRole('link', { name: /Start (lunch|today's EOD)/ })).not.toBeInTheDocument();
    const eod = screen.getByRole('region', { name: 'End of day report' });
    expect(within(eod).getByRole('heading', { name: 'End of day report' }).querySelector('a')).toHaveAttribute('href', '/close');
    // Checklists makes it the one to do now, with how late it is, and the pill counts it.
    const lists = screen.getByRole('region', { name: 'Checklists' });
    expect(lists.querySelector('.wh')).toHaveTextContent(/^Checklists1 late$/);
    const first = within(lists).getByRole('link', { name: 'Do now: Opening checks, 30 min late' });
    expect(first).toHaveClass('ln');
    expect(first).toHaveTextContent(/^Opening checks30 min late/);
    expect(first).toHaveAttribute('href', opening);
  });

  it('during the day, before anything is due, the top card shows the next checklist', () => {
    at('2026-10-05T07:00:00Z'); // 08:00 BST
    renderApp('/');
    const hero = document.querySelector<HTMLElement>('.hero')!;
    const up = within(hero).getByRole('link', { name: /^Start:\ Opening\ checks,/ });
    expect(up).toHaveAttribute('href', opening);
    expect(up).toHaveTextContent('Up nextOpening checks · 09:30');
    // Nothing is late yet, so the Checklists header counts only what's done; its own Start goes to the same list.
    const lists = screen.getByRole('region', { name: 'Checklists' });
    expect(lists.querySelector('.wh')).toHaveTextContent(/^Checklists0 of 6 done$/);
    expect(within(lists).getByRole('link', { name: /^Start:\ Opening\ checks,/ })).toHaveAttribute('href', opening);
  });

  it('in the evening, the end-of-day report is the main button and checklists stay open', () => {
    renderApp('/'); // 22:00 BST
    // Up next is the EOD's next step.
    const hero = document.querySelector<HTMLElement>('.hero')!;
    expect(within(hero).getByRole('link', { name: /^Start\ lunch,/ })).toHaveAttribute('href', '/close/lunch');
    expect(within(hero).queryByRole('link', { name: /^(Do now|Start): / })).not.toBeInTheDocument();
    // The first list missed earlier is the one to do now in Checklists; the closing list still to come is Next due.
    const lists = screen.getByRole('region', { name: 'Checklists' });
    expect(within(lists).getByRole('link', { name: 'Do now: Opening checks, Missed' })).toHaveAttribute('href', opening);
    expect(lists.querySelector('.wh')).toHaveTextContent(/^Checklists5 missed$/);
    expect(lists).toHaveTextContent('Next due · Closing checks at 23:00');
    expect(within(lists).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/checklists', opening]);
  });

  it('the Checklists page ends with the Next checklist bar: how many are left, then the next one', () => {
    at('2026-10-05T07:00:00Z'); // 08:00 BST, nothing due yet
    renderApp('/checklists');
    const bar = screen.getByRole('region', { name: 'Next checklist' });
    expect(bar).toHaveClass('leftbar');
    expect(bar.querySelector('small')).toHaveTextContent(/^6 to do$/);
    expect(bar.querySelector('b')).toHaveTextContent(/^Next: Opening checks$/);
    const go = within(bar).getByRole('link', { name: /^Start: Opening checks,\s*Go$/ });
    expect(go).toHaveAttribute('href', opening);
    // The label is for screen readers; the button just says Go.
    expect(go.querySelector('.vh')).toHaveTextContent('Start: Opening checks,');
    // The old full-width button is gone.
    expect(screen.queryByRole('link', { name: /^Start:? Opening checks$/ })).not.toBeInTheDocument();
    expect(document.querySelectorAll('a.btn.b1')).toHaveLength(0);
    expect(document.querySelector('.foot .btn.b1')).toBeNull();
  });

  it('the Next checklist bar says Do now for a late list and counts what is late or missed', () => {
    at('2026-10-05T11:10:00Z'); // 12:10 BST: Hot holding 12:00 late, opening missed
    renderApp('/checklists');
    const bar = screen.getByRole('region', { name: 'Next checklist' });
    expect(bar.querySelector('small')).toHaveTextContent(/^6 to do · 2 late or missed$/);
    expect(bar.querySelector('b')).toHaveTextContent(/^Do now: Hot holding · 12:00$/);
    expect(within(bar).getByRole('link', { name: /^Do now: Hot holding · 12:00,\s*Go$/ }))
      .toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|hothold|12:00'));
  });

  it('on a wide screen, the split view uses the same Next checklist bar', () => {
    window.matchMedia = ((q: string) => ({ matches: /min-width/.test(q), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    try {
      at('2026-10-05T07:00:00Z');
      renderApp('/checklists');
      expect(document.querySelector('.split-body')).not.toBeNull();
      const bar = screen.getByRole('region', { name: 'Next checklist' });
      expect(bar.closest('.split-body')).not.toBeNull();
      expect(bar.querySelector('b')).toHaveTextContent(/^Next: Opening checks$/);
      expect(within(bar).getByRole('link', { name: /^Start: Opening checks,\s*Go$/ })).toHaveAttribute('href', opening);
      expect(document.querySelector('.split-body .btn.b1')).toBeNull();
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
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

describe('the temperature box', () => {
  /** The saved answer for a checkpoint on the opening list (the store writes synchronously). */
  const answer = (id: string) => Object.values(JSON.parse(localStorage.getItem('mgh.checklists.v2') ?? '{"answers":{}}').answers as Record<string, { runKey: string; checkpointId: string; value: unknown }>)
    .find((a) => a.runKey === '2026-10-05|opening|09:30' && a.checkpointId === id)?.value;

  it('a tap anywhere on the box but the sign focuses the field; a freezer starts below zero', async () => {
    at('2026-10-05T08:15:00Z'); // 09:15 BST
    const { user } = renderApp(opening);
    const input = screen.getByLabelText('Freezer');
    const box = input.closest<HTMLElement>('.tfield')!;
    const sign = screen.getByRole('button', { name: 'Below zero: Freezer' });
    expect(sign).toHaveAttribute('aria-pressed', 'true');
    expect(input).not.toHaveFocus();
    // The box itself, not the input.
    await user.click(box);
    expect(input).toHaveFocus();
    await user.keyboard('18');
    expect(input).toHaveValue('18');
    expect(answer('freezer')).toBe(-18);
    // The °C after the number focuses it too.
    await user.click(screen.getByLabelText('Walk-in fridge'));
    await user.click(box.querySelector<HTMLElement>('.tunit')!);
    expect(input).toHaveFocus();
    // The sign button still flips the sign, and isn't treated as a tap on the box.
    await user.click(sign);
    expect(sign).toHaveAttribute('aria-pressed', 'false');
    expect(input).toHaveValue('18');
    expect(answer('freezer')).toBe(18);
    await user.click(sign);
    expect(answer('freezer')).toBe(-18);
  });
});

describe('the end of a finished checklist', () => {
  /** Answers Hot holding's two required temperatures, so it can finish. */
  async function answerHotHolding(user: ReturnType<typeof renderApp>['user']) {
    await user.type(screen.getByLabelText('Pass'), '70');
    await user.type(screen.getByLabelText('Bain-marie'), '70');
  }

  it('while answers are missing, the disabled button stays and there is no What\'s next bar', async () => {
    at('2026-10-05T10:50:00Z'); // 11:50 BST
    const { user } = renderApp(hot12);
    expect(screen.getByRole('button', { name: '2 left to answer' })).toBeDisabled();
    expect(screen.getByText('Answers save as you go.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: "What's next" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Pass'), '70');
    expect(screen.getByRole('button', { name: '1 left to answer' })).toBeDisabled();
    expect(screen.queryByRole('region', { name: "What's next" })).not.toBeInTheDocument();
  });

  it('once it can finish, the What\'s next bar goes to the next list', async () => {
    at('2026-10-05T10:50:00Z'); // 11:50 BST
    seedDone('2026-10-05|opening|09:30', '2026-10-05|bar|16:30');
    const { user } = renderApp(hot12);
    await answerHotHolding(user);
    const next = screen.getByRole('region', { name: "What's next" });
    expect(next).toHaveClass('leftbar');
    expect(next.querySelector('small')).toHaveTextContent('Saved. Submit it with the others under the checklists.');
    expect(next.querySelector('b')).toHaveTextContent(/^Next: Hot holding · 15:00$/);
    expect(within(next).getByRole('link', { name: /^Next: Hot holding · 15:00,\s*Go$/ }))
      .toHaveAttribute('href', '/checklists/' + encodeURIComponent('2026-10-05|hothold|15:00'));
    // The old button and its foot are gone.
    expect(screen.queryByRole('button', { name: /left to answer/ })).not.toBeInTheDocument();
    expect(document.querySelector('.foot .btn.b1')).toBeNull();
  });

  it('with nothing else to do, What\'s next goes back to the checklists', async () => {
    at('2026-10-05T10:50:00Z');
    seedDone('2026-10-05|opening|09:30', '2026-10-05|bar|16:30', '2026-10-05|hothold|15:00', '2026-10-05|hothold|18:00', '2026-10-05|closing|23:00');
    const { user } = renderApp(hot12);
    await answerHotHolding(user);
    const next = screen.getByRole('region', { name: "What's next" });
    expect(next.querySelector('b')).toHaveTextContent(/^Back to checklists$/);
    expect(within(next).getByRole('link', { name: /^Back to checklists,\s*Go$/ })).toHaveAttribute('href', '/checklists');
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
