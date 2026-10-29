import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { admin, manager, renderApp } from './harness';
import { people } from '../app/lib/people';

const joAt = (siteCode: string, otherSites: string[] = []) =>
  people.add({ name: 'Jo', role: 'manager', siteCode, otherSites, email: 'jo@example.com', addedBy: 'Ana' });

describe('switching site', () => {
  it('a manager with one site just sees its name', () => {
    joAt('BUN');
    renderApp('/', manager);
    expect(screen.queryByRole('button', { name: /^Bunso/ })).not.toBeInTheDocument();
    expect(screen.getByText('Bunso')).toBeInTheDocument();
  });

  it('a manager with two sites switches, and can go straight back', async () => {
    joAt('BUN', ['GUA']);
    const { user } = renderApp('/', manager);
    await user.click(screen.getByRole('button', { name: /^Bunso/ }));
    const sheet = screen.getByRole('dialog', { name: 'Your sites' });
    expect(within(sheet).getAllByRole('option').map((o) => o.textContent)).toEqual([expect.stringMatching(/^BUBunso/), expect.stringMatching(/^GUGuanabana/)]);
    await user.click(within(sheet).getByRole('option', { name: /Guanabana/ }));
    expect(screen.getByRole('button', { name: /^Guanabana/ })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Now in Guanabana');
    await user.click(screen.getByRole('button', { name: 'Back to Bunso' }));
    expect(screen.getByRole('button', { name: /^Bunso/ })).toBeInTheDocument();
  });

  it('each site keeps its own EOD', async () => {
    joAt('BUN', ['GUA']);
    const first = renderApp('/close/lunch', manager);
    await first.user.type(screen.getByLabelText('Gross sales'), '100');
    await first.user.click(screen.getByRole('button', { name: 'Save lunch' }));
    expect(await screen.findByText('1 of 8 sections done')).toBeInTheDocument();
    first.unmount();
    const { user } = renderApp('/close', manager);
    await user.click(screen.getByRole('link', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /^Bunso/ }));
    await user.click(screen.getByRole('option', { name: /Guanabana/ }));
    await user.click(screen.getByRole('link', { name: 'EOD' }));
    expect(await screen.findByRole('heading', { name: "Today's EOD" })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('£100.00');
    await user.click(screen.getByRole('button', { name: 'Back to Bunso' }));
    await screen.findByRole('heading', { name: "Today's EOD" });
    expect(document.body).toHaveTextContent('£100.00');
  });
});

describe('head office in a site', () => {
  it('opens a site, works in its EOD, and goes back', async () => {
    const { user } = renderApp('/head-office/GUA', admin);
    await user.click(screen.getByRole('button', { name: 'Open Guanabana' }));
    expect(screen.getByText(/as head office/)).toHaveTextContent('Viewing Guanabana as head office');
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'EOD' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Guanabana/ }));
    const sheet = screen.getByRole('dialog', { name: 'Sites' });
    expect(within(sheet).getAllByRole('option')).toHaveLength(9);
    await user.type(within(sheet).getByLabelText('Find a site'), 'bel');
    await user.click(within(sheet).getByRole('option', { name: /Belly/ }));
    expect(screen.getByText(/as head office/)).toHaveTextContent('Viewing Belly as head office');
    await user.click(screen.getByRole('button', { name: 'Exit to head office' }));
    expect(screen.queryByText(/as head office/)).not.toBeInTheDocument();
  });

  it("can't reach a site's EOD without opening the site", () => {
    renderApp('/close/lunch', admin);
    expect(screen.queryByLabelText('Gross sales')).not.toBeInTheDocument();
  });
});

describe("a manager's sites on People", () => {
  it('head office gives a manager a second site, and can undo it', async () => {
    const jo = joAt('BUN');
    const { user } = renderApp(`/people?site=BUN&p=${jo.id}`, admin);
    const sites = screen.getByRole('group', { name: 'Sites' });
    expect(within(sites).getByRole('checkbox', { name: 'Bunso' })).toBeDisabled();
    await user.click(within(sites).getByRole('checkbox', { name: 'Guanabana' }));
    expect(screen.getByText('Jo can now switch to Guanabana.')).toBeInTheDocument();
    expect(people.all().find((p) => p.id === jo.id)?.otherSites).toEqual(['GUA']);
    await user.click(within(screen.getByRole('group', { name: 'Sites' })).getByRole('button', { name: 'Make main' }));
    expect(people.all().find((p) => p.id === jo.id)).toMatchObject({ siteCode: 'GUA', otherSites: ['BUN'] });
  });

  it('a manager sees their sites but not the ticks', () => {
    const jo = joAt('BUN', ['GUA']);
    renderApp(`/people?p=${jo.id}`, manager);
    expect(screen.getByText('Bunso, Guanabana')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Guanabana' })).not.toBeInTheDocument();
  });
});
