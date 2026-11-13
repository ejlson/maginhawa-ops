import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { admin, manager, renderApp, staff } from './harness';

// Trading day Monday 2026-10-05 (test/setup.ts). Example data is dated from it (app/lib/ops-demo.ts).

describe('ordering and waste', () => {
  it('a manager sends a count and orders what\'s low in two taps', async () => {
    const { user } = renderApp('/stock', manager);
    await user.click(screen.getByRole('button', { name: 'Start count' }));
    for (const [n, v] of [['Tanduay rum 70cl', '2'], ["Gordon's gin 70cl", '9'], ['Jameson 70cl', '4'], ['Smirnoff 70cl', '8'], ['Prosecco DOC', '19']] as const) {
      await user.type(screen.getByRole('textbox', { name: `${n}, bottles` }), `${v}{Enter}`);
    }
    await user.click(screen.getByRole('button', { name: 'Send count' }));
    expect(screen.getByRole('status')).toHaveTextContent(/items? (is|are) low/);
    await user.click(screen.getByRole('link', { name: "Order what's low" }));
    expect(screen.getByRole('region', { name: 'Order lines' })).toHaveTextContent('Tanduay rum 70cl');
    const send = screen.getByRole('button', { name: /^Send order · £/ });
    await user.click(screen.getByRole('button', { name: 'One more of Tanduay rum 70cl' }));
    await user.click(screen.getByRole('button', { name: /^Send order · £/ }));
    expect(send).not.toBeInTheDocument();
    expect(screen.getByText('Bibendum has it. Check it in when it arrives.')).toBeInTheDocument();
  });

  it('staff can see orders but not send one: the address sends them back', () => {
    renderApp('/stock/order/fresh', staff);
    expect(screen.queryByRole('button', { name: /^Send order/ })).not.toBeInTheDocument();
  });

  it('a delivery starts all ticked; tapping what didn\'t come makes a credit to chase', async () => {
    const { user } = renderApp('/stock/delivery/order-demo-1', staff);
    expect(screen.getByRole('status')).toHaveTextContent('Anything missing?');
    expect(screen.getByText('Price +8%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Chicken thigh 5kg/ }));
    expect(screen.getByText(/One bag missing · £19.00 credit to chase/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done · 1 missing' }));
    expect(screen.getByRole('status')).toHaveTextContent('Checked in');
  });

  it('waste starts with the usual amount and reason, so it\'s item then Log', async () => {
    const { user } = renderApp('/stock/waste', staff);
    await user.click(screen.getByRole('radio', { name: 'Pork belly' }));
    const log = screen.getByRole('button', { name: /^Log waste · £/ });
    await user.click(log);
    expect(screen.getByRole('status')).toHaveTextContent(/^Logged: .* of pork belly/);
  });

  it('an item shows the dishes it\'s in and how long it will last', () => {
    renderApp('/stock/item/pork', manager);
    const used = screen.getByRole('region', { name: 'Used in' });
    for (const d of ['Pork adobo', 'Lechon kawali', 'Sisig']) expect(within(used).getByText(d)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Runs out|Lasts about/);
    expect(screen.getByRole('link', { name: 'Order more' })).toHaveAttribute('href', '/stock/order/fresh');
  });

  it('head office accepts a new price; the dish costs move with it', async () => {
    const { user } = renderApp('/head-office/ordering', admin);
    expect(screen.getByText(/3 prices changed/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Accept Pork belly price' }));
    expect(screen.getByText(/2 prices changed/)).toBeInTheDocument();
  });
});

describe('health and safety', () => {
  it('a fire alarm test with a "No" raises an urgent repair', async () => {
    const { user } = renderApp('/safety', staff);
    expect(screen.getByRole('status')).toHaveTextContent('Fire alarm test');
    await user.click(screen.getByRole('link', { name: 'Start test' }));
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Urgent repair raised');
    renderApp('/repairs', manager);
    expect(screen.getAllByText('Fire alarm test failed').length).toBeGreaterThan(0);
  });

  it('anyone reports an accident in four steps', async () => {
    const { user } = renderApp('/safety/accident', staff);
    await user.click(screen.getByRole('radio', { name: 'Guest' }));
    await user.type(screen.getByRole('textbox', { name: 'Their name' }), 'A guest');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('radio', { name: 'Slip or trip' }));
    await user.type(screen.getByRole('textbox', { name: 'Where, and a few words' }), 'Wet floor by the bar');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('radio', { name: 'Leg or foot' }));
    await user.click(screen.getByRole('radio', { name: 'No' }));
    await user.click(screen.getByRole('button', { name: 'Check it' }));
    expect(screen.getByRole('status')).toHaveTextContent('Slip or trip · leg or foot');
    await user.click(screen.getByRole('button', { name: 'Send to manager' }));
    expect(screen.getByText(/Sent to your manager/)).toBeInTheDocument();
  });

  it('a manager records days off; more than 7 means an HSE report with a deadline', async () => {
    const { user } = renderApp('/safety', manager);
    const needs = screen.getByRole('region', { name: 'Needs you' });
    await user.type(within(needs).getByRole('textbox', { name: /Days off so far/ }), '9');
    await user.click(within(needs).getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('region', { name: 'Needs you' })).toHaveTextContent(/report to the HSE by/);
  });

  it('head office sees the accident Kentish Town must report', () => {
    renderApp('/head-office/safety', admin);
    const needs = screen.getByRole('region', { name: 'Needs head office' });
    expect(needs).toHaveTextContent('Kitchen porter: burn, arm');
    expect(needs).toHaveTextContent(/Report by/);
  });
});

describe('planned maintenance', () => {
  it('a manager logs the gas check with its certificate; saving needs both', async () => {
    const { user } = renderApp('/maintenance', manager);
    expect(screen.getByRole('status')).toHaveTextContent('Gas safety check');
    await user.click(screen.getByRole('link', { name: 'Log the visit' }));
    const save = screen.getByRole('button', { name: 'Save visit' });
    await user.click(screen.getByRole('radio', { name: 'Passed' }));
    expect(save).toBeDisabled();
    await user.upload(screen.getByLabelText('Photo or PDF of the certificate'), new File(['x'], 'Gas safety record.pdf', { type: 'application/pdf' }));
    expect(screen.getByText('Gas safety record.pdf')).toBeInTheDocument();
    await user.click(save);
    expect(screen.getByRole('status')).not.toHaveTextContent('Gas safety check');
  });

  it('staff see maintenance but can\'t log a visit', () => {
    renderApp('/maintenance', staff);
    expect(screen.queryByRole('link', { name: 'Log the visit' })).not.toBeInTheDocument();
  });

  it('equipment that keeps breaking says so', () => {
    renderApp('/maintenance/equipment/BUN-walkin', manager);
    expect(screen.getByText(/call-outs in 6 months/)).toBeInTheDocument();
  });

  it('head office sees only what needs action, the rest folded away', async () => {
    const { user } = renderApp('/head-office/maintenance', admin);
    expect(screen.getByText(/3 certificates are overdue/)).toBeInTheDocument();
    const list = screen.getByRole('region', { name: 'Needs action' });
    expect(within(list).getAllByText('Overdue')).toHaveLength(3);
    await user.click(within(list).getByRole('button', { name: /more, all in date/ }));
    expect(within(list).queryByRole('button', { name: /more, all in date/ })).not.toBeInTheDocument();
  });
});

describe('recipes and menu costing', () => {
  it('the kitchen gets ready first, then one step at a time, with no prices', async () => {
    const { user } = renderApp('/recipes/adobo', staff);
    expect(screen.getByRole('region', { name: 'For one plate' })).toHaveTextContent('300 g');
    expect(screen.queryByText(/£/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got everything · start' }));
    expect(screen.getByText('Crisp the pork, skin side down.')).toBeInTheDocument();
  });

  it('head office sees dishes below target and fixes one with one button', async () => {
    const { user } = renderApp('/head-office/menu', admin);
    const below = screen.getByRole('region', { name: 'Dishes' });
    const before = within(below).getAllByRole('button').length;
    const fix = screen.getByRole('button', { name: /^Change price to £/ });
    await user.click(fix);
    expect(within(screen.getByRole('region', { name: 'Dishes' })).getAllByRole('button').length).toBe(before - 1);
  });

  it('flags an ingredient allergen the record doesn\'t list', () => {
    renderApp('/head-office/menu', admin);
    expect(screen.getByRole('region', { name: 'Allergen check' })).toHaveTextContent(/Sisig.*Mayonnaise 1kg contains eggs/);
  });
});

describe('records and exports', () => {
  it('starts from who is asking and logs each export', async () => {
    const { user } = renderApp('/head-office/records', admin);
    await user.click(screen.getByRole('radio', { name: /Accountant or HMRC/ }));
    expect(screen.getByRole('region', { name: "What's included" })).toHaveTextContent('6 years');
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('status')).toHaveTextContent('Exported 3 record types, last 12 months');
    expect(screen.getByText(/Last export: Accountant or HMRC/)).toBeInTheDocument();
  });

  it('staff and pay records say where they live', async () => {
    const { user } = renderApp('/head-office/records', admin);
    await user.click(screen.getByRole('radio', { name: /Staff and pay/ }));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('status')).toHaveTextContent(/payroll and rota tools/);
  });
});
