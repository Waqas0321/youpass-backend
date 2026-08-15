import { useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearSession } from '../api/client';
import { useSelectedEvent } from '../context/SelectedEventContext';
import { useI18n } from '../i18n/useI18n';
import {
  IconCalendar,
  IconChart,
  IconChevronDown,
  IconCreditCard,
  IconDashboard,
  IconDrink,
  IconLogout,
  IconMail,
  IconMapPin,
  IconPanelLeft,
  IconQrCode,
  IconShoppingBag,
  IconTicket,
} from './ui/Icons';
import { LanguageToggle } from './ui/LanguageToggle';

type NavItem = {
  id: string;
  to: string;
  label: string;
  icon: typeof IconDashboard;
  isActive: (pathname: string) => boolean;
};

function formatEventSelectorDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, dateLocale } = useI18n();
  const { events, eventsLoading, selectedEventId, selectedEvent, setSelectedEventId } = useSelectedEvent();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isDashboard = location.pathname === '/';
  const isAnalytics = location.pathname === '/analytics';
  const hideTopbar = isDashboard || location.pathname === '/events' || location.pathname === '/staff-qr' || isAnalytics;

  const navItems = useMemo((): NavItem[] => {
    const eventBase = selectedEventId ? `/events/${selectedEventId}` : null;
    const eventRoute = (segment: string) => (eventBase ? `${eventBase}/${segment}` : '/events');

    return [
      {
        id: 'home',
        to: '/',
        label: t('adminLayout.home'),
        icon: IconDashboard,
        isActive: (pathname) => pathname === '/',
      },
      {
        id: 'events',
        to: '/events',
        label: t('adminLayout.events'),
        icon: IconCalendar,
        isActive: (pathname) => pathname === '/events',
      },
      {
        id: 'tickets',
        to: eventRoute('tickets'),
        label: t('adminLayout.tickets'),
        icon: IconTicket,
        isActive: (pathname) => /\/events\/[^/]+\/tickets(?:\/|$)/.test(pathname),
      },
      {
        id: 'floor-plan',
        to: eventRoute('floor-plan'),
        label: t('adminLayout.floorPlan'),
        icon: IconMapPin,
        isActive: (pathname) => /\/events\/[^/]+\/floor-plan(?:\/|$)/.test(pathname),
      },
      {
        id: 'menu',
        to: eventRoute('drinks'),
        label: t('adminLayout.menu'),
        icon: IconDrink,
        isActive: (pathname) => /\/events\/[^/]+\/drinks(?:\/|$)/.test(pathname),
      },
      {
        id: 'purchases',
        to: eventRoute('orders'),
        label: t('adminLayout.purchases'),
        icon: IconShoppingBag,
        isActive: (pathname) => /\/events\/[^/]+\/orders(?:\/|$)/.test(pathname),
      },
      {
        id: 'invitations',
        to: eventRoute('invitations'),
        label: t('adminLayout.invitations'),
        icon: IconMail,
        isActive: (pathname) => /\/events\/[^/]+\/invitations(?:\/|$)/.test(pathname),
      },
      {
        id: 'analytics',
        to: eventRoute('analytics'),
        label: t('adminLayout.analytics'),
        icon: IconChart,
        isActive: (pathname) =>
          pathname === '/analytics' || /\/events\/[^/]+\/analytics(?:\/|$)/.test(pathname),
      },
      {
        id: 'staff-qr',
        to: eventRoute('staff-qr'),
        label: t('adminLayout.staffQr'),
        icon: IconQrCode,
        isActive: (pathname) =>
          pathname === '/staff-qr' || /\/events\/[^/]+\/staff-qr(?:\/|$)/.test(pathname),
      },
      {
        id: 'payments',
        to: eventRoute('payments'),
        label: t('adminLayout.payments'),
        icon: IconCreditCard,
        isActive: (pathname) => /\/events\/[^/]+\/payments(?:\/|$)/.test(pathname),
      },
    ];
  }, [selectedEventId, t]);

  const pageTitle =
    t(`adminLayout.pageTitles.${location.pathname}` as 'adminLayout.pageTitles./') ||
    t('adminLayout.dashboard');

  return (
    <div className={`shell ${sidebarCollapsed ? 'shell--collapsed' : ''}`}>
      <aside className="sidebar sidebar--producer">
        <div className="sidebar__brand">YouPass<sup>®</sup></div>

        <label className="sidebar__event-select">
          <span className="sidebar__event-select-label">{t('adminLayout.activeEvent')}</span>
          <div className="sidebar__event-select-control">
            <select
              value={selectedEventId ?? ''}
              disabled={eventsLoading || events.length === 0}
              onChange={(event) => setSelectedEventId(event.target.value)}
            >
              {events.length === 0 ? (
                <option value="">{t('adminLayout.noEvents')}</option>
              ) : (
                events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))
              )}
            </select>
            <IconChevronDown className="sidebar__event-select-chevron" />
          </div>
          {selectedEvent ? (
            <span className="sidebar__event-meta">
              {formatEventSelectorDate(selectedEvent.starts_at, dateLocale)}
              {selectedEvent.venue_name ? ` · ${selectedEvent.venue_name}` : ''}
            </span>
          ) : null}
        </label>

        <nav className="sidebar__nav">
          {navItems.map((link) => {
            const Icon = link.icon;
            const active = link.isActive(location.pathname);
            return (
              <Link
                key={link.id}
                to={link.to}
                className={active ? 'nav-link active' : 'nav-link'}
              >
                <Icon className="nav-link__icon" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <button
            type="button"
            className="sidebar__collapse"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={t('adminLayout.toggleSidebar')}
          >
            <IconPanelLeft />
          </button>
          <button
            className="ghost-btn ghost-btn--full"
            onClick={() => {
              clearSession();
              navigate('/login');
            }}
          >
            <IconLogout className="btn-icon" />
            {t('common.signOut')}
          </button>
        </div>
      </aside>

      <div className="main">
        {!hideTopbar ? (
          <header className="topbar">
            <div>
              <p className="topbar__crumb">{t('common.youpassAdmin')}</p>
              <h2 className="topbar__title">{pageTitle}</h2>
            </div>
            <div className="topbar__actions">
              <LanguageToggle />
              <div className="topbar__status">
                <span className="topbar__status-dot" />
                {t('common.apiConnected')}
              </div>
            </div>
          </header>
        ) : null}
        <main
          className={`content ${isDashboard ? 'content--dashboard' : ''} ${location.pathname === '/staff-qr' ? 'content--staff-qr' : ''} ${isAnalytics ? 'content--analytics' : ''}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
