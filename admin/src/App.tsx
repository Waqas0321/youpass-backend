import { Navigate, Route, Routes } from 'react-router-dom';
import { getSession } from './api/client';
import { AdminLayout } from './components/AdminLayout';
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
import { EventDrinkMenuPage } from './pages/EventDrinkMenuPage';
import { EventOrdersPage } from './pages/EventOrdersPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getSession()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/events/:eventId/drinks"
        element={
          <RequireAuth>
            <EventDrinkMenuPage />
          </RequireAuth>
        }
      />
      <Route
        path="/events/:eventId/orders"
        element={
          <RequireAuth>
            <EventOrdersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
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
        <Route path="system" element={<SystemJobsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
