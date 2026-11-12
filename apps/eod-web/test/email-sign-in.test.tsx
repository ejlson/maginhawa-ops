import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';

vi.mock('../app/lib/config', async (orig) => ({ ...(await orig<typeof import('../app/lib/config')>()), usesEmailSignIn: () => true }));

const { AuthProvider } = await import('../app/lib/auth-provider');
const SignIn = (await import('../app/routes/sign-in')).default;

function app() {
  return render(
    <AuthProvider initialUser={null}>
      <MemoryRouter initialEntries={['/sign-in']}>
        <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/" element={<p>Home</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('email sign-in screen', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('asks for an email, then the 6-digit code, then signs in', async () => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url.endsWith('/auth/start')) return reply(200, { challenge: 'c1', minutes: 10 });
      if (url.endsWith('/auth/verify')) return reply(200, { me: { kind: 'user', name: 'Jo Santos', role: 'manager', siteCode: 'BUN', siteCodes: ['BUN'] }, firstTime: true });
      return reply(404, {});
    }));
    const user = userEvent.setup();
    app();
    await user.type(screen.getByLabelText('Email'), 'jo@gmail.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText(/a code is on its way/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('6-digit code'), '12a3456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Home')).toBeInTheDocument();
    expect(calls.map((c) => c.url)).toEqual(['/api/auth/start', '/api/auth/verify']);
    expect(calls[1]!.body).toEqual({ challenge: 'c1', code: '123456' });
  });

  it('says what went wrong, in plain words', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('/auth/start')
      ? reply(200, { challenge: 'c1', minutes: 10 })
      : reply(400, { error: "That code isn't right. Check the email and try again." }))));
    const user = userEvent.setup();
    app();
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Type your email address.');
    await user.type(screen.getByLabelText('Email'), 'jo@gmail.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await user.type(await screen.findByLabelText('6-digit code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("That code isn't right");
  });

  it('tells people when sign-in is not switched on yet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(503, { error: 'not connected', missing: ['SESSION_SECRET'] })));
    const user = userEvent.setup();
    app();
    await user.type(screen.getByLabelText('Email'), 'jo@gmail.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in isn’t switched on yet');
  });
});
