import { Navigate, Outlet, useLocation } from 'react-router';
import { can, homeFor, useAuth } from '../lib/auth';
import { DraftProvider } from '../lib/draft';
import { now } from '../lib/clock';
import { ChecklistsProvider } from '../lib/checklists';
import { TemplatesProvider } from '../lib/templates';

/** Every screen after sign-in works on today's report and checklists for the manager's site. */
export default function SignedIn() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user) return <Navigate to="/sign-in" replace />;
  // Each role only reaches the screens it's allowed to use.
  const blocked = (pathname.startsWith('/close') && !can.doEod(user.role))
    || (pathname.startsWith('/head-office') && !can.seeAllSites(user.role))
    || (pathname.startsWith('/checklists/edit') && !can.editChecklists(user.role));
  if (blocked) return <Navigate to={homeFor(user.role)} replace />;
  return (
    <DraftProvider key={user.siteCode} siteCode={user.siteCode} now={now()}>
      <TemplatesProvider>
        <ChecklistsProvider siteCode={user.siteCode}>
          <Outlet />
        </ChecklistsProvider>
      </TemplatesProvider>
    </DraftProvider>
  );
}
