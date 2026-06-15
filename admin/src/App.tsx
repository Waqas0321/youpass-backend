import { Navigate, Route, Routes } from 'react-router-dom';
import { getSession } from './api/client';
import { AdminLayout } from './components/AdminLayout';
import { EventsPage } from './pages/EventsPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { BannersPage } from './pages/BannersPage';
import { InvitationsPage } from './pages/InvitationsPage';
import { EventSettingsPage } from './pages/EventSettingsPage';
import { SystemJobsPage } from './pages/SystemJobsPage';
import { WaitlistPage } from './pages/WaitlistPage';

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
        path="/"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="banners" element={<BannersPage />} />
        <Route path="invitations" element={<InvitationsPage />} />
        <Route path="event-settings" element={<EventSettingsPage />} />
        <Route path="waitlist" element={<WaitlistPage />} />
        <Route path="system" element={<SystemJobsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
