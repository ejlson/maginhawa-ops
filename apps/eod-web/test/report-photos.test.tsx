import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import type { Repair } from '@maginhawa/core';
import { manager, renderApp, staff } from './harness';

// jsdom can't decode images or draw on a canvas, so stand in for the downscaler.
vi.mock('../app/lib/photo', () => ({
  shrinkPhoto: vi.fn(async (f: File) => `data:image/jpeg;base64,${btoa(f.name)}`),
}));

const png = (name: string) => new File(['x'], name, { type: 'image/png' });
const saved = () => JSON.parse(localStorage.getItem('mgh.repairs.v1') ?? '[]') as Repair[];

describe('photos on Report a problem', () => {
  it('offers an optional photo, shows a thumbnail, and can remove it', async () => {
    const { user } = renderApp('/report', staff);
    const add = screen.getByLabelText('Add a photo');
    expect(add).toHaveAttribute('type', 'file');
    expect(add).toHaveAttribute('accept', 'image/*');
    expect(screen.queryByRole('button', { name: /^Remove photo/ })).not.toBeInTheDocument();

    await user.upload(add, png('leak.png'));
    expect(await screen.findByRole('button', { name: 'Remove photo 1' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Photo 1' })).toHaveAttribute('src', `data:image/jpeg;base64,${btoa('leak.png')}`);

    await user.click(screen.getByRole('button', { name: 'Remove photo 1' }));
    expect(screen.queryByRole('img', { name: 'Photo 1' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Add a photo')).toBeInTheDocument();
  });

  it('takes up to 3, then the add control goes; removing one brings it back', async () => {
    const { user } = renderApp('/report', staff);
    for (const n of ['a.png', 'b.png', 'c.png']) {
      await user.upload(screen.getByLabelText('Add a photo'), png(n));
    }
    expect(await screen.findByRole('button', { name: 'Remove photo 3' })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /^Photo \d$/ })).toHaveLength(3);
    expect(screen.queryByLabelText('Add a photo')).not.toBeInTheDocument();
    expect(screen.queryByText('Add photo')).not.toBeInTheDocument();

    // Removing the middle one keeps the others in order and renumbers them.
    await user.click(screen.getByRole('button', { name: 'Remove photo 2' }));
    const imgs = screen.getAllByRole('img', { name: /^Photo \d$/ });
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual([`data:image/jpeg;base64,${btoa('a.png')}`, `data:image/jpeg;base64,${btoa('c.png')}`]);
    expect(screen.queryByRole('button', { name: 'Remove photo 3' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Add a photo')).toBeInTheDocument();
  });

  it('sends the photos with the repair, and the manager sees them on Repairs', async () => {
    const { user, unmount } = renderApp('/report', staff);
    await user.type(screen.getByLabelText("What's broken"), 'Dishwasher leaking');
    await user.upload(screen.getByLabelText('Add a photo'), png('one.png'));
    await user.upload(screen.getByLabelText('Add a photo'), png('two.png'));
    await screen.findByRole('button', { name: 'Remove photo 2' });
    await user.click(screen.getByRole('button', { name: 'Send to the manager' }));
    expect(screen.getByText('Sent. Your manager can see it now.')).toBeInTheDocument();
    const [r] = saved();
    expect(r!.photos).toEqual([`data:image/jpeg;base64,${btoa('one.png')}`, `data:image/jpeg;base64,${btoa('two.png')}`]);
    unmount();

    renderApp('/repairs', manager);
    const first = screen.getByRole('img', { name: 'Dishwasher leaking, photo 1' });
    expect(first).toHaveAttribute('src', `data:image/jpeg;base64,${btoa('one.png')}`);
    // The thumbnails sit in the repair's own row, under its title.
    expect(first.closest('.tx')).toHaveTextContent('Dishwasher leaking');
    expect(screen.getByRole('img', { name: 'Dishwasher leaking, photo 2' })).toBeInTheDocument();
  });

  it('with no photos, the repair has no photos key and Repairs shows no thumbnails', async () => {
    const { user, unmount } = renderApp('/report', staff);
    await user.type(screen.getByLabelText("What's broken"), 'Fridge door');
    await user.click(screen.getByRole('button', { name: 'Send to the manager' }));
    const [r] = saved();
    expect(r!.title).toBe('Fridge door');
    expect(r).not.toHaveProperty('photos');
    unmount();

    renderApp('/repairs', manager);
    expect(screen.getByText('Fridge door')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /photo/ })).not.toBeInTheDocument();
    expect(document.querySelector('.photo-row')).toBeNull();
  });
});
