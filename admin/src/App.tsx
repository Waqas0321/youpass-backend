import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { getSession } from './api/client';
import { AdminLayout } from './components/AdminLayout';
import { SelectedEventProvider } from './context/SelectedEventContext';
import { EventsPage } from './pages/EventsPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { VenuesPage } from './pages/VenuesPage';
import { BannersPage } from './pages/BannersPage';
import { InvitationsPage } from './pages/InvitationsPage';
import { EventSettingsPage } from './pages/EventSettingsPage';
import { SystemJobsPage } from './pages/SystemJobsPage';
import { ProducersPage } from './pages/ProducersPage';
import { WaitlistPage } from './pages/WaitlistPage';
import { DrinkMenusPage } from './pages/DrinkMenusPage';
import { EventSummaryPage } from './pages/EventSummaryPage';
import { EventInfoPage } from './pages/EventInfoPage';
import { EventDrinkMenuPage } from './pages/EventDrinkMenuPage';
import { EventOrdersPage } from './pages/EventOrdersPage';
import { EventFloorPlanPage } from './pages/EventFloorPlanPage';
import { EventTicketsPage } from './pages/EventTicketsPage';
import { EventVipTablesPage } from './pages/EventVipTablesPage';
import { EventAnalyticsPage } from './pages/EventAnalyticsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { EventInvitationsPage } from './pages/EventInvitationsPage';
import { EventCompsPage } from './pages/EventCompsPage';
import { EventPaymentsPage } from './pages/EventPaymentsPage';
import { EventStaffQrPage } from './pages/EventStaffQrPage';
import { StaffQrPage } from './pages/StaffQrPage';

function EventSummaryRedirect() {
  const { eventId = '' } = useParams();
  return <Navigate to={`/events/${eventId}/summary`} replace />;
}

function RequireAuth() {
  if (!getSession()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SelectedEventProvider>
      <Outlet />
    </SelectedEventProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/events/new/info" element={<EventInfoPage />} />
        <Route path="/events/:eventId/info" element={<EventInfoPage />} />
        <Route path="/events/:eventId/summary" element={<EventSummaryPage />} />
        <Route path="/events/:eventId/drinks" element={<EventDrinkMenuPage />} />
        <Route path="/events/:eventId/orders" element={<EventOrdersPage />} />
        <Route path="/events/:eventId/floor-plan" element={<EventFloorPlanPage />} />
        <Route path="/events/:eventId/vip-tables" element={<EventVipTablesPage />} />
        <Route path="/events/:eventId/tickets" element={<EventTicketsPage />} />
        <Route path="/events/:eventId/analytics" element={<EventAnalyticsPage />} />
        <Route path="/events/:eventId/invitations" element={<EventInvitationsPage />} />
        <Route path="/events/:eventId/comps" element={<EventCompsPage />} />
        <Route path="/events/:eventId/payments" element={<EventPaymentsPage />} />
        <Route path="/events/:eventId/staff-qr" element={<EventStaffQrPage />} />
        <Route path="/events/:eventId" element={<EventSummaryRedirect />} />

        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="drink-menus" element={<DrinkMenusPage />} />
          <Route path="venues" element={<VenuesPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="banners" element={<BannersPage />} />
          <Route path="invitations" element={<InvitationsPage />} />
          <Route path="event-settings" element={<EventSettingsPage />} />
          <Route path="producers" element={<ProducersPage />} />
          <Route path="waitlist" element={<WaitlistPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="system" element={<SystemJobsPage />} />
          <Route path="staff-qr" element={<StaffQrPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
