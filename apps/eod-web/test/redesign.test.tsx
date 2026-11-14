import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, admin, staff } from './harness';

describe('site colours', () => {
  it('themes the app with the site you are in', () => {
    renderApp('/');
    expect(document.documentElement.style.getPropertyValue('--site')).toBe('#F59F00');
    expect(document.documentElement.style.getPropertyValue('--site-on')).toBe('#1D1D1F');
  });

  it('lets head office change a site’s colour, and undo it', async () => {
    const { user } = renderApp('/head-office/sites', admin);
    expect(screen.getByRole('heading', { name: 'Sites and colours' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Bunso/ }));
    const swatches = screen.getByRole('radiogroup', { name: 'Colour for Bunso' });
    expect(within(swatches).getByRole('radio', { name: 'Mango' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(swatches).getByRole('radio', { name: 'Teal' }));
    expect(within(swatches).getByRole('radio', { name: 'Teal' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('option', { name: /Bunso/ })).toHaveTextContent('Teal');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(swatches).getByRole('radio', { name: 'Mango' })).toHaveAttribute('aria-checked', 'true');
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
});
