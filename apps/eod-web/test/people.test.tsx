import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { admin, manager, renderApp, staff, supervisor } from './harness';
import { people } from '../app/lib/people';

const addSam = () => people.add({ name: 'Sam', role: 'staff', siteCode: 'BUN', email: null, addedBy: 'Jo' });

describe('people', () => {
  it('a manager adds someone, who then shows up with no PIN yet', async () => {
    const { user } = renderApp('/people/new', manager);
    expect(screen.getByRole('button', { name: 'Add person' })).toBeDisabled();
    await user.type(screen.getByLabelText('Name'), 'Leah');
    // Managers can't give head-office access.
    expect(screen.getByRole('radio', { name: /Head office/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Add Leah' }));
    expect(screen.getByRole('heading', { name: 'Leah is added' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Done' }));
    expect(screen.getByRole('button', { name: /Leah.*Sets a PIN the first time/ })).toBeInTheDocument();
  });

  it('a manager needs an email to add another manager', async () => {
    const { user } = renderApp('/people/new', manager);
    await user.type(screen.getByLabelText('Name'), 'Alex');
    await user.click(screen.getByRole('radio', { name: /Manager/ }));
    await user.click(screen.getByRole('button', { name: 'Add Alex' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Add their email so they can sign in.');
    await user.type(screen.getByLabelText('Email'), 'alex@example.com');
    await user.click(screen.getByRole('button', { name: 'Add Alex' }));
    expect(screen.getByRole('heading', { name: 'Alex is added' })).toBeInTheDocument();
  });

  it('turns down a second person with the same name', async () => {
    addSam();
    const { user } = renderApp('/people/new', manager);
    await user.type(screen.getByLabelText('Name'), 'sam');
    await user.click(screen.getByRole('button', { name: 'Add sam' }));
    expect(screen.getByRole('alert')).toHaveTextContent("There's already a sam here.");
  });

  it('changing a role can be undone', async () => {
    addSam();
    const { user } = renderApp('/people', manager);
    await user.click(screen.getByRole('button', { name: /^S.*Sam/ }));
    await user.click(screen.getByRole('radio', { name: /Supervisor/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Sam is now a supervisor.');
    expect(people.at('BUN').find((p) => p.name === 'Sam')!.role).toBe('supervisor');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(people.at('BUN').find((p) => p.name === 'Sam')!.role).toBe('staff');
  });

  it("someone marked as left can't sign in on the iPad", async () => {
    addSam();
    const first = renderApp('/people', manager);
    await first.user.click(screen.getByRole('button', { name: /^S.*Sam/ }));
    await first.user.click(screen.getByRole('button', { name: 'Mark Sam as left' }));
    expect(screen.getByRole('status')).toHaveTextContent('Sam is marked as left.');
    first.unmount();

    const { user } = renderApp('/switch', { ...staff, name: 'Mia', initials: 'M' });
    expect(screen.queryByRole('button', { name: /^S.*Sam/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Someone else'), 'Sam');
    await user.click(screen.getByRole('button', { name: "I'm Sam" }));
    expect(screen.getByRole('alert')).toHaveTextContent("Sam is marked as left, so can't sign in here.");
  });

  it('is for managers and head office only', () => {
    renderApp('/people', supervisor);
    expect(screen.queryByRole('heading', { name: 'People' })).not.toBeInTheDocument();
  });

  it('head office can give head-office access', async () => {
    const { user } = renderApp('/people/new', admin);
    await user.type(screen.getByLabelText('Name'), 'Kim');
    expect(screen.getByRole('radio', { name: /Head office/ })).toBeEnabled();
  });
});
