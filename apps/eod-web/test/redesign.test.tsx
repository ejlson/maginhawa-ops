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
});
