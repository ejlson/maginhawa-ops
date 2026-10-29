import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { can, canDoEod, homeOf, useAuth } from '../lib/auth';
import { DraftProvider, settingsFor } from '../lib/draft';
import { now } from '../lib/clock';
import { ChecklistsProvider } from '../lib/checklists';
import { TemplatesProvider } from '../lib/templates';
import { SiteProvider } from '../lib/site';
import { FoodSafetyProvider } from '../lib/food-safety';
import { tradingDate } from '@maginhawa/core';
import { SiteShell } from '../components/SiteShell';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { PageSkeleton, useComingScreen } from '../components/Skeleton';
import { TourHost } from '../components/Tour';

/** Every screen after sign-in works on today's report and checklists for the manager's site. */
export default function SignedIn() {
  const { user, leaveSite } = useAuth();
  const { pathname } = useLocation();
  // Going back to head office's own screens (say with the browser's Back button) leaves the site they had open.
  // Only when the address changes: opening a site happens a moment before the address moves on.
  useEffect(() => { if (user?.inSite && pathname.startsWith('/head-office')) leaveSite(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return <Navigate to="/sign-in" replace />;
  // Each role only reaches the screens it's allowed to use.
  const blocked = (pathname.startsWith('/close') && !canDoEod(user))
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
  if (blocked) return <Navigate to={homeOf(user)} replace />;
  return (
    <DraftProvider key={user.siteCode} siteCode={user.siteCode} now={now()}>
      <TemplatesProvider>
        <ChecklistsProvider siteCode={user.siteCode}>
          <SiteProvider siteCode={user.siteCode} businessDate={tradingDate(now(), settingsFor(user.siteCode))}>
            <FoodSafetyProvider siteCode={user.siteCode} businessDate={tradingDate(now(), settingsFor(user.siteCode))}>
              {/* Head office has its own frame, until they open a site; everyone else gets the site sidebar on desktop. */}
              {(user.role === 'headoffice' && !user.inSite) || pathname.startsWith('/head-office') ? <Screen headOffice /> : <SiteShell><Screen /></SiteShell>}
              <TourHost />
            </FoodSafetyProvider>
          </SiteProvider>
        </ChecklistsProvider>
      </TemplatesProvider>
    </DraftProvider>
  );
}

/** The screen, or the next screen's skeleton while its code is still downloading. */
function Screen({ headOffice }: { headOffice?: boolean }) {
  const next = useComingScreen();
  if (!next) return <Outlet />;
  // Head office screens draw their own frame, so keep the sidebar in place around the skeleton.
  return headOffice && next.startsWith('/head-office') ? <HeadOfficeShell><PageSkeleton wide /></HeadOfficeShell> : <PageSkeleton />;
}
