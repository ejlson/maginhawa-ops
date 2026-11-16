import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { admin, manager, renderApp, staff } from './harness';
import { setNow } from '../app/lib/clock';
import { demoOps } from '../app/lib/ops-demo';
import { demoStock } from '../app/lib/stock-demo';
import type { OpsData } from '../app/lib/ops';

// Trading day Monday 2026-10-05 (test/setup.ts). Example data is dated from it (app/lib/ops-demo.ts).

/** Saves the example data with a change, as if the app had already been used on this device. */
function seedOps(change: (d: OpsData) => void) {
  const d = demoOps('2026-10-05');
  change(d);
  localStorage.setItem('mgh.ops.v1', JSON.stringify(d));
}

/** The phone bar: its title and the step count on the right. */
const barTitle = () => document.querySelector('.navbar .title')?.textContent ?? '';
const barCount = () => document.querySelector('.navbar .eod-count')?.textContent ?? null;

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
    const send = screen.getByRole('button', { name: /^Send to the team · £/ });
    await user.click(screen.getByRole('button', { name: 'One more of Tanduay rum 70cl' }));
    await user.click(screen.getByRole('button', { name: /^Send to the team · £/ }));
    expect(send).toHaveTextContent('Sent'); // OW1: the button turns into a grey Sent
    expect(send).toBeDisabled();
    expect(screen.getByText("Sent to the team. They'll place it with Bibendum; tick it in when it arrives.")).toBeInTheDocument();
  });

  it('staff send an order to the team; a supervisor or above places it and ticks it off', async () => {
    const first = renderApp('/stock/order/wingyip', staff);
    await first.user.click(screen.getByRole('button', { name: 'One more of Jasmine rice 20kg' }));
    await first.user.click(screen.getByRole('button', { name: /^Send to the team · £/ }));
    expect(screen.getByText("Sent to the team. They'll place it with Wing Yip; tick it in when it arrives.")).toBeInTheDocument();
    first.unmount();

    const second = renderApp('/stock/order', staff);
    expect(screen.getByRole('region', { name: 'To place' })).toHaveTextContent('The team has these');
    expect(screen.queryByRole('button', { name: 'Placed with Wing Yip' })).not.toBeInTheDocument();
    second.unmount();

    const { user } = renderApp('/stock/order', manager);
    await user.click(screen.getByRole('button', { name: 'Placed with Wing Yip' }));
    expect(screen.queryByRole('region', { name: 'To place' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Deliveries to check in' })).toHaveTextContent('Wing Yip');
  });

  it('a delivery starts all ticked; tapping what didn\'t come makes a credit to chase', async () => {
    const { user } = renderApp('/stock/delivery/order-demo-1', staff);
    expect(screen.getByRole('status')).toHaveTextContent('Anything missing?');
    expect(screen.getByText('+8%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Chicken thigh 5kg/ }));
    expect(screen.getByText(/One bag missing · £19.00 credit to chase/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done · 1 missing' }));
    expect(screen.getByRole('status')).toHaveTextContent('Checked in');
  });

  it('an order (OW1) goes back to Stock and says when it arrives, with "before" only when the supplier says', () => {
    const first = renderApp('/stock/order/fresh', manager);
    expect(screen.getByRole('link', { name: /Stock/ })).toHaveAttribute('href', '/stock');
    expect(screen.getByRole('status')).toHaveTextContent(/Arrives tomorrow before 10:00/);
    first.unmount();
    renderApp('/stock/order/wingyip', manager);
    expect(screen.getByRole('status')).toHaveTextContent(/Arrives .+/);
    expect(screen.getByRole('status')).not.toHaveTextContent('before');
  });

  it('a delivery (OW2) prices per unit when the pack holds several, goes back to Stock, and marks what\'s missing', async () => {
    const { user } = renderApp('/stock/delivery/order-demo-1', staff);
    expect(screen.getByRole('link', { name: /Stock/ })).toHaveAttribute('href', '/stock');
    // Pork belly: a 5 kg box at £49.00 → £53.00 is £9.80 → £10.60 a kg.
    expect(screen.getByText('Invoice £10.60 a kg, was £9.80')).toBeInTheDocument();
    expect(screen.queryByText(/Stock goes up/)).not.toBeInTheDocument();
    const chicken = screen.getByRole('button', { name: /Chicken thigh 5kg/ });
    expect(chicken.querySelector('.dl-mark')).not.toHaveClass('miss');
    await user.click(chicken);
    expect(chicken).toHaveAttribute('aria-pressed', 'true');
    expect(chicken.querySelector('.dl-mark')).toHaveClass('miss');
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

  it('an item (RC3) says when it was last counted and what it costs a unit', () => {
    // Pork belly was last counted in the Thursday meat count; the bar was counted last night.
    const first = renderApp('/stock/item/pork', manager);
    expect(screen.getByRole('status')).toHaveTextContent(/Pork belly · .+ left \(counted Thu 1 Oct\)/);
    expect(screen.getByRole('region', { name: 'Buying it' })).toHaveTextContent('5 kg box · £9.80 a kg');
    first.unmount();
    const second = renderApp('/stock/item/rum', manager);
    expect(screen.getByRole('status')).toHaveTextContent('(counted yesterday)');
    second.unmount();
    // Counted today: move Bunso's bar count onto today.
    const stock = demoStock('2026-10-05');
    const bar = stock.counts.find((c) => c.siteCode === 'BUN' && c.planId === 'BUN-bar')!;
    bar.businessDate = '2026-10-05'; bar.startedAt = '2026-10-05T20:00:00Z'; bar.sentAt = '2026-10-05T20:30:00Z';
    localStorage.setItem('mgh.stock.v1', JSON.stringify(stock));
    renderApp('/stock/item/rum', manager);
    expect(screen.getByRole('status')).toHaveTextContent('(counted today)');
    expect(screen.getByRole('status')).not.toHaveTextContent('last count');
  });

  it('head office (OW4) can ask the supplier about any price, drops too, and sees dishes below target', () => {
    seedOps((d) => { d.targetGp = 90; }); // at 90% every pork dish is below target
    renderApp('/head-office/ordering', admin);
    const prices = screen.getByRole('region', { name: 'Price changes' });
    expect(within(prices).getAllByRole('button', { name: 'Ask supplier' })).toHaveLength(3);
    // Prosecco went down (case of 6, £42.60 → £40.50): per bottle, and Ask supplier is still there.
    expect(prices).toHaveTextContent(/Prosecco DOC · Bibendum.*£7\.10 → £6\.75 a bottle/);
    expect(prices).toHaveTextContent(/Pork belly · Fresh Direct.*£9\.80 → £10\.60 a kg/);
    // Pork belly is in adobo, lechon kawali and sisig.
    expect(within(prices).getByRole('link', { name: '3 dishes below target' })).toHaveAttribute('href', '/head-office/menu');
    expect(screen.getByText('Bought, ex VAT')).toBeInTheDocument();
    expect(screen.getByText('Credits to chase')).toBeInTheDocument();
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

  it('at a site: no back button, the site line, the title and the tab bar; accidents are under Records', () => {
    renderApp('/safety', staff);
    expect(document.querySelector('.navbar')).toBeNull();
    expect(document.querySelector('.site-line')).toHaveTextContent('Bunso · Mon 5 Oct');
    expect(screen.getByRole('heading', { name: 'Health and safety', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    const records = screen.getByRole('region', { name: 'Records' });
    expect(within(records).getByRole('heading', { name: 'Records' })).toBeInTheDocument();
    expect(within(records).getByRole('link', { name: /Report an accident/ })).toHaveAttribute('href', '/safety/accident');
    expect(screen.queryByRole('region', { name: 'Accidents' })).not.toBeInTheDocument();
  });

  it('the card says "Due by <day>", "Due tomorrow" or "Due today"', () => {
    // Monday: the weekly fire alarm test is due by Sunday.
    const mon = renderApp('/safety', staff);
    expect(screen.getByRole('status')).toHaveTextContent('Due by Sun 11 Oct · weekly');
    mon.unmount();

    localStorage.clear();
    setNow(new Date('2026-10-10T21:00:00Z')); // Saturday 22:00 BST
    const sat = renderApp('/safety', staff);
    expect(screen.getByRole('status')).toHaveTextContent('Due tomorrow · weekly');
    expect(screen.getByRole('status')).not.toHaveTextContent('Due by');
    sat.unmount();

    localStorage.clear();
    setNow(new Date('2026-10-11T21:00:00Z')); // Sunday 22:00 BST
    renderApp('/safety', staff);
    expect(screen.getByRole('status')).toHaveTextContent('Due today · weekly');
    expect(screen.getByRole('status')).not.toHaveTextContent('Due by');
  });

  it('a check has its name in the bar and the step on the right; the count goes once it\'s done', async () => {
    const { user } = renderApp('/safety/check/fire-alarm', staff);
    expect(barTitle()).toBe('Fire alarm test');
    expect(barCount()).toBe('1/2');
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    expect(barTitle()).toBe('Fire alarm test');
    expect(barCount()).toBe('2/2');
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    expect(barTitle()).toBe('Fire alarm test');
    expect(barCount()).toBeNull();
  });

  it('the accident report counts its four steps on the right', async () => {
    const { user } = renderApp('/safety/accident', staff);
    expect(barTitle()).toBe('Report an accident');
    expect(barCount()).toBe('1/4');
    await user.click(screen.getByRole('radio', { name: 'Guest' }));
    await user.type(screen.getByRole('textbox', { name: 'Their name' }), 'A guest');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(barTitle()).toBe('Report an accident');
    expect(barCount()).toBe('2/4');
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

  it('at a site: no back button, the site line, the title and the tab bar; Certificates is still there', () => {
    renderApp('/maintenance', staff);
    expect(document.querySelector('.navbar')).toBeNull();
    expect(document.querySelector('.site-line')).toHaveTextContent('Bunso · Mon 5 Oct');
    expect(screen.getByRole('heading', { name: 'Maintenance', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Equipment' })).getByText('Certificates')).toBeInTheDocument();
  });

  it('"Coming up" only adds the contractor when there is one', () => {
    seedOps((d) => { d.schedules.find((s) => s.id === 'BUN-extraction')!.contractor = ''; });
    renderApp('/maintenance', manager);
    const up = screen.getByRole('region', { name: 'Coming up' });
    const extraction = within(up).getByText('Extraction clean').closest('.li') as HTMLElement;
    expect(extraction.querySelector('small')).toHaveTextContent(/^Every 6 months$/);
    const pest = within(up).getByText('Pest control visit').closest('.li') as HTMLElement;
    expect(pest.querySelector('small')).toHaveTextContent(/^Every 2 months · Rentokil$/);
  });

  it('equipment that keeps breaking comes first, with its call-outs and a pill', () => {
    // The ice machine is last in the list until it keeps breaking too.
    seedOps((d) => {
      // A fourth, over 6 months ago, isn't counted.
      for (const date of ['2026-09-30', '2026-09-15', '2026-08-20', '2026-01-10']) d.callOuts.push({ equipmentId: 'BUN-ice', date, title: 'No ice', detail: 'Reset' });
    });
    renderApp('/maintenance', staff);
    const rows = within(screen.getByRole('region', { name: 'Equipment' })).getAllByRole('link');
    const names = rows.map((r) => r.querySelector('.tx > span')?.textContent);
    expect(names).toEqual(['Walk-in chiller', 'Ice machine', 'Combi oven', 'Dishwasher']);
    expect(rows[0]).toHaveTextContent('3 call-outs in 6 months');
    expect(within(rows[0]!).getByText('Keeps breaking')).toHaveClass('pill', 'p-warn');
    expect(rows[1]).toHaveTextContent('3 call-outs in 6 months');
    expect(within(rows[1]!).getByText('Keeps breaking')).toBeInTheDocument();
    // The rest show their make and no pill.
    expect(rows[2]).toHaveTextContent('Rational iCombi 6-1/1');
    expect(within(rows[2]!).queryByText('Keeps breaking')).not.toBeInTheDocument();
    expect(within(rows[3]!).queryByText('Keeps breaking')).not.toBeInTheDocument();
  });

  it('a piece of equipment has no bar title, and its keeps-breaking note is a warning', () => {
    renderApp('/maintenance/equipment/BUN-walkin', manager);
    expect(barTitle()).toBe('');
    expect(document.querySelector('.navbar .backbtn')).toHaveAttribute('href', '/maintenance');
    expect(screen.getByRole('note')).toHaveClass('banner', 'warn');
    expect(screen.getByRole('note')).toHaveTextContent(/call-outs in 6 months/);
    // The example equipment has no service schedule, so there's no visit to log.
    expect(screen.queryByRole('link', { name: 'Log a visit' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Report a fault' })).toHaveAttribute('href', '/report');
  });

  it('equipment with a schedule links to logging a visit, for those who can log one', () => {
    seedOps((d) => { d.schedules.find((s) => s.id === 'BUN-extraction')!.equipmentId = 'BUN-combi'; });
    const m = renderApp('/maintenance/equipment/BUN-combi', manager);
    expect(screen.getByRole('link', { name: 'Log a visit' })).toHaveAttribute('href', '/maintenance/visit/BUN-extraction');
    // Not keeping breaking: no warning.
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    m.unmount();

    renderApp('/maintenance/equipment/BUN-combi', staff);
    expect(screen.queryByRole('link', { name: 'Log a visit' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Report a fault' })).toBeInTheDocument();
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

  it('a recipe has its name in the bar and the step count on the right', async () => {
    const adobo = demoOps('2026-10-05').recipes.find((r) => r.id === 'adobo')!;
    const total = adobo.steps.length + 1;
    const { user } = renderApp('/recipes/adobo', staff);
    expect(barTitle()).toBe(adobo.name);
    expect(barCount()).toBe(`1/${total}`);
    await user.click(screen.getByRole('button', { name: 'Got everything · start' }));
    expect(barTitle()).toBe(adobo.name);
    expect(barCount()).toBe(`2/${total}`);
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
    // RC2: straight to that dish's allergen record.
    expect(within(screen.getByRole('region', { name: 'Allergen check' })).getByRole('link', { name: 'Fix the record' }))
      .toHaveAttribute('href', '/food-safety/allergens/sisig');
  });

  it('the menu (RC2) is a table of dishes; the card says why, and the rest are behind Show', async () => {
    const { user } = renderApp('/head-office/menu', admin);
    expect(document.querySelector('.ho-sentence')?.textContent).toMatch(/^\d+ dish(es are| is) below 70%(\.|, (all|it|\d+ of them) because [a-z].+\.)$/);
    const dishes = () => screen.getByRole('region', { name: 'Dishes' });
    const before = within(dishes()).getAllByRole('button', { pressed: false }).length;
    expect(within(dishes()).queryByText('On target')).not.toBeInTheDocument();
    await user.click(within(dishes()).getByRole('button', { name: /dishes on target.*Show/ }));
    expect(within(dishes()).queryByRole('button', { name: /dishes on target/ })).not.toBeInTheDocument();
    expect(within(dishes()).getAllByText('On target').length).toBeGreaterThan(0);
    expect(within(dishes()).getAllByRole('button', { pressed: false }).length).toBeGreaterThan(before);
  });
});

describe('records and exports', () => {
  it('starts from who is asking and logs each export', async () => {
    const { user } = renderApp('/head-office/records', admin);
    await user.click(screen.getByRole('radio', { name: /Accountant or HMRC/ }));
    expect(screen.getByRole('region', { name: "What's included" })).toHaveTextContent('6 years');
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('status')).toHaveTextContent('Exported 3 record types for all 8 sites, last 12 months');
    expect(screen.getByText(/Last export: Accountant or HMRC/)).toBeInTheDocument();
  });

  it('everything for one site needs one site picked; inspector has no site filter', async () => {
    const { user } = renderApp('/head-office/records', admin);
    expect(screen.queryByRole('radiogroup', { name: 'Sites' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Everything for one site/ }));
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
    expect(screen.getByText('Pick the site first.')).toBeInTheDocument();
    await user.click(within(screen.getByRole('radiogroup', { name: 'Which site' })).getByRole('radio', { name: 'Bunso' }));
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
  });

  it('Sites (EX1): all of them, or only the ones picked go in the file', async () => {
    // Catch what would be downloaded: download() hands a Blob to URL.createObjectURL.
    const files: Blob[] = [];
    const orig = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = vi.fn((b: Blob) => { files.push(b); return 'blob:test'; });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const read = (b: Blob) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsText(b); });
    try {
      const { user } = renderApp('/head-office/records', admin);
      await user.click(screen.getByRole('radio', { name: /Accountant or HMRC/ }));
      const sites = screen.getByRole('radiogroup', { name: 'Sites' });
      expect(within(sites).getByRole('radio', { name: 'All 8 sites' })).toHaveAttribute('aria-checked', 'true');
      expect(screen.queryByRole('group', { name: 'Which sites' })).not.toBeInTheDocument();
      expect(screen.getByText(/Downloads to this computer for now/)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Export' }));
      const all = await read(files[0]!);
      expect(all).toContain('Bunso');
      expect(all).toContain('Mamasons Kentish Town');

      await user.click(within(sites).getByRole('radio', { name: 'Pick sites' }));
      await user.click(within(screen.getByRole('group', { name: 'Which sites' })).getByRole('button', { name: 'Bunso' }));
      expect(within(screen.getByRole('group', { name: 'Which sites' })).getByRole('button', { name: 'Bunso' })).toHaveAttribute('aria-pressed', 'true');
      await user.click(screen.getByRole('button', { name: 'Export' }));
      const one = await read(files[1]!);
      expect(one).toContain('Bunso');
      expect(one).not.toContain('Mamasons Kentish Town');
    } finally {
      URL.createObjectURL = orig.create;
      URL.revokeObjectURL = orig.revoke;
      click.mockRestore();
    }
  });

  it('the inspector\'s button says Export too, and says what it opens', () => {
    renderApp('/head-office/records', admin);
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make the records pack' })).not.toBeInTheDocument();
    expect(screen.getByText('Opens the records pack for the inspector, ready to print.')).toBeInTheDocument();
  });

  it('staff and pay records say where they live', async () => {
    const { user } = renderApp('/head-office/records', admin);
    await user.click(screen.getByRole('radio', { name: /Staff and pay/ }));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('status')).toHaveTextContent(/payroll and rota tools/);
  });
});
