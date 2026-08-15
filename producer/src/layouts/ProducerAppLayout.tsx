import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { isAuthenticated, clearSession } from '../auth/session';
import { ProducerSidebar } from '../components/sidebar/ProducerSidebar';
import { LanguageToggle } from '../components/ui/LanguageToggle';
import { IconLogout } from '../components/ui/Icons';
import { EventDetailModalProvider } from '../features/events/EventDetailModalProvider';
import { useI18n } from '../i18n/useI18n';

function ProducerUtilityBar() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <header className="producer-topbar">
      <div className="producer-topbar__actions">
        <LanguageToggle />
        <button
          type="button"
          className="producer-topbar__sign-out"
          onClick={() => {
            clearSession();
            navigate('/login');
          }}
        >
          <IconLogout />
          <span>{t('common.signOut')}</span>
        </button>
      </div>
    </header>
  );
}

export function ProducerAppLayout() {
  const location = useLocation();
  const hideUtilityBar =
    location.pathname === '/' ||
    location.pathname === '/calendar' ||
    location.pathname === '/events' ||
    location.pathname === '/users' ||
    location.pathname === '/reports' ||
    location.pathname === '/producer-registration' ||
    location.pathname.startsWith('/producer-registration/');

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="producer-shell">
      <ProducerSidebar />
      <div className="producer-shell__main">
        {!hideUtilityBar ? <ProducerUtilityBar /> : null}
        <div className="producer-shell__content">
          <EventDetailModalProvider>
            <Outlet />
          </EventDetailModalProvider>
        </div>
      </div>
    </div>
  );
}
