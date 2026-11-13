import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { admin, manager, renderApp, staff } from './harness';

// Trading day Monday 2026-10-05 (test/setup.ts). The example counts are dated from it: the last full
// count was Sun 27 Sep, the bar spot count is due every day, meat and fish on Mondays and Thursdays.

const BAR = ['Tanduay rum 70cl', "Gordon's gin 70cl", 'Jameson 70cl', 'Smirnoff 70cl', 'Prosecco DOC'];

async function countBar(user: ReturnType<typeof renderApp>['user'], figures: string[]) {
  await user.click(screen.getByRole('button', { name: 'Start count' }));
  for (let k = 0; k < BAR.length; k++) {
    const field = screen.getByRole('textbox', { name: `${BAR[k]}, bottles` });
    await user.clear(field);
    await user.type(field, figures[k]!);
    await user.click(screen.getByRole('button', { name: k === BAR.length - 1 ? 'Done with Bar' : `Next: ${BAR[k + 1]}` }));
  }
}

describe('stock: counting', () => {
  it('staff count the bar one item at a time and send it, without seeing money', async () => {
    const { user } = renderApp('/stock', staff);
    const hero = screen.getByRole('status');
    expect(hero).toHaveTextContent('Due today');
    expect(hero).toHaveTextContent('Bar spot count');
    await countBar(user, ['5.4', '7.6', '3.5', '6', '4']);

    // One area, so the last item goes straight to sending.
    expect(screen.getByRole('heading', { name: 'Ready to send?' })).toBeInTheDocument();
    expect(screen.getByText('5 of 5 counted')).toBeInTheDocument();
    expect(screen.queryByText(/Worth/)).not.toBeInTheDocument();
    // Prosecco is far below last time: a warning, never a block.
    expect(screen.getByText('Prosecco DOC: 4 bottles')).toBeInTheDocument();
    const send = screen.getByRole('button', { name: 'Send count' });
    expect(send).toBeEnabled();
    await user.click(screen.getByRole('button', { name: "Prosecco DOC is right" }));
    expect(screen.getByText('Everything is counted')).toBeInTheDocument();
    await user.click(send);

    // Straight to what's low. Anyone can send the order to the team.
    expect(screen.getByRole('status')).toHaveTextContent('5 items are low');
    expect(screen.getByRole('link', { name: "Order what's low" })).toHaveAttribute('href', '/stock/order/bibendum');
    await user.click(screen.getByRole('link', { name: 'Not now' }));
    await user.click(within(screen.getByRole('region', { name: 'Sent' })).getAllByRole('link', { name: /Bar spot count/ })[0]!);

    expect(screen.getByText(/sent at 22:00 by Sam/)).toBeInTheDocument();
    expect(screen.getByText('5 items counted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Correct/ })).not.toBeInTheDocument();
    expect(screen.getByText(/A supervisor or manager can correct a figure/)).toBeInTheDocument();
  });

  it('− and + step the figure; a big change shows one calm line; bad figures are explained', async () => {
    const { user } = renderApp('/stock', staff);
    await user.click(screen.getByRole('button', { name: 'Start count' }));
    const rum = screen.getByRole('textbox', { name: 'Tanduay rum 70cl, bottles' });
    await user.click(screen.getByRole('button', { name: 'One more' }));
    await user.click(screen.getByRole('button', { name: 'One more' }));
    expect(rum).toHaveValue('2');
    await user.click(screen.getByRole('button', { name: 'One less' }));
    expect(rum).toHaveValue('1');
    expect(screen.getByRole('status')).toHaveTextContent(/Last time it was [\d.]+\. Worth a second look\./);
    await user.clear(rum);
    await user.type(rum, '5.45');
    expect(screen.getByRole('alert')).toHaveTextContent('Up to one decimal place, like 5.4');
  });

  it('Enter moves on, and the next item starts empty', async () => {
    const { user } = renderApp('/stock', staff);
    await user.click(screen.getByRole('button', { name: 'Start count' }));
    await user.type(screen.getByRole('textbox', { name: 'Tanduay rum 70cl, bottles' }), '5.4{Enter}');
    const gin = screen.getByRole('textbox', { name: "Gordon's gin 70cl, bottles" });
    expect(gin).toHaveValue('');
    expect(gin).toHaveFocus();
    await user.type(gin, '7{Enter}');
    await user.click(screen.getByRole('button', { name: "Back to Gordon's gin 70cl" }));
    expect(screen.getByRole('textbox', { name: "Gordon's gin 70cl, bottles" })).toHaveValue('7');
  });

  it("can't send until everything is counted", async () => {
    const { user } = renderApp('/stock', staff);
    await user.click(screen.getByRole('button', { name: 'Start count' }));
    await user.type(screen.getByRole('textbox', { name: 'Tanduay rum 70cl, bottles' }), '5');
    for (let k = 1; k < BAR.length; k++) await user.click(screen.getByRole('button', { name: `Next: ${BAR[k]}` }));
    await user.click(screen.getByRole('button', { name: 'Done with Bar' }));
    expect(screen.getByRole('button', { name: 'Send count' })).toBeDisabled();
    expect(screen.getByText('Count the last 4 first')).toBeInTheDocument();
    expect(screen.getByText('4 not counted yet')).toBeInTheDocument();
  });

  it('a manager sees the value of a sent count and corrects a figure; the old one stays', async () => {
    const { user } = renderApp('/stock', manager);
    const sent = screen.getByRole('region', { name: 'Sent' });
    expect(within(sent).getAllByText(/£/).length).toBeGreaterThan(0);
    await user.click(within(sent).getByRole('link', { name: /Meat and fish/ }));
    expect(screen.getByText('Worth')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Correct Ribeye 8oz' }));
    const save = screen.getByRole('button', { name: 'Save correction' });
    await user.type(screen.getByRole('textbox', { name: 'Ribeye 8oz, right figure' }), '12');
    expect(save).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Why it needs correcting' }), 'Missed the tray at the back');
    await user.click(save);
    expect(screen.getByText(/12 portions · corrected from \d+ by Jo: “Missed the tray at the back”/)).toBeInTheDocument();
  });

  it('a full count lists its areas, next one first; it carries on where it left off', async () => {
    const { user } = renderApp('/stock', staff);
    await user.click(screen.getByRole('button', { name: /Full stocktake/ }));
    expect(screen.getByText('0 of 5 areas done')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Walk-in chiller');
    await user.click(screen.getByRole('link', { name: 'Start counting' }));
    await user.type(screen.getByRole('textbox', { name: 'Pork belly, kg' }), '12.5');
    await user.click(screen.getByRole('link', { name: 'Areas' }));
    expect(screen.getByRole('status')).toHaveTextContent('Carry on');
    expect(screen.getByRole('status')).toHaveTextContent('2 of 3 items left');
    await user.click(screen.getByRole('link', { name: 'Carry on counting' }));
    expect(screen.getByRole('textbox', { name: 'Chicken thigh 5kg, bags' })).toBeInTheDocument();
  });

  it('Stock is in More for everyone', () => {
    renderApp('/more', staff);
    expect(screen.getByRole('link', { name: /Stock/ })).toHaveAttribute('href', '/stock');
  });
});

describe('stock: head office', () => {
  it('sees stock on hand, a late site and the biggest changes', () => {
    renderApp('/head-office/stock', admin);
    expect(screen.getByRole('heading', { name: 'Stock' })).toBeInTheDocument();
    const sites = screen.getByRole('region', { name: 'Sites' });
    const belly = within(sites).getByText('Belly').closest('.li') as HTMLElement;
    expect(belly).toHaveTextContent(/Late · due Sun 27 Sept?/);
    expect(belly).toHaveTextContent(/Last full count Sun 30 Aug/);
    const bunso = within(sites).getByText('Bunso').closest('.li') as HTMLElement;
    expect(bunso).toHaveTextContent(/Sent Sun 27 Sept?/);
    const changes = screen.getByRole('region', { name: 'Biggest changes' });
    const ribeye = within(changes).getByText('Ribeye 8oz').closest('.li') as HTMLElement;
    expect(ribeye).toHaveTextContent('11 portions · last time 30');
    expect(ribeye).toHaveTextContent('Ask the site');
  });

  it('sets a missing cost on the item list', async () => {
    const { user } = renderApp('/head-office/stock/items', admin);
    expect(screen.getByText(/2 items have no cost yet/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Ube jam cost' }), '4.20');
    expect(screen.getByText(/1 item has no cost yet/)).toBeInTheDocument();
  });

  it("isn't open to anyone else", () => {
    renderApp('/head-office/stock', manager);
    expect(screen.queryByRole('heading', { name: 'Stock' })).not.toBeInTheDocument();
  });
});
