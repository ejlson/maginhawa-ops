import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, admin, staff } from './harness';

describe('site colours', () => {
  it('themes the app with the site you are in', () => {
    renderApp('/');
    expect(document.documentElement.style.getPropertyValue('--site')).toBe('#F59F00');
    expect(document.documentElement.style.getPropertyValue('--site-on')).toBe('#1D1D1F');
  });

  it('on a phone (P7): pick a site, try a colour, Save for everyone, and undo it', async () => {
    const { user } = renderApp('/head-office/sites', admin);
    expect(screen.getByRole('heading', { name: 'Sites and colours' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Bunso/ }));
    const save = screen.getByRole('button', { name: 'Save for everyone at Bunso' });
    expect(save).toBeDisabled(); // nothing changed yet
    const swatches = screen.getByRole('radiogroup', { name: 'Colour for Bunso' });
    expect(within(swatches).getByRole('radio', { name: 'Mango' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(swatches).getByRole('radio', { name: 'Teal' }));
    expect(within(swatches).getByRole('radio', { name: 'Teal' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Not saved yet'); // only a draft until Save
    await user.click(save);
    expect(screen.getByRole('status')).toHaveTextContent('Saved on this device');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(swatches).getByRole('radio', { name: 'Mango' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('link', { name: 'Sites' }));
    expect(screen.getByRole('option', { name: /Bunso/ })).toHaveTextContent('Mango');
  });
});

describe('More', () => {

  it('groups everything else, with search at the top', () => {
    renderApp('/more');
    const tabs = screen.getByRole('navigation', { name: 'Main' });
    expect(within(tabs).getByRole('link', { name: 'More' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Search sites, past days/ })).toBeInTheDocument();
    for (const name of ['Today', 'Records', 'You and the team']) expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Food safety/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Sites and colours/ })).not.toBeInTheDocument();
  });

  it('staff see Report a problem instead of Repairs', () => {
    renderApp('/more', staff);
    expect(screen.getByRole('link', { name: /Report a problem/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Repairs/ })).not.toBeInTheDocument();
  });

  it('has Customise home at the top, which opens Customise', async () => {
    const { user } = renderApp('/more', staff);
    const link = screen.getByRole('link', { name: 'Customise home' });
    expect(link).toHaveAttribute('href', '/home/customise');
    // Next to the title, before search.
    expect(link.closest('.top')).toContainElement(screen.getByRole('heading', { name: 'More', level: 1 }));
    await user.click(link);
    expect(screen.getByRole('heading', { name: 'Customise home', level: 1 })).toBeInTheDocument();
  });

  it('Customise home is there for managers and head office in a site, not head office on its own home', () => {
    const m = renderApp('/more');
    expect(screen.getByRole('link', { name: 'Customise home' })).toBeInTheDocument();
    m.unmount();
    const h = renderApp('/more', { ...admin, inSite: true });
    expect(screen.getByRole('link', { name: 'Customise home' })).toBeInTheDocument();
    h.unmount();
    renderApp('/more', admin);
    expect(screen.queryByRole('link', { name: 'Customise home' })).not.toBeInTheDocument();
  });
});

describe('head office all sites', () => {
  it('opens a site’s details, approves it, and can send it back', async () => {
    const { seedVerifiedDraft } = await import('./harness');
    const { deviceStore } = await import('../app/lib/store');
    const { submitReport } = await import('@maginhawa/core');
    const { settingsFor } = await import('../app/lib/draft');
    await seedVerifiedDraft((d) => { d.confirmed = true; d.handover = [{ id: 'h1', category: 'general', body: 'Fridge 2 is noisy again.', raiseRepair: false }]; });
    const d = (await deviceStore().get('BUN', '2026-10-05'))!.draft;
    await submitReport(d, { store: deviceStore(), settings: settingsFor('BUN'), submittedBy: 'Jo' });

    const { user } = renderApp('/head-office', admin);
    const table = await screen.findByRole('table', { name: 'Sites' });
    await user.click(within(table).getByRole('row', { name: 'Bunso: details' }));
    const panel = screen.getByRole('dialog', { name: 'Bunso details' });
    expect(within(panel).getByText('£2,687.50')).toBeInTheDocument();
    expect(within(panel).getByText('Fridge 2 is noisy again.')).toBeInTheDocument();
    expect(within(panel).getByText(/Manager's note · Jo/)).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Approve' }));
    expect(await within(screen.getByRole('dialog', { name: 'Bunso details' })).findByText(/^Approved by Ana/)).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog', { name: 'Bunso details' })).getByRole('button', { name: 'Send back' }));
    expect(await within(screen.getByRole('dialog', { name: 'Bunso details' })).findByText(/^Sent back by Ana/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Bunso details' })).not.toBeInTheDocument();
  });

  it('finds a site from the header search', async () => {
    const { user } = renderApp('/head-office', admin);
    await screen.findByRole('table', { name: 'Sites' });
    await user.type(screen.getByRole('combobox', { name: 'Search sites and screens' }), 'bel');
    await user.click(within(screen.getByRole('listbox', { name: 'Search results' })).getByRole('option', { name: /Belly/ }));
    expect(screen.getByRole('dialog', { name: 'Belly details' })).toBeInTheDocument();
  });

  // Batch 5 (design H3): sort pills, needs-a-look order, Status column, Export CSV.
  /** Tonight: Bunso clean, Guanabana with cash over, Hoodwood sent back, Belly approved; the rest not started. */
  const seedNight = async () => {
    const { seedVerifiedDraft } = await import('./harness');
    const { deviceStore } = await import('../app/lib/store');
    const { submitReport } = await import('@maginhawa/core');
    const { settingsFor } = await import('../app/lib/draft');
    const send = async (code: string, change?: Parameters<typeof seedVerifiedDraft>[0]) => {
      const d = await seedVerifiedDraft((d) => { d.siteCode = code; d.confirmed = true; change?.(d); });
      await submitReport(d, { store: deviceStore(), settings: settingsFor(code), submittedBy: 'Jo' });
    };
    await send('BUN');
    await send('GUA', (d) => { d.sessions.dinner.cash = { ...d.sessions.dinner.cash, tillCash: 33800, reason: 'Miscount, recounted' }; });
    await send('HOO');
    await send('BEL');
    await deviceStore().setStatus('HOO', '2026-10-05', 'sent-back', { by: 'Ana' });
    await deviceStore().setStatus('BEL', '2026-10-05', 'approved', { by: 'Ana' });
  };
  const siteOrder = (table: HTMLElement) => within(table).getAllByRole('row').slice(1).map((r) => r.getAttribute('aria-label')?.replace(': details', ''));
  const rowOf = (table: HTMLElement, name: string) => within(table).getByRole('row', { name: `${name}: details` });

  it('sorts by what needs a look first: sent back, then something to check, then clean, not started, approved last', async () => {
    await seedNight();
    renderApp('/head-office', admin);
    const table = await screen.findByRole('table', { name: 'Sites' });
    await within(rowOf(table, 'Belly')).findByText('Approved');
    const sort = screen.getByRole('group', { name: 'Sort by' });
    expect(within(sort).getAllByRole('button').map((r) => r.textContent)).toEqual(['Needs a look first', 'Net', 'vs forecast', 'Wages']);
    expect(within(sort).getByRole('button', { name: 'Needs a look first' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Sorted by what needs a look')).toBeInTheDocument();
    expect(siteOrder(table)).toEqual([
      'Hoodwood', 'Guanabana', 'Bunso',
      'Bintang', 'Cafe Mama & Sons', 'Mamasons China Town', 'Mamasons Kentish Town',
      'Belly',
    ]);
    // Plain headers: none is marked sorted while sorting by what needs a look.
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual(['Site', 'Status', 'Net', 'vs forecast', 'vs last Mon', 'Wages', 'Cash', 'Last 7 nights']);
    expect(headers.filter((h) => h.hasAttribute('aria-sort'))).toHaveLength(0);
    expect(within(table).queryAllByRole('button')).toHaveLength(0);
  });

  it('the Status column says where each close is', async () => {
    await seedNight();
    renderApp('/head-office', admin);
    const table = await screen.findByRole('table', { name: 'Sites' });
    const status = (name: string) => rowOf(table, name).querySelector('.st-status');
    await within(rowOf(table, 'Belly')).findByText('Approved');
    expect(status('Hoodwood')).toHaveTextContent('Sent back');
    expect(status('Hoodwood')).toHaveClass('warn');
    expect(status('Bunso')).toHaveTextContent(/^Submitted$/);
    expect(status('Bunso')).not.toHaveClass('warn');
    expect(status('Guanabana')).toHaveTextContent(/^Submitted/);
    expect(within(rowOf(table, 'Guanabana')).getByText(/over/)).toHaveClass('bad');
    expect(status('Bintang')).toHaveTextContent('Not started');
  });

  it('switching to Net sorts biggest first, blanks last, ties by name, and marks the Net header', async () => {
    await seedNight();
    const { user } = renderApp('/head-office', admin);
    const table = await screen.findByRole('table', { name: 'Sites' });
    await within(rowOf(table, 'Belly')).findByText('Approved');
    const sort = screen.getByRole('group', { name: 'Sort by' });
    await user.click(within(sort).getByRole('button', { name: 'Net' }));
    expect(within(sort).getByRole('button', { name: 'Net' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(sort).getByRole('button', { name: 'Needs a look first' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Sorted by net, highest first')).toBeInTheDocument();
    expect(siteOrder(table)).toEqual([
      'Belly', 'Bunso', 'Guanabana', 'Hoodwood',
      'Bintang', 'Cafe Mama & Sons', 'Mamasons China Town', 'Mamasons Kentish Town',
    ]);
    expect(within(table).getByRole('columnheader', { name: 'Net' })).toHaveAttribute('aria-sort', 'descending');
    expect(within(table).getByRole('columnheader', { name: 'Site' })).not.toHaveAttribute('aria-sort');
    await user.click(within(sort).getByRole('button', { name: 'Wages' }));
    expect(screen.getByText('Sorted by wages, highest first')).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Wages' })).toHaveAttribute('aria-sort', 'descending');
    expect(within(table).getByRole('columnheader', { name: 'Net' })).not.toHaveAttribute('aria-sort');
  });

  it('Export CSV downloads the rows shown, with a header row', async () => {
    await seedNight();
    const files: Blob[] = [];
    const orig = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = vi.fn((b: Blob) => { files.push(b); return 'blob:test'; });
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
    const read = (b: Blob) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsText(b); });
    try {
      const { user } = renderApp('/head-office', admin);
      const table = await screen.findByRole('table', { name: 'Sites' });
      await within(rowOf(table, 'Belly')).findByText('Approved');
      await user.click(screen.getByRole('button', { name: 'Export CSV' }));
      expect(click).toHaveBeenCalledTimes(1);
      expect(names).toEqual(['maginhawa-sites-2026-10-05.csv']);
      const lines = (await read(files[0]!)).split('\n');
      expect(lines[0]).toBe('Site,Status,Net (£),vs forecast (%),vs last Mon (%),Wages (%),Cash');
      expect(lines).toHaveLength(9);
      // Same order as the table: what needs a look first.
      expect(lines[1]).toMatch(/^Hoodwood,Sent back,2687\.50,/);
      expect(lines[8]).toMatch(/^Belly,Approved,2687\.50,/);
      expect(lines.find((l) => l.startsWith('Bintang'))).toBe('Bintang,Not started,,,,,');

      // Only the rows shown: filter to Approved and export again.
      await user.click(within(screen.getByRole('group', { name: 'Show' })).getByRole('button', { name: /^Approved/ }));
      await user.click(screen.getByRole('button', { name: 'Export CSV' }));
      const approved = (await read(files[1]!)).split('\n');
      expect(approved).toHaveLength(2);
      expect(approved[1]).toMatch(/^Belly,/);
    } finally {
      URL.createObjectURL = orig.create;
      URL.revokeObjectURL = orig.revoke;
      click.mockRestore();
    }
  });
});
