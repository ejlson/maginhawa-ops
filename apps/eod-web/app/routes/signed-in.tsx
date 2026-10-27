import { Navigate, Outlet, useLocation } from 'react-router';
import { can, homeFor, useAuth } from '../lib/auth';
import { DraftProvider, settingsFor } from '../lib/draft';
import { now } from '../lib/clock';
import { ChecklistsProvider } from '../lib/checklists';
import { TemplatesProvider } from '../lib/templates';
import { SiteProvider } from '../lib/site';
import { FoodSafetyProvider } from '../lib/food-safety';
import { tradingDate } from '@maginhawa/core';
import { SiteShell } from '../components/SiteShell';

/** Every screen after sign-in works on today's report and checklists for the manager's site. */
export default function SignedIn() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user) return <Navigate to="/sign-in" replace />;
  // Each role only reaches the screens it's allowed to use.
  const blocked = (pathname.startsWith('/close') && !can.doEod(user.role))
    || (pathname.startsWith('/head-office') && !can.seeAllSites(user.role))
    || (pathname.startsWith('/checklists/edit') && !can.editChecklists(user.role))
    || (pathname.startsWith('/repairs') && !can.fixRepairs(user.role))
    || (pathname.startsWith('/food-safety/records') && !can.compileRecords(user.role))
    || (pathname.startsWith('/food-safety/keep') && !can.setKeepPeriods(user.role))
    || (pathname.startsWith('/food-safety/complaints') && !can.logComplaints(user.role))
    || (pathname.startsWith('/food-safety/people') && !can.seeStaffHealth(user.role))
    || (pathname.startsWith('/food-safety/inspections') && !can.logInspections(user.role))
    || (pathname.startsWith('/food-safety/review') && !can.doReview(user.role))
    || (/^\/checklists\/[^/]+\/correct\//.test(pathname) && !can.correctRecords(user.role));
  if (blocked) return <Navigate to={homeFor(user.role)} replace />;
  return (
    <DraftProvider key={user.siteCode} siteCode={user.siteCode} now={now()}>
      <TemplatesProvider>
        <ChecklistsProvider siteCode={user.siteCode}>
          <SiteProvider siteCode={user.siteCode} businessDate={tradingDate(now(), settingsFor(user.siteCode))}>
            <FoodSafetyProvider siteCode={user.siteCode} businessDate={tradingDate(now(), settingsFor(user.siteCode))}>
              {/* Head office has its own frame; everyone else gets the site sidebar on desktop. */}
              {user.role === 'headoffice' || pathname.startsWith('/head-office') ? <Outlet /> : <SiteShell><Outlet /></SiteShell>}
            </FoodSafetyProvider>
          </SiteProvider>
        </ChecklistsProvider>
      </TemplatesProvider>
    </DraftProvider>
  );
}
