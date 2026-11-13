import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { can, canDoEod, homeOf, useAuth } from '../lib/auth';
import { DraftProvider } from '../lib/draft-provider';
import { settingsFor } from '../lib/draft';
import { now } from '../lib/clock';
import { ChecklistsProvider } from '../lib/checklists-provider';
import { TemplatesProvider } from '../lib/templates-provider';
import { SiteProvider } from '../lib/site-provider';
import { FoodSafetyProvider } from '../lib/food-safety-provider';
import { StockProvider } from '../lib/stock-provider';
import { OpsProvider } from '../lib/ops-provider';
import { tradingDate } from '@maginhawa/core';
import { SiteShell } from '../components/SiteShell';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { PageSkeleton } from '../components/Skeleton';
import { useComingScreen } from '../components/skeleton-helpers';
import { TourHost } from '../components/Tour';
import { SiteTheme } from '../lib/site-colours';

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
    || (/^\/checklists\/[^/]+\/correct\//.test(pathname) && !can.correctRecords(user.role))
    || (pathname.startsWith('/maintenance/visit') && !can.logVisits(user.role));
  if (blocked) return <Navigate to={homeOf(user)} replace />;
  const outsideSite = user.role === 'headoffice' && !user.inSite;
  // Head office's home is the head office page until they open a site.
  if (outsideSite && pathname === '/') return <Navigate to="/head-office" replace />;
  // Head office screens and People draw their own frame; other screens head office reaches without a site open get it here.
  const ownFrame = pathname.startsWith('/head-office') || pathname.startsWith('/people');
  return (
    <DraftProvider key={user.siteCode} siteCode={user.siteCode} now={now()}>
      <TemplatesProvider>
        <ChecklistsProvider siteCode={user.siteCode}>
          <SiteProvider siteCode={user.siteCode} businessDate={tradingDate(now(), settingsFor(user.siteCode))}>
            <FoodSafetyProvider siteCode={user.siteCode} businessDate={tradingDate(now(), settingsFor(user.siteCode))}>
            <StockProvider siteCode={user.siteCode} businessDate={tradingDate(now(), settingsFor(user.siteCode))}>
            <OpsProvider siteCode={user.siteCode} businessDate={tradingDate(now(), settingsFor(user.siteCode))}>
              {/* Head office has its own frame, until they open a site; everyone else gets the site sidebar on desktop. */}
              {/* The open site's colour on the whole app; graphite on head office's own pages. */}
              <SiteTheme code={outsideSite ? null : user.siteCode} />
              {ownFrame && (outsideSite || pathname.startsWith('/head-office')) ? <Screen headOffice />
                : outsideSite ? <HeadOfficeShell><Screen /></HeadOfficeShell>
                : <SiteShell><Screen /></SiteShell>}
              <TourHost />
            </OpsProvider>
            </StockProvider>
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
