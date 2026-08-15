import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireGuest } from '../auth/RequireAuth';
import { ProducerAppLayout } from '../layouts/ProducerAppLayout';
import { CalendarPage } from '../pages/calendar/CalendarPage';
import { EventsPage } from '../pages/events/EventsPage';
import { HomePage } from '../pages/home/HomePage';
import { LoginPage } from '../pages/login/LoginPage';
import { ProducerRegistrationPage } from '../pages/producer-registration/ProducerRegistrationPage';
import { RegisteredProducersPage } from '../pages/producer-registration/RegisteredProducersPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { UsersPage } from '../pages/users/UsersPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RequireGuest />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProducerAppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="producer-registration" element={<ProducerRegistrationPage />} />
        <Route path="producer-registration/registered" element={<RegisteredProducersPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
