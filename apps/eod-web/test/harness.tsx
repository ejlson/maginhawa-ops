/** Renders the real screens with the same route tree as app/routes.ts. */
import { act, render } from '@testing-library/react';
import { ChecklistSyncClient, EodSyncClient, newDraft, tradingDate } from '@maginhawa/core';
import { settingsFor } from '../app/lib/draft';
import { now } from '../app/lib/clock';
import { checklistBackend, eodRemote, presenceRemote, testTransport } from '../app/lib/sync';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthProvider } from '../app/lib/auth-provider';
import type { User } from '../app/lib/auth';
import SignIn from '../app/routes/sign-in';
import SignedIn from '../app/routes/signed-in';
import Home from '../app/routes/home';
import Close from '../app/routes/close';
import Review from '../app/routes/review';
import Done from '../app/routes/done';
import Section from '../app/routes/section';
import CashCount from '../app/routes/cash';
import HeadOffice from '../app/routes/head-office';
import HeadOfficeSite from '../app/routes/head-office-site';
import MySites from '../app/routes/my-sites';
import Checklists from '../app/routes/checklists';
import ChecklistRun from '../app/routes/checklist-run';
import ChecklistFix from '../app/routes/checklist-fix';
import ChecklistLists from '../app/routes/checklist-lists';
import ChecklistBuilder from '../app/routes/checklist-builder';
import ChecklistCheck from '../app/routes/checklist-check';
import Report from '../app/routes/report';
import Repairs from '../app/routes/repairs';
import Handover from '../app/routes/handover';
import HandoverAdd from '../app/routes/handover-add';
import Switch from '../app/routes/switch';
import Account from '../app/routes/account';
import People from '../app/routes/people';
import PeopleNew from '../app/routes/people-new';
import ChecklistCorrect from '../app/routes/checklist-correct';
import FoodSafety from '../app/routes/food-safety';
import FsRecords from '../app/routes/fs-records';
import FsPack from '../app/routes/fs-pack';
import FsKeep from '../app/routes/fs-keep';
import FsAllergens from '../app/routes/fs-allergens';
import FsDish from '../app/routes/fs-dish';
import FsCooking from '../app/routes/fs-cooking';
import FsProbes from '../app/routes/fs-probes';
import FsDeliveries from '../app/routes/fs-deliveries';
import FsDeliveryNew from '../app/routes/fs-delivery-new';
import FsComplaints from '../app/routes/fs-complaints';
import FsComplaintNew from '../app/routes/fs-complaint-new';
import FsPeople from '../app/routes/fs-people';
import FsFit from '../app/routes/fs-fit';
import FsInspections from '../app/routes/fs-inspections';
import FsReview from '../app/routes/fs-review';
import ReportBuilder from '../app/routes/report-builder';
import { deviceStore } from '../app/lib/store';
import { verifiedDraft } from '../../../packages/core/test/fixtures';
import HoSites from '../app/routes/ho-sites';
import More from '../app/routes/more';
import HomeCustomise from '../app/routes/home-customise';
import Stock from '../app/routes/stock';
import StockCountPage from '../app/routes/stock-count';
import StockSend from '../app/routes/stock-send';
import StockArea from '../app/routes/stock-area';
import HoStock from '../app/routes/ho-stock';
import HoStockItems from '../app/routes/ho-stock-items';
import StockLow from '../app/routes/stock-low';
import OrderPick from '../app/routes/order-pick';
import OrderPage from '../app/routes/order';
import Delivery from '../app/routes/delivery';
import Waste from '../app/routes/waste';
import StockItem from '../app/routes/stock-item';
import Recipes from '../app/routes/recipes';
import RecipePage from '../app/routes/recipe';
import Safety from '../app/routes/safety';
import SafetyCheck from '../app/routes/safety-check';
import SafetyAccident from '../app/routes/safety-accident';
import Maintenance from '../app/routes/maintenance';
import Equipment from '../app/routes/equipment';
import Visit from '../app/routes/visit';
import HoSafety from '../app/routes/ho-safety';
import HoMaintenance from '../app/routes/ho-maintenance';
import HoOrdering from '../app/routes/ho-ordering';
import HoMenu from '../app/routes/ho-menu';
import HoRecords from '../app/routes/ho-records';

export const manager: User = { name: 'Jo', initials: 'J', role: 'manager', siteCode: 'BUN' };
export const admin: User = { name: 'Ana', initials: 'A', role: 'headoffice', siteCode: 'BUN' };
export const staff: User = { name: 'Sam', initials: 'S', role: 'staff', siteCode: 'BUN' };
export const supervisor: User = { name: 'Jo', initials: 'JO', role: 'supervisor', siteCode: 'BUN' };

export function renderApp(path: string, user: User | null = manager) {
  const u = userEvent.setup({ delay: null });
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
            <Route path="checklists" element={<Checklists />} />
            <Route path="checklists/edit" element={<ChecklistLists />} />
            <Route path="checklists/edit/:id" element={<ChecklistBuilder />} />
            <Route path="checklists/edit/:id/check/:check" element={<ChecklistCheck />} />
            <Route path="checklists/:key" element={<ChecklistRun />} />
            <Route path="checklists/:key/fix/:checkpoint" element={<ChecklistFix />} />
            <Route path="checklists/:key/correct/:checkpoint" element={<ChecklistCorrect />} />
            <Route path="food-safety" element={<FoodSafety />} />
            <Route path="food-safety/records" element={<FsRecords />} />
            <Route path="food-safety/records/pack" element={<FsPack />} />
            <Route path="food-safety/keep" element={<FsKeep />} />
            <Route path="food-safety/allergens" element={<FsAllergens />} />
            <Route path="food-safety/allergens/:dish" element={<FsDish />} />
            <Route path="food-safety/cooking" element={<FsCooking />} />
            <Route path="food-safety/probes" element={<FsProbes />} />
            <Route path="food-safety/deliveries" element={<FsDeliveries />} />
            <Route path="food-safety/deliveries/new" element={<FsDeliveryNew />} />
            <Route path="food-safety/complaints" element={<FsComplaints />} />
            <Route path="food-safety/complaints/new" element={<FsComplaintNew />} />
            <Route path="food-safety/people" element={<FsPeople />} />
            <Route path="food-safety/fit-to-work" element={<FsFit />} />
            <Route path="food-safety/inspections" element={<FsInspections />} />
            <Route path="food-safety/review" element={<FsReview />} />
            <Route path="head-office" element={<HeadOffice />} />
            <Route path="my-sites" element={<MySites />} />
            <Route path="report" element={<Report />} />
            <Route path="repairs" element={<Repairs />} />
            <Route path="handover" element={<Handover />} />
            <Route path="handover/new" element={<HandoverAdd />} />
            <Route path="switch" element={<Switch />} />
            <Route path="account" element={<Account />} />
            <Route path="people" element={<People />} />
            <Route path="people/new" element={<PeopleNew />} />
            <Route path="head-office/report-builder" element={<ReportBuilder />} />
            <Route path="head-office/sites" element={<HoSites />} />
            <Route path="more" element={<More />} />
            <Route path="home/customise" element={<HomeCustomise />} />
            <Route path="stock" element={<Stock />} />
            <Route path="stock/count/:id" element={<StockCountPage />} />
            <Route path="stock/count/:id/send" element={<StockSend />} />
            <Route path="stock/count/:id/area/:area" element={<StockArea />} />
            <Route path="head-office/stock" element={<HoStock />} />
            <Route path="head-office/stock/items" element={<HoStockItems />} />
            <Route path="stock/count/:id/low" element={<StockLow />} />
            <Route path="stock/order" element={<OrderPick />} />
            <Route path="stock/order/:supplier" element={<OrderPage />} />
            <Route path="stock/delivery/:order" element={<Delivery />} />
            <Route path="stock/waste" element={<Waste />} />
            <Route path="stock/item/:item" element={<StockItem />} />
            <Route path="recipes" element={<Recipes />} />
            <Route path="recipes/:id" element={<RecipePage />} />
            <Route path="safety" element={<Safety />} />
            <Route path="safety/check/:kind" element={<SafetyCheck />} />
            <Route path="safety/accident" element={<SafetyAccident />} />
            <Route path="maintenance" element={<Maintenance />} />
            <Route path="maintenance/equipment/:id" element={<Equipment />} />
            <Route path="maintenance/visit/:schedule" element={<Visit />} />
            <Route path="head-office/safety" element={<HoSafety />} />
            <Route path="head-office/maintenance" element={<HoMaintenance />} />
            <Route path="head-office/ordering" element={<HoOrdering />} />
            <Route path="head-office/menu" element={<HoMenu />} />
            <Route path="head-office/records" element={<HoRecords />} />
            <Route path="head-office/:site" element={<HeadOfficeSite />} />
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

/**
 * A second device at the same site (e.g. Sam's phone while Jo is on the iPad).
 * It shares the demo "server" with the screens, exactly as two tabs would.
 */
export function otherDevice(name: string) {
  const settings = settingsFor('BUN');
  const businessDate = tradingDate(now(), settings);
  const eod = new EodSyncClient({
    remote: eodRemote(settingsFor), siteCode: 'BUN', businessDate, user: name, deviceId: `${name}-phone`,
    blank: () => newDraft({ clientId: crypto.randomUUID(), siteCode: 'BUN', businessDate, platformIds: ['deliveroo', 'ubereats'] }),
    presence: presenceRemote(), now,
  });
  const checklists = new ChecklistSyncClient({ backend: checklistBackend(), siteCode: 'BUN', businessDate, user: name, deviceId: `${name}-phone`, presence: presenceRemote(), now });
  return { eod, checklists };
}

/** Tells the open screens "something may have changed", like a poll tick or a push message. */
export async function poke() {
  await act(async () => {
    testTransport.poke(`eod:BUN|${tradingDate(now(), settingsFor('BUN'))}`);
    testTransport.poke(`checklists:BUN|${tradingDate(now(), settingsFor('BUN'))}`);
    await new Promise((r) => setTimeout(r, 0));
  });
}
