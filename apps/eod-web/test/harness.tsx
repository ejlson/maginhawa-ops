/** Renders the real screens with the same route tree as app/routes.ts. */
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthProvider, type User } from '../app/lib/auth';
import SignIn from '../app/routes/sign-in';
import SignedIn from '../app/routes/signed-in';
import Home from '../app/routes/home';
import Close from '../app/routes/close';
import Review from '../app/routes/review';
import Done from '../app/routes/done';
import Section from '../app/routes/section';
import CashCount from '../app/routes/cash';
import HeadOffice from '../app/routes/head-office';
import { deviceStore } from '../app/lib/store';
import { verifiedDraft } from '../../../packages/core/test/fixtures';

export const manager: User = { name: 'Jo', initials: 'J', role: 'manager', siteCode: 'BUN' };
export const admin: User = { name: 'Ana', initials: 'A', role: 'admin', siteCode: 'BUN' };

export function renderApp(path: string, user: User | null = manager) {
  const u = userEvent.setup();
  const utils = render(
    <AuthProvider initialUser={user}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route element={<SignedIn />}>
            <Route index element={<Home />} />
            <Route path="close" element={<Close />} />
            <Route path="close/review" element={<Review />} />
            <Route path="close/done" element={<Done />} />
            <Route path="close/:section" element={<Section />} />
            <Route path="close/:session/cash" element={<CashCount />} />
            <Route path="head-office" element={<HeadOffice />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
  return { user: u, ...utils };
}

/** Saves the verified example (HANDOFF.md §5) as today's draft, ready to review. */
export async function seedVerifiedDraft(change?: (d: ReturnType<typeof verifiedDraft>) => void) {
  const d = verifiedDraft();
  d.confirmed = false;
  change?.(d);
  await deviceStore().saveDraft(d);
  return d;
}
