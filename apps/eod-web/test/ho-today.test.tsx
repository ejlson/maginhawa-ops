/** Head office's Today, layout A (Nov 2026): Needs you, the Operations tiles, Trends, and the folded sidebar. */
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { perSite, SITES } from '@maginhawa/core';
import { renderApp, admin } from './harness';
import { opsToday } from '../app/lib/ho-today';
import { demoOps } from '../app/lib/ops-demo';
import { demoStock } from '../app/lib/stock-demo';

const TODAY = '2026-10-05';
/** The example data, every site's recipes and items, as head office's Today sees them. */
const demo = () => {
  const codes = SITES.map((s) => s.code);
  const ops = demoOps(TODAY);
  const stock = demoStock(TODAY);
  return { ops: { ...ops, recipes: perSite(ops.recipes, codes) }, stock: { ...stock, items: perSite(stock.items, codes) } };
};
/** A quiet group: everything serviced, fire tests done this week, counts sent, nothing to place, report or accept. */
const quiet = () => {
  const { ops, stock } = demo();
  ops.schedules = ops.schedules.map((s) => ({ ...s, lastDone: TODAY }));
  ops.priceChanges = [];
  ops.accidents = [];
  ops.targetGp = 0;
  ops.safetyChecks = SITES.map((s) => ({ id: `fire-${s.code}`, siteCode: s.code, kind: 'fire-alarm' as const, businessDate: TODAY, at: `${TODAY}T10:00:00Z`, by: 'Jo', answers: [] }));
  const bun = stock.counts.filter((c) => c.siteCode === 'BUN' && c.kind === 'full' && c.sentAt).sort((a, b) => b.businessDate.localeCompare(a.businessDate))[0]!;
  stock.counts.push({ ...structuredClone(bun), id: 'bel-full', siteCode: 'BEL', planId: 'BEL-full', businessDate: bun.businessDate });
  return { ops, stock };
};

describe('opsToday', () => {
  it('has the six Operations tiles in order, each linking to its screen', () => {
    const { ops, stock } = demo();
    const { tiles } = opsToday(ops, stock, TODAY);
    expect(tiles.map((t) => [t.name, t.to])).toEqual([
      ['Maintenance', '/head-office/maintenance'],
      ['Stock', '/head-office/stock'],
      ['Ordering', '/head-office/ordering'],
      ['Menu costing', '/head-office/menu'],
      ['Health & safety', '/head-office/safety'],
      ['Food safety', '/food-safety'],
    ]);
  });

  it('on the example data: overdue services, a late count, new prices and an accident to report', () => {
    const { ops, stock } = demo();
    const { tiles, needs, folded } = opsToday(ops, stock, TODAY);
    const tile = (key: string) => tiles.find((t) => t.key === key)!;
    // Three services are past their date (Belly's EICR, Kentish Town's extraction and extinguishers).
    expect(tile('maint')).toMatchObject({ big: '3', of: ' overdue', tone: 'bad' });
    expect(tile('stock')).toMatchObject({ label: '1 count late', tone: 'warn' });
    expect(tile('stock').big).toMatch(/^£\d+\.\dk$/);
    expect(tile('order')).toMatchObject({ big: '0', of: ' to place', label: '3 new prices', tone: 'warn' });
    expect(tile('hs')).toMatchObject({ of: ` / ${SITES.length}`, label: '1 to report', tone: 'bad' });
    expect(tile('food')).toMatchObject({ big: String(SITES.length), of: ' sites', label: 'Checks and records' });
    expect(tile('food').tone).toBeUndefined();
    expect(folded).toBe(tiles.filter((t) => t.tone).length);

    // The two oldest overdue services, oldest first, then one line for the rest, so the list matches the tile.
    expect(needs.map((n) => [n.key, n.title, n.level])).toEqual([
      ['svc-BEL-electrics', 'Belly · Fixed electrics (EICR)', 'bad'],
      ['svc-MKT-extraction', 'Mamasons Kentish Town · Extraction clean', 'bad'],
      ['svc-more', '1 more service overdue', 'bad'],
      ['stock-late', '1 stock count late', 'warn'],
      ['ordering', '3 new prices to accept', 'warn'],
      ['hse-acc-mkt', 'Mamasons Kentish Town · report to the HSE', 'bad'],
    ]);
    expect(needs[0]!.sub).toMatch(/^Overdue, was due /);
    expect(needs.find((n) => n.key === 'stock-late')).toMatchObject({ sub: 'Belly', to: '/head-office/stock', act: 'See' });
    expect(needs.find((n) => n.key === 'ordering')).toMatchObject({ sub: 'From suppliers', to: '/head-office/ordering' });
    expect(needs.find((n) => n.key === 'hse-acc-mkt')).toMatchObject({ sub: 'Accident needs a RIDDOR report', to: '/head-office/safety' });
  });

  it('a quiet group: nothing needs you and no tile has a tone', () => {
    const { ops, stock } = quiet();
    const { tiles, needs, folded } = opsToday(ops, stock, TODAY);
    expect(needs).toEqual([]);
    expect(folded).toBe(0);
    expect(tiles.map((t) => t.label)).toEqual(['All in date', 'Counts in date', 'No new prices', 'All on target', 'Fire tests done', 'Checks and records']);
    expect(tiles.find((t) => t.key === 'hs')!.big).toBe(String(SITES.length));
    expect(tiles.find((t) => t.key === 'menu')).toMatchObject({ big: '0', of: ' dishes' });
  });

  it('services due within 30 days show as due soon, not overdue', () => {
    const { ops, stock } = quiet();
    // Every 12 months, last done 11 months and 2 weeks ago: due in about a fortnight.
    ops.schedules[0] = { ...ops.schedules[0]!, everyMonths: 12, lastDone: '2025-10-19' };
    const { tiles, needs } = opsToday(ops, stock, TODAY);
    expect(tiles[0]).toMatchObject({ big: '0', label: '1 due soon' });
    expect(tiles[0]!.tone).toBeUndefined();
    expect(needs).toEqual([]);
  });

  it('a count still being done is not late; one never started is', () => {
    const { ops, stock } = demo();
    const sent = stock.counts.find((c) => c.siteCode === 'BUN' && c.kind === 'full' && c.sentAt)!;
    stock.counts.push({ ...structuredClone(sent), id: 'bel-open', siteCode: 'BEL', planId: 'BEL-full', businessDate: TODAY, sentAt: null, sentBy: null });
    const { tiles, needs } = opsToday(ops, stock, TODAY);
    expect(needs.find((n) => n.key === 'stock-late')).toBeUndefined();
    expect(tiles[1]).toMatchObject({ label: 'Counts in date' });
  });

  it('two late counts name both sites', () => {
    const { ops, stock } = demo();
    stock.counts = stock.counts.filter((c) => !(c.siteCode === 'GUA' && c.kind === 'full' && c.businessDate > '2026-09-01'));
    const late = opsToday(ops, stock, TODAY).needs.find((n) => n.key === 'stock-late')!;
    expect(late.title).toBe('2 stock counts late');
    expect(late.sub).toBe('Guanabana and Belly');
  });

  it('orders sent but not placed: counted, and the sites named once each', () => {
    const { ops, stock } = quiet();
    const base = demo().ops.orders[0]!; // placed already: not counted
    ops.orders = [
      base,
      { ...base, id: 'o2', siteCode: 'GUA', placedAt: null, placedBy: null },
      { ...base, id: 'o3', siteCode: 'GUA', supplierId: 'wingyip', placedAt: null, placedBy: null },
      { ...base, id: 'o4', siteCode: 'BUN', sentAt: null, placedAt: null, placedBy: null }, // not sent yet
    ];
    ops.priceChanges = [{ ...demo().ops.priceChanges[0]!, status: 'open' }, { ...demo().ops.priceChanges[1]!, status: 'accepted' }];
    const { tiles, needs } = opsToday(ops, stock, TODAY);
    expect(tiles[2]).toMatchObject({ big: '2', label: '1 new price', tone: 'warn' });
    expect(needs).toEqual([expect.objectContaining({ key: 'ordering', title: '2 orders to place · 1 new price to accept', sub: 'Guanabana' })]);
  });

  it('orders to place with no new prices: in Needs you, the tile has no tone', () => {
    const { ops, stock } = quiet();
    ops.orders = [{ ...demo().ops.orders[0]!, placedAt: null, placedBy: null }];
    const { tiles, needs } = opsToday(ops, stock, TODAY);
    expect(tiles[2]).toMatchObject({ big: '1', label: 'No new prices' });
    expect(tiles[2]!.tone).toBeUndefined();
    expect(needs.map((n) => n.title)).toEqual(['1 order to place']);
  });

  it('an accident already reported to the HSE drops off', () => {
    const { ops, stock } = demo();
    ops.accidents = ops.accidents.map((a) => ({ ...a, hse: { at: `${TODAY}T09:00:00Z`, ref: 'RIDDOR-1' } }));
    const { tiles, needs } = opsToday(ops, stock, TODAY);
    expect(needs.some((n) => n.key.startsWith('hse-'))).toBe(false);
    // Fire tests from last week don't count this week: still a warning.
    expect(tiles[4]).toMatchObject({ label: 'Fire tests due', tone: 'warn' });
  });

  it('dishes below the target GP warn, one dish in the singular', () => {
    const { ops, stock } = quiet();
    ops.targetGp = 100; // nothing can make 100%
    const all = opsToday(ops, stock, TODAY).tiles[3]!;
    expect(all).toMatchObject({ big: String(ops.recipes.length), of: ' dishes', label: 'Below 100% GP', tone: 'warn' });
    ops.recipes = ops.recipes.slice(0, 1);
    expect(opsToday(ops, stock, TODAY).tiles[3]).toMatchObject({ big: '1', of: ' dish' });
  });

  it('small stock values show in pounds and pence', () => {
    const { ops, stock } = quiet();
    stock.counts = [];
    expect(opsToday(ops, stock, TODAY).tiles[1]!.big).toBe('£0.00');
  });
});

/** Tonight: Hoodwood sent back, the rest not started. */
const seedSentBack = async () => {
  const { seedVerifiedDraft } = await import('./harness');
  const { deviceStore } = await import('../app/lib/store');
  const { submitReport } = await import('@maginhawa/core');
  const { settingsFor } = await import('../app/lib/draft');
  const d = await seedVerifiedDraft((d) => { d.siteCode = 'HOO'; d.confirmed = true; });
  await submitReport(d, { store: deviceStore(), settings: settingsFor('HOO'), submittedBy: 'Jo' });
  await deviceStore().setStatus('HOO', TODAY, 'sent-back', { by: 'Ana' });
};
/** A desktop-sized screen, where head office has the sidebar. */
const wideScreen = () => {
  window.matchMedia = ((q: string) => ({ matches: /min-width/.test(q), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  return () => { delete (window as { matchMedia?: unknown }).matchMedia; };
};

describe('head office Today: Needs you', () => {
  /** Waits for tonight's closes to load (Hoodwood's row says Sent back). */
  const loaded = async () => {
    const table = await screen.findByRole('table', { name: 'Sites' });
    await within(within(table).getByRole('row', { name: 'Hoodwood: details' })).findByText('Sent back');
    return screen.getByRole('region', { name: 'Needs you' });
  };

  it('lists a sent-back close, and its button opens the site’s details', async () => {
    await seedSentBack();
    const { user } = renderApp('/head-office', admin);
    const needs = await loaded();
    // Every bad thing comes first, so the sent-back close may be under "Show more".
    const more = within(needs).queryByRole('button', { name: /^Show \d+ more$/ });
    if (more) await user.click(more);
    const view = within(needs).getByRole('button', { name: 'View: Hoodwood · sent back' });
    expect(within(needs).getByText('Waiting for the manager to fix and resend')).toBeInTheDocument();
    // Sites with no close yet are one line, last (they're often just not in yet).
    expect(within(needs).getByRole('button', { name: `View: ${SITES.length - 1} sites not started` })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Hoodwood details' })).not.toBeInTheDocument();
    await user.click(view);
    const panel = screen.getByRole('dialog', { name: 'Hoodwood details' });
    expect(within(panel).getByText(/^Sent back by Ana/)).toBeInTheDocument();
  });

  it('puts the bad first, shows a few, then Show N more; operations needs are links', async () => {
    await seedSentBack();
    const { user } = renderApp('/head-office', admin);
    const needs = await loaded();
    const total = Number(within(needs).getByText(/^\d+$/).textContent);
    // Hoodwood sent back, one line for the 7 not started, plus the example operations needs.
    expect(total).toBe(8);
    const items = () => within(needs).getAllByRole('listitem');
    // jsdom's window is 768px high: four before "Show more".
    expect(items()).toHaveLength(4);
    const more = within(needs).getByRole('button', { name: `Show ${total - 4} more` });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await user.click(more);
    expect(items()).toHaveLength(total);
    const levels = items().map((li) => (li.querySelector('.hot-ic.bad') ? 'bad' : 'warn'));
    expect(levels).toEqual([...levels].sort()); // every bad before any warn
    const titles = items().map((li) => li.querySelector('b')?.textContent);
    expect(titles.indexOf('Hoodwood · sent back')).toBe(levels.indexOf('warn')); // sent back leads the warnings
    expect(titles.at(-1)).toBe(`${SITES.length - 1} sites not started`); // not started last
    expect(within(needs).getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(needs).getByRole('link', { name: 'Open: Mamasons Kentish Town · report to the HSE' })).toHaveAttribute('href', '/head-office/safety');
    expect(within(needs).getByRole('link', { name: 'See: 1 stock count late' })).toHaveAttribute('href', '/head-office/stock');
    await user.click(within(needs).getByRole('button', { name: 'Show fewer' }));
    expect(items()).toHaveLength(4);
  });

  it('a taller window shows more before Show more', async () => {
    const h = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1200 });
    try {
      await seedSentBack();
      renderApp('/head-office', admin);
      const needs = await loaded();
      // All 8 fit, so there's no Show more.
      expect(within(needs).getAllByRole('listitem')).toHaveLength(8);
      expect(within(needs).queryByRole('button', { name: /^Show \d+ more$/ })).not.toBeInTheDocument();
    } finally { Object.defineProperty(window, 'innerHeight', { configurable: true, value: h }); }
  });
});

describe('head office Today: Operations', () => {
  it('folds away and stays folded next time', async () => {
    const first = renderApp('/head-office', admin);
    const ops = await screen.findByRole('region', { name: 'Operations' });
    const fold = within(ops).getByRole('button', { name: /Operations/ });
    expect(fold).toHaveAttribute('aria-expanded', 'true');
    expect(within(ops).getByText(/^\d+ need(s)? a look$/)).toBeInTheDocument();
    const maint = within(ops).getByRole('link', { name: /^Maintenance: / });
    expect(maint).toHaveAttribute('href', '/head-office/maintenance');
    expect(within(ops).getAllByRole('link')).toHaveLength(6);

    await first.user.click(fold);
    expect(fold).toHaveAttribute('aria-expanded', 'false');
    expect(within(ops).queryAllByRole('link')).toHaveLength(0);
    expect(localStorage.getItem('mgh.ho-today.ops-open.v1')).toBe('false');
    first.unmount();

    const again = renderApp('/head-office', admin);
    const ops2 = await screen.findByRole('region', { name: 'Operations' });
    const fold2 = within(ops2).getByRole('button', { name: /Operations/ });
    expect(fold2).toHaveAttribute('aria-expanded', 'false');
    await again.user.click(fold2);
    expect(fold2).toHaveAttribute('aria-expanded', 'true');
    expect(within(ops2).getAllByRole('link')).toHaveLength(6);
    expect(localStorage.getItem('mgh.ho-today.ops-open.v1')).toBe('true');
  });

  it('the old Set-up section is gone from Today', async () => {
    renderApp('/head-office', admin);
    await screen.findByRole('table', { name: 'Sites' });
    expect(screen.queryByRole('heading', { name: 'Set-up' })).not.toBeInTheDocument();
  });

  it('a manager’s My sites has no Needs you or Operations', async () => {
    const { manager } = await import('./harness');
    const { people } = await import('../app/lib/people');
    people.add({ name: 'Jo', role: 'manager', siteCode: 'BUN', otherSites: ['GUA'], email: 'jo@example.com', addedBy: 'Ana' });
    renderApp('/my-sites', manager);
    expect(await screen.findByRole('heading', { name: 'My sites', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Needs you' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Operations' })).not.toBeInTheDocument();
  });
});

describe('head office Today: Trends and forecast', () => {
  it('is hidden until the button opens it below the sites', async () => {
    const { user } = renderApp('/head-office', admin);
    await screen.findByRole('table', { name: 'Sites' });
    const btn = screen.getByRole('button', { name: /Trends and forecast/ });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('trends')).toBeNull();
    expect(screen.queryByText(/^Net sales ·/)).not.toBeInTheDocument();
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(btn).toHaveTextContent('Shown below the sites');
    expect(within(document.getElementById('trends')!).getByText(/^Net sales ·/)).toHaveTextContent('Net sales · all sites');
    await user.click(btn);
    expect(document.getElementById('trends')).toBeNull();
  });

  it('opens straight away from /head-office#trends', async () => {
    renderApp('/head-office#trends', admin);
    await screen.findByRole('table', { name: 'Sites' });
    expect(screen.getByRole('button', { name: /Trends and forecast/ })).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('trends')).not.toBeNull();
  });
});

describe('head office sidebar (layout A)', () => {
  it('Operations, Reports and Settings start folded; Operations shows how many need a look', async () => {
    const restore = wideScreen();
    try {
      renderApp('/head-office', admin);
      const side = await screen.findByRole('navigation', { name: 'Head office' });
      expect(within(side).getByRole('button', { name: /^Overview/ })).toHaveAttribute('aria-expanded', 'true');
      for (const name of [/^Reports/, /^Settings/]) expect(within(side).getByRole('button', { name })).toHaveAttribute('aria-expanded', 'false');
      const opsHead = within(side).getByRole('button', { name: /^Operations/ });
      expect(opsHead).toHaveAttribute('aria-expanded', 'false');
      // The count matches the tiles with a tone on Today.
      const n = Number(screen.getByRole('region', { name: 'Operations' }).querySelector('.hot-meta')!.textContent!.match(/^\d+/)![0]);
      expect(n).toBeGreaterThan(0);
      expect(opsHead.querySelector('.sgh-cnt')).toHaveTextContent(String(n));
      expect(within(side).queryByRole('link', { name: 'Stock' })).not.toBeInTheDocument();
    } finally { restore(); }
  });

  it('opening Operations hides the count; the choice is remembered under the new key', async () => {
    const restore = wideScreen();
    try {
      const { user } = renderApp('/head-office', admin);
      const side = await screen.findByRole('navigation', { name: 'Head office' });
      const opsHead = within(side).getByRole('button', { name: /^Operations/ });
      await user.click(opsHead);
      expect(opsHead).toHaveAttribute('aria-expanded', 'true');
      expect(opsHead.querySelector('.sgh-cnt')).toBeNull();
      expect(within(side).getByRole('link', { name: 'Stock' })).toHaveAttribute('href', '/head-office/stock');
      expect(JSON.parse(localStorage.getItem('mgh.ho-nav.folded.v2')!)).toEqual(['Reports', 'Settings']);
    } finally { restore(); }
  });

  it('expanding Settings shows Checklists and the food-safety record links', async () => {
    const restore = wideScreen();
    try {
      const { user } = renderApp('/head-office', admin);
      const side = await screen.findByRole('navigation', { name: 'Head office' });
      expect(within(side).queryByRole('link', { name: 'Checklists' })).not.toBeInTheDocument();
      await user.click(within(side).getByRole('button', { name: /^Settings/ }));
      expect(within(side).getByRole('link', { name: 'Checklists' })).toHaveAttribute('href', '/checklists/edit');
      expect(within(side).getByRole('link', { name: 'Records for an inspector' })).toHaveAttribute('href', '/food-safety/records');
      expect(within(side).getByRole('link', { name: 'How long we keep records' })).toHaveAttribute('href', '/food-safety/keep');
    } finally { restore(); }
  });

  it('an old v1 folded setting is ignored: the new defaults apply', async () => {
    localStorage.setItem('mgh.ho-nav.folded.v1', JSON.stringify([]));
    const restore = wideScreen();
    try {
      renderApp('/head-office', admin);
      const side = await screen.findByRole('navigation', { name: 'Head office' });
      expect(within(side).getByRole('button', { name: /^Settings/ })).toHaveAttribute('aria-expanded', 'false');
    } finally { restore(); }
  });
});

describe('head office More (phones)', () => {
  it('Settings has Checklists, Records for an inspector, and How long we keep records', () => {
    renderApp('/head-office/more', admin);
    expect(screen.getByRole('link', { name: /^Checklists/ })).toHaveAttribute('href', '/checklists/edit');
    expect(screen.getByRole('link', { name: /^Records for an inspector/ })).toHaveAttribute('href', '/food-safety/records');
    expect(screen.getByRole('link', { name: /^How long we keep records/ })).toHaveAttribute('href', '/food-safety/keep');
  });
});
