import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { admin, manager, renderApp, staff, supervisor } from './harness';
import { deviceChecklistStore } from '../app/lib/store';

// Trading day 2026-10-05 (test/setup.ts). The example food-safety records are dated relative to it.
const run = { key: '2026-10-05|opening|09:30', templateId: 'opening', businessDate: '2026-10-05', dueTime: '09:30' };
const runPath = '/checklists/' + encodeURIComponent(run.key);

async function finishedOpening() {
  await deviceChecklistStore().apply('BUN', [
    { kind: 'answer', run, checkpointId: 'walkin', value: 3.4, by: 'Maria S.', at: '2026-10-05T08:40:00Z' },
    { kind: 'answer', run, checkpointId: 'freezer', value: -1.9, by: 'Maria S.', at: '2026-10-05T08:41:00Z' },
    { kind: 'finish', run, by: 'Maria S.', at: '2026-10-05T08:42:00Z' },
  ]);
}

describe('1 · records you can trust', () => {
  it('a manager corrects a finished checklist; the old answer, who and why stay on it', async () => {
    await finishedOpening();
    const { user } = renderApp(runPath, manager);
    expect(screen.getByText(/Locked: a correction keeps the old answer/)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Correct Freezer' }));
    expect(screen.getByRole('heading', { name: 'The right answer' })).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save correction' });
    await user.type(screen.getByLabelText('Freezer'), '-19');
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText('Why it needs correcting'), 'Typed the decimal in the wrong place');
    await user.click(save);
    expect(await screen.findByText(/Corrected from −1.9°C by Jo · 22:00 · “Typed the decimal in the wrong place”/)).toBeInTheDocument();
  });

  it("staff can't correct: no link, and the address sends them back", async () => {
    await finishedOpening();
    renderApp(runPath, staff);
    expect(screen.getByText(/Locked: answers can't be changed/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Correct Freezer' })).not.toBeInTheDocument();
  });
});

describe('2 · records for an inspector', () => {
  it('a supervisor makes the pack for their own site, corrections included', async () => {
    await finishedOpening();
    await deviceChecklistStore().apply('BUN', [{ kind: 'correct', run, checkpointId: 'freezer', value: -19, reason: 'Typed it wrong', by: 'Jo', at: '' }]);
    const { user } = renderApp('/food-safety/records', supervisor);
    expect(screen.queryByRole('radiogroup', { name: 'Site' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Make records for Bunso' }));
    expect(screen.getByRole('heading', { name: 'Bunso' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print or save as PDF' })).toBeInTheDocument();
    const checks = await screen.findByRole('region', { name: /Temperatures and checks/ });
    expect(within(checks).getByText('Opening checks')).toBeInTheDocument();
    expect(within(checks).getByText(/Corrected from −1.9°C by Jo/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Allergen matrix/ })).toHaveTextContent('Pork adobo');
    expect(screen.getByRole('region', { name: /Complaints/ })).toHaveTextContent('Customer details are left out.');
  });

  it('a manager only ever gets their own site, whatever the link says', () => {
    renderApp('/food-safety/records/pack?site=GUA&from=2026-09-08&to=2026-10-05&s=allergens', manager);
    expect(screen.getByRole('heading', { name: 'Bunso' })).toBeInTheDocument();
  });

  it('head office picks any site', async () => {
    const { user } = renderApp('/food-safety/records', admin);
    await user.click(within(screen.getByRole('radiogroup', { name: 'Site' })).getByRole('radio', { name: 'Belly' }));
    await user.click(screen.getByRole('button', { name: 'Make records for Belly' }));
    expect(screen.getByRole('heading', { name: 'Belly' })).toBeInTheDocument();
  });

  it("staff don't see it and can't open it", () => {
    renderApp('/food-safety', staff);
    expect(screen.queryByText('Records for an inspector')).not.toBeInTheDocument();
    renderApp('/food-safety/records', staff);
    expect(screen.queryByRole('heading', { name: 'Records for an inspector' })).not.toBeInTheDocument();
  });
});

describe('the food-safety hub', () => {
  it('a manager sees what needs them, most urgent first', () => {
    renderApp('/food-safety', manager);
    const needs = screen.getByRole('heading', { name: 'Needs you' }).closest('section')!;
    expect(needs).toHaveTextContent('[Brand] coconut milk recall');
    expect(needs).toHaveTextContent('Probe 3 · bar failed calibration');
    expect(needs).toHaveTextContent('1 off work today');
    expect(needs).toHaveTextContent('Appeal deadline in 3 days');
    expect(needs).toHaveTextContent('Read the allergen matrix');
  });

  it('home links to it with the count', () => {
    renderApp('/', manager);
    const w = screen.getByRole('region', { name: 'Food safety' });
    // The count is the dot on the icon (W1), not a pill; the link reads it after the name.
    expect(within(w).getByRole('link', { name: /^Food safety, \d+ to do(, something failed)?$/ })).toHaveAttribute('href', '/food-safety');
    expect(w.querySelector('.wi .wdot')).not.toBeNull();
    expect(w.querySelector('.pill')).toBeNull();
  });
});

describe('3 · how long records are kept', () => {
  it('head office changes a keep period', async () => {
    const { user } = renderApp('/food-safety/keep', admin);
    const save = screen.getByRole('button', { name: 'Save keep periods' });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Temperatures and checks/ }));
    await user.click(screen.getByRole('radio', { name: '3 years' }));
    await user.click(save);
    expect(screen.getByRole('status')).toHaveTextContent(/nothing is cleared automatically/);
  });
});

describe('4 · allergens', () => {
  it('staff are asked to read a change, once', async () => {
    const { user } = renderApp('/food-safety/allergens', staff);
    await user.click(screen.getByRole('link', { name: /Pork adobo/ }));
    expect(screen.getByText('Added sulphites')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "I've read the change" }));
    expect(screen.getByRole('status')).toHaveTextContent("You've read version 2.");
  });

  it('a manager changes a dish: a reason is needed and the old version is kept', async () => {
    const { user } = renderApp('/food-safety/allergens/sinigang', manager);
    await user.click(screen.getByRole('button', { name: 'Change' }));
    await user.click(screen.getByRole('button', { name: 'Celery' }));
    expect(screen.getByRole('button', { name: 'Save version 2' })).toBeDisabled();
    await user.type(screen.getByLabelText('Why it changed'), 'Celery in the new stock');
    await user.click(screen.getByRole('button', { name: 'Save version 2' }));
    expect(screen.getByText('Added celery')).toBeInTheDocument();
    expect(screen.getByText('Dish added')).toBeInTheDocument();
  });
});

describe('5 · cooking and cooling', () => {
  it("below 75°C can't start cooling", async () => {
    const { user } = renderApp('/food-safety/cooking', staff);
    await user.type(screen.getByLabelText('Dish or batch'), 'Chicken adobo');
    await user.type(screen.getByLabelText('Core temperature'), '72');
    expect(screen.getByRole('alert')).toHaveTextContent(/Keep cooking/);
    await user.click(screen.getByRole('switch', { name: 'Cooling it for the fridge' }));
    expect(screen.getByRole('button', { name: 'Save and start cooling' })).toBeDisabled();
    await user.clear(screen.getByLabelText('Core temperature'));
    await user.type(screen.getByLabelText('Core temperature'), '76.4');
    await user.click(screen.getByRole('button', { name: 'Save and start cooling' }));
    expect(screen.getByText('90 min left')).toBeInTheDocument();
  });
});

describe('6 · probe calibration', () => {
  it('a failed reading takes the probe out of use', async () => {
    const { user } = renderApp('/food-safety/probes', staff);
    expect(screen.getByText('Not in use')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Iced water reading'), '2.4');
    await user.type(screen.getByLabelText('Boiling water reading'), '100');
    await user.click(screen.getByRole('button', { name: 'Save · failed' }));
    expect(screen.getByRole('status')).toHaveTextContent('Probe 2 · kitchen failed and is out of use');
  });

  it('readings below zero can be typed without a minus key, and Enter moves to the next reading', async () => {
    const { user } = renderApp('/food-safety/probes', staff);
    const ice = screen.getByLabelText('Iced water reading');
    await user.type(ice, '0.4');
    await user.click(screen.getByRole('button', { name: 'Below zero: Iced water reading' }));
    expect(ice).toHaveValue('-0.4');
    // Boiling water can't be below zero, so it has no ± button.
    expect(screen.queryByRole('button', { name: 'Below zero: Boiling water reading' })).not.toBeInTheDocument();
    await user.click(ice);
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Boiling water reading')).toHaveFocus();
  });
});

describe('7 · deliveries and recalls', () => {
  it('a recall is matched to what we received and the action recorded', async () => {
    const { user } = renderApp('/food-safety/deliveries', manager);
    expect(screen.getByText(/Matches Coconut milk 12 tins \(CM-4471\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Set aside, not used' }));
    expect(screen.getByText(/Set aside, not used · Jo/)).toBeInTheDocument();
  });

  it('a delivery records batch codes and warns about warm goods', async () => {
    const { user } = renderApp('/food-safety/deliveries/new', staff);
    await user.type(screen.getByLabelText('Chilled goods temperature'), '9');
    await user.type(screen.getByLabelText('Item 1'), 'Prawns');
    expect(screen.getByRole('alert')).toHaveTextContent('Chilled goods too warm: 9°C. Prawns has no batch code');
    await user.type(screen.getByLabelText('Batch code 1'), 'PR-88');
    await user.click(screen.getByRole('button', { name: 'Accept 1 item' }));
    expect(screen.getByText(/Prawns · PR-88/)).toBeInTheDocument();
  });
});

describe('8 · complaints', () => {
  it('needs what happened and what we did; contact only with their OK', async () => {
    const { user } = renderApp('/food-safety/complaints/new', supervisor);
    const send = screen.getByRole('button', { name: 'Send to head office' });
    expect(screen.queryByLabelText('Customer contact')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Undercooked' }));
    await user.type(screen.getByLabelText('Details'), 'Chicken pink in the middle');
    expect(send).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Replaced the dish' }));
    await user.click(send);
    expect(screen.getByText(/Undercooked ·/)).toBeInTheDocument();
  });

  it('staff are sent back', () => {
    renderApp('/food-safety/complaints', staff);
    expect(screen.queryByRole('heading', { name: 'Customer complaints' })).not.toBeInTheDocument();
  });
});

describe('9 · training and fitness to work', () => {
  it('managers see who is off and whose certificate needs action', () => {
    renderApp('/food-safety/people', manager);
    expect(screen.getByText('Rico D.')).toBeInTheDocument();
    expect(screen.getByText(/Food hygiene Level 2 expired/)).toBeInTheDocument();
    expect(screen.getByText('No food hygiene certificate yet')).toBeInTheDocument();
  });

  it('anyone answers before a shift; a yes keeps them off for 48 hours', async () => {
    const { user } = renderApp('/food-safety/fit-to-work', staff);
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('switch', { name: 'Still have symptoms' }));
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Please don't work today. You can come back from Wednesday/);
  });

  it("staff can't see others' health answers", () => {
    renderApp('/food-safety/people', staff);
    expect(screen.queryByText('Rico D.')).not.toBeInTheDocument();
  });
});

describe('10 · inspections and notices', () => {
  it('shows the rating and the open notice with days left', () => {
    renderApp('/food-safety/inspections', manager);
    expect(screen.getByText('Improvement notice')).toBeInTheDocument();
    expect(screen.getByText('19 days')).toBeInTheDocument();
  });
});

describe('11 · 4-weekly review', () => {
  it('finds repeat faults from the last week and signs off', async () => {
    for (const [date, temp] of [['2026-10-01', 9], ['2026-10-03', 9.5], ['2026-10-05', 8.4]] as const) {
      const r = { ...run, key: `${date}|opening|09:30`, businessDate: date };
      await deviceChecklistStore().apply('BUN', [{ kind: 'answer', run: r, checkpointId: 'walkin', value: temp, by: 'Maria S.', at: `${date}T08:40:00Z` }]);
    }
    const { user } = renderApp('/food-safety/review', manager);
    expect(await screen.findByText('Walk-in fridge')).toBeInTheDocument();
    expect(screen.getByText('3×')).toBeInTheDocument();
    const sign = screen.getByRole('button', { name: 'Sign off review' });
    for (const q of ['New dishes or suppliers', 'New staff', 'New or changed equipment']) {
      await user.click(within(screen.getByRole('radiogroup', { name: q })).getByRole('radio', { name: 'No' }));
    }
    await user.click(sign);
    expect(screen.queryByText('4-weekly review is due')).not.toBeInTheDocument();
  });
});
