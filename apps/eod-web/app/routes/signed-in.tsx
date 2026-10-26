import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../lib/auth';
import { DraftProvider } from '../lib/draft';
import { now } from '../lib/clock';

/** Every screen after sign-in works on today's report for the manager's site. */
export default function SignedIn() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/sign-in" replace />;
  return (
    <DraftProvider key={user.siteCode} siteCode={user.siteCode} now={now()}>
      <Outlet />
    </DraftProvider>
  );
}
