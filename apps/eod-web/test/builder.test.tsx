import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { admin, manager, renderApp, staff } from './harness';
import { setNow } from '../app/lib/clock';

const bar = '/checklists/edit/bar';

describe('who can edit checklists', () => {
  it('managers get an Edit lists link; staff do not', () => {
    const { unmount } = renderApp('/checklists');
    expect(screen.getByRole('link', { name: 'Edit lists' })).toHaveAttribute('href', '/checklists/edit');
    unmount();
    renderApp('/checklists', staff);
    expect(screen.queryByRole('link', { name: 'Edit lists' })).not.toBeInTheDocument();
  });

  it('staff are sent home from the builder', () => {
    renderApp(bar, staff);
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('a manager sees their site lists and the group lists, but only changes their own', async () => {
    const { user } = renderApp('/checklists/edit');
    expect(screen.getByRole('heading', { name: 'Bunso lists' })).toBeInTheDocument();
    expect(screen.getByText('Head office looks after these. You can see them but not change them.')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /Opening checks/ }));
    expect(screen.getByLabelText('Name')).toBeDisabled();
    expect(screen.getByText(/Head office looks after this list/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a check' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish/ })).not.toBeInTheDocument();
  });

  it('head office can change a group list and reaches the builder from all sites', async () => {
    const { unmount } = renderApp('/head-office', admin);
    expect(await screen.findByRole('link', { name: /Checklists/ })).toHaveAttribute('href', '/checklists/edit');
    unmount();
    renderApp('/checklists/edit/opening', admin);
    expect(screen.getByLabelText('Name')).toBeEnabled();
  });
});

describe('building a checklist', () => {
  it('a manager makes a new list, adds checks and publishes it for tomorrow', async () => {
    const { user } = renderApp('/checklists/edit');
    await user.click(screen.getByRole('button', { name: 'New checklist' }));
    expect(screen.getByRole('button', { name: '3 things to finish first' })).toBeDisabled();
    expect(screen.getByText('Bunso only')).toBeInTheDocument();
    expect(screen.getByText('3 things to finish')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Brunch set-up');
    await user.type(screen.getByLabelText('Who does it'), 'Floor team');
    await user.click(screen.getByRole('radio', { name: 'Opening' }));

    await user.click(screen.getByRole('button', { name: 'Add a check' }));
    await user.click(screen.getByRole('button', { name: /^Temperature/ }));
    // Straight into the new check.
    await user.type(screen.getByLabelText('Question'), 'Juice fridge');
    await user.click(screen.getByRole('button', { name: 'Fridge · 8°C or below' }));
    expect(screen.getByLabelText('Highest')).toHaveValue('8');
    // The preview behaves like the real thing.
    await user.type(within(screen.getByLabelText('Preview')).getByLabelText('Juice fridge'), '9');
    expect(screen.getByText('Too warm')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByText('Juice fridge')).toBeInTheDocument();
    expect(screen.getByText('Temperature · 8°C or below')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Publish · starts tomorrow' }));
    expect(screen.getByText('Starts Tuesday 6 October')).toBeInTheDocument();
    // Nothing left to do, so no buttons.
    expect(screen.queryByRole('button', { name: /Publish/ })).not.toBeInTheDocument();

    // Not on today's checklists: it starts tomorrow.
    await user.click(screen.getByRole('link', { name: 'Lists' }));
    expect(screen.getByText('Starts tomorrow')).toBeInTheDocument();
  });

  it('a published change leaves today\'s list alone', async () => {
    const { user, unmount } = renderApp(bar);
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Bar set-up');
    await user.click(screen.getByRole('button', { name: 'Publish · starts tomorrow' }));
    expect(screen.getByText('Changes start Tuesday 6 October')).toBeInTheDocument();
    expect(screen.getByText('Bunso only · today runs the old version')).toBeInTheDocument();
    unmount();

    // Today's list doesn't change partway through the day.
    renderApp('/checklists?phase=mid-shift');
    expect(screen.getByText('Bar opening')).toBeInTheDocument();
  });

  it('tomorrow, staff get the new version', async () => {
    const { user, unmount } = renderApp(bar);
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Bar set-up');
    await user.click(screen.getByRole('button', { name: 'Publish · starts tomorrow' }));
    unmount();
    setNow(new Date('2026-10-06T21:00:00Z'));
    renderApp('/checklists?phase=mid-shift', staff);
    expect(screen.getByText('Bar set-up')).toBeInTheDocument();
    expect(screen.queryByText('Bar opening')).not.toBeInTheDocument();
  });

  it('changes are a draft until published, and can be undone', async () => {
    const { user } = renderApp(bar);
    await user.type(screen.getByLabelText('Who does it'), ' and floor');
    expect(screen.getByText('Draft saved')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo my changes' }));
    await user.click(screen.getByRole('button', { name: 'Tap again to confirm' }));
    expect(screen.getByLabelText('Who does it')).toHaveValue('Bar team');
  });

  it('the checks come before the settings, and the name is edited on the card', () => {
    renderApp(bar);
    const order = ['Name', 'Checks', 'Who and when'].map((x) => (x === 'Name' ? screen.getByLabelText('Name') : screen.getByRole('heading', { name: x })));
    expect(order[0]!.compareDocumentPosition(order[1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(order[1]!.compareDocumentPosition(order[2]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // A live list with nothing changed has no footer buttons to think about.
    expect(screen.queryByRole('button', { name: /Publish|Undo/ })).not.toBeInTheDocument();
  });

  it('adds a due time from the Add time chip', async () => {
    const { user } = renderApp(bar);
    await user.click(screen.getByRole('button', { name: 'Add time' }));
    await user.type(screen.getByLabelText('New time'), '17:15');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('button', { name: 'Remove 17:15' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add time' })).toBeInTheDocument();
    // Tapping away without picking a time just closes it.
    await user.click(screen.getByRole('button', { name: 'Add time' }));
    await user.tab();
    expect(screen.queryByLabelText('New time')).not.toBeInTheDocument();
  });

  it('reorders checks', async () => {
    const { user } = renderApp(bar);
    await user.click(screen.getByRole('button', { name: 'Reorder' }));
    await user.click(screen.getByRole('button', { name: 'Move Beer cellar temperature up' }));
    const rows = screen.getAllByRole('button', { name: /up$/ }).map((b) => b.getAttribute('aria-label'));
    expect(rows.slice(0, 2)).toEqual(['Move Beer cellar temperature up', 'Move Ice machine cleaned up']);
  });

  it('a choice needs two real options before it can be published', async () => {
    const { user } = renderApp(bar);
    await user.click(screen.getByRole('button', { name: 'Add a check' }));
    await user.click(screen.getByRole('button', { name: /^Pick from a list/ }));
    await user.type(screen.getByLabelText('Question'), 'Who opened');
    expect(screen.getByText('"Who opened" needs at least two options')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Option 1'), 'Jo');
    await user.type(screen.getByLabelText('Option 2'), 'Sam');
    expect(screen.queryByText(/needs at least two options/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Publish · starts tomorrow' })).toBeEnabled();
  });

  it('removing a check takes two taps', async () => {
    const { user } = renderApp(bar + '/check/ice');
    await user.click(screen.getByRole('button', { name: 'Remove this check' }));
    await user.click(screen.getByRole('button', { name: 'Tap again to remove' }));
    expect(screen.queryByText('Ice machine cleaned')).not.toBeInTheDocument();
    expect(screen.getByText(/^7 checks/)).toBeInTheDocument();
  });

  it('a manager can stop a site list from tomorrow', async () => {
    const { user } = renderApp(bar, manager);
    await user.click(screen.getByRole('button', { name: 'Stop using this list' }));
    await user.click(screen.getByRole('button', { name: 'Tap again to stop it from tomorrow' }));
    expect(screen.getByText('Stopped. Staff no longer see it')).toBeInTheDocument();
  });
});
