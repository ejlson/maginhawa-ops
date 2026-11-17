import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { OPEN_SITE_CODES, type Recipe, type StockItem } from '@maginhawa/core';
import { admin, manager, renderApp, staff, supervisor } from './harness';

// Each site keeps its own items and recipes (docs/reports/per-site-recipes-and-items.md). Every test user is at Bunso (BUN).

const saved = <T,>(key: string) => JSON.parse(localStorage.getItem(key) ?? 'null') as T;
const savedRecipes = () => saved<{ recipes: Recipe[] }>('mgh.ops.v1').recipes;
const savedItems = () => saved<{ items: StockItem[] }>('mgh.stock.v1').items;
const at = <T extends { id: string; siteCode?: string }>(list: T[], id: string, site: string) => list.find((x) => x.id === id && x.siteCode === site);

describe('recipes per site', () => {
  it('a supervisor edits a step; it is saved for Bunso only, and the old data was copied to every site', async () => {
    const { user, unmount } = renderApp('/recipes/adobo', supervisor);
    await user.click(screen.getByRole('link', { name: 'Edit recipe' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved for Bunso only.');
    const step = screen.getByRole('textbox', { name: 'Step 1' });
    await user.clear(step);
    await user.type(step, 'Sear the pork hard.');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    // Back on the recipe, with the new step.
    await user.click(screen.getByRole('button', { name: 'Got everything · start' }));
    expect(screen.getByText('Sear the pork hard.')).toBeInTheDocument();

    // Migration: the demo recipes had no site, so each open site got its own copy.
    const recipes = savedRecipes();
    expect(recipes.every((r) => r.siteCode)).toBe(true);
    expect(recipes.filter((r) => r.id === 'adobo').map((r) => r.siteCode).sort()).toEqual([...OPEN_SITE_CODES].sort());
    expect(at(recipes, 'adobo', 'BUN')!.steps[0]!.text).toBe('Sear the pork hard.');
    for (const code of OPEN_SITE_CODES.filter((c) => c !== 'BUN')) expect(at(recipes, 'adobo', code)!.steps[0]!.text).toBe('Crisp the pork, skin side down.');
    unmount();

    // Head office opening Guanabana's copy sees the old step.
    renderApp('/recipes/adobo/edit?site=GUA', admin);
    expect(screen.getByRole('textbox', { name: 'Step 1' })).toHaveValue('Crisp the pork, skin side down.');
    expect(screen.getByRole('status')).toHaveTextContent('Saved for Guanabana only.');
  });

  it('staff see no New recipe or Edit recipe, and are sent back from /recipes/new and the edit page', () => {
    const { unmount } = renderApp('/recipes', staff);
    expect(screen.queryByRole('link', { name: 'New recipe' })).not.toBeInTheDocument();
    unmount();
    const r2 = renderApp('/recipes/adobo', staff);
    expect(screen.queryByRole('link', { name: 'Edit recipe' })).not.toBeInTheDocument();
    r2.unmount();
    const r3 = renderApp('/recipes/new', staff);
    expect(screen.getByRole('heading', { level: 1, name: 'Recipes' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'New recipe' })).not.toBeInTheDocument();
    r3.unmount();
    renderApp('/recipes/adobo/edit', staff);
    expect(screen.getByRole('heading', { level: 1, name: 'Recipes' })).toBeInTheDocument();
  });

  it('supervisors and up get New recipe; an unknown recipe id goes back to Recipes', () => {
    const { unmount } = renderApp('/recipes', supervisor);
    expect(screen.getByRole('link', { name: 'New recipe' })).toHaveAttribute('href', '/recipes/new');
    unmount();
    renderApp('/recipes/nope/edit', manager);
    expect(screen.getByRole('heading', { level: 1, name: 'Recipes' })).toBeInTheDocument();
  });

  it('a new recipe needs a name, then an ingredient; it is added at Bunso only', async () => {
    const { user } = renderApp('/recipes/new', manager);
    const add = screen.getByRole('button', { name: 'Add recipe' });
    await user.click(add);
    expect(screen.getByRole('status')).toHaveTextContent('Give the dish a name');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Tapsilog');
    await user.click(add);
    expect(screen.getByRole('status')).toHaveTextContent('Add at least one ingredient');
    await user.click(screen.getByRole('button', { name: 'Add an ingredient' }));
    await user.click(add);
    expect(screen.getByRole('status')).toHaveTextContent('Each ingredient needs an amount');
    await user.type(screen.getByRole('textbox', { name: /^Amount of / }), '0.004');
    await user.click(add);
    expect(screen.getByRole('status')).toHaveTextContent('Add at least one step');
    await user.type(screen.getByRole('textbox', { name: 'Step 1' }), 'Fry the beef.');
    await user.click(add);
    expect(screen.queryByRole('button', { name: 'Add recipe' })).not.toBeInTheDocument();
    const mine = savedRecipes().filter((r) => r.name === 'Tapsilog');
    expect(mine.map((r) => r.siteCode)).toEqual(['BUN']);
    expect(mine[0]!.pricePence).toBe(0);
    expect(mine[0]!.lines[0]!.amount).toBe(0.004); // a small amount keeps its zeros
  });

  it('a manager sees the menu price read-only; head office sets it for one site', async () => {
    const { unmount } = renderApp('/recipes/adobo/edit', manager);
    expect(screen.queryByRole('textbox', { name: 'Menu price, with VAT' })).not.toBeInTheDocument();
    expect(screen.getByText(/^Menu price £16\.50 · set by head office$/)).toBeInTheDocument();
    unmount();

    const { user } = renderApp('/recipes/adobo/edit?site=GUA', admin);
    const price = screen.getByRole('textbox', { name: 'Menu price, with VAT' });
    await user.clear(price);
    await user.type(price, '17.95');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    // Head office editing another site's recipe goes back to that site's Menu costing.
    expect(await screen.findByRole('heading', { level: 1, name: 'Menu costing' })).toBeInTheDocument();
    const recipes = savedRecipes();
    expect(at(recipes, 'adobo', 'GUA')!.pricePence).toBe(1795);
    expect(at(recipes, 'adobo', 'BUN')!.pricePence).toBe(1650);
  });
});

describe('items per site', () => {
  it('Stock links supervisors and up to the site\'s items; staff are sent back', () => {
    const { unmount } = renderApp('/stock', supervisor);
    expect(screen.getByRole('link', { name: /^Items and costs/ })).toHaveAttribute('href', '/stock/items');
    unmount();
    renderApp('/stock/items', staff);
    expect(screen.queryByRole('heading', { name: 'Items and costs' })).not.toBeInTheDocument();
  });

  it('a manager adds an item at Bunso; it is not on Guanabana\'s list', async () => {
    const { user, unmount } = renderApp('/stock/items', manager);
    const form = screen.getByRole('region', { name: 'Add an item' });
    await user.type(within(form).getByRole('textbox', { name: 'Name' }), 'Calamansi juice');
    await user.type(within(form).getByRole('textbox', { name: 'Counted in' }), 'bottles');
    await user.click(within(form).getByRole('button', { name: 'Add item' }));
    expect(screen.getByText('Calamansi juice')).toBeInTheDocument();

    const items = savedItems();
    expect(items.filter((i) => i.name === 'Calamansi juice').map((i) => i.siteCode)).toEqual(['BUN']);
    // Migration: every demo item was copied to each open site.
    expect(items.every((i) => i.siteCode)).toBe(true);
    expect(items.filter((i) => i.id === 'rum').map((i) => i.siteCode).sort()).toEqual([...OPEN_SITE_CODES].sort());
    unmount();

    const ho = renderApp('/head-office/stock/items?site=GUA', admin);
    expect(screen.getByRole('combobox', { name: 'Site' })).toHaveValue('GUA');
    expect(screen.queryByText('Calamansi juice')).not.toBeInTheDocument();
    ho.unmount();
    renderApp('/head-office/stock/items?site=BUN', admin);
    expect(screen.getByText('Calamansi juice')).toBeInTheDocument();
  });

  it('a cost changed at Bunso leaves Guanabana\'s copy alone', async () => {
    const { user } = renderApp('/stock/items', manager);
    const rum = screen.getByRole('textbox', { name: 'Tanduay rum 70cl cost' });
    await user.clear(rum);
    await user.type(rum, '1.23');
    const items = savedItems();
    expect(at(items, 'rum', 'BUN')!.costPence).toBe(123);
    expect(at(items, 'rum', 'GUA')!.costPence).not.toBe(123);
  });
});
