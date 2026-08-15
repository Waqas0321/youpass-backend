import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DashboardSalesPeriod } from '../../api/client';
import { adminApi, clearSession } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { formatTodayDate } from '../../i18n/helpers';
import { IconBell, IconCalendar, IconChevronDown, IconLogout } from '../ui/Icons';
import { LanguageToggle } from '../ui/LanguageToggle';
import {
  DASHBOARD_PERIOD_LABEL_KEYS,
  DASHBOARD_SALES_PERIODS,
  formatMinutesAgo,
  type DashboardActivityItem,
} from './dashboardData';
import { DashboardActivityIcon } from './DashboardActivityIcon';

type DashboardHeaderProps = {
  producerName?: string | null;
  salesPeriod: DashboardSalesPeriod;
  onSalesPeriodChange: (period: DashboardSalesPeriod) => void;
  activityItems: DashboardActivityItem[];
  eventId?: string;
};

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function DashboardHeader({
  producerName,
  salesPeriod,
  onSalesPeriodChange,
  activityItems,
  eventId,
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  const { t, dateLocale } = useI18n();
  const headerRef = useRef<HTMLElement>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [fallbackProducerName, setFallbackProducerName] = useState<string | null>(null);

  useEffect(() => {
    if (producerName?.trim()) {
      return;
    }

    void adminApi.producers().then((result) => {
      const producer = result.data?.producers?.[0];
      if (producer?.name) {
        setFallbackProducerName(producer.name);
      }
    });
  }, [producerName]);

  const displayName = producerName?.trim() || fallbackProducerName || t('dashboard.defaultProducer');
  const initials = useMemo(() => initialsFromName(displayName) || 'YP', [displayName]);

  const periodLabel =
    salesPeriod === 'today'
      ? formatTodayDate(dateLocale, t)
      : t(DASHBOARD_PERIOD_LABEL_KEYS[salesPeriod]);

  const notificationItems = activityItems.slice(0, 5);
  const hasNotifications = notificationItems.length > 0;
  const ordersHref = eventId ? `/events/${eventId}/orders` : '/drink-menus';

  useEffect(() => {
    if (!notifyOpen && !profileOpen && !periodOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setNotifyOpen(false);
        setProfileOpen(false);
        setPeriodOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotifyOpen(false);
        setProfileOpen(false);
        setPeriodOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notifyOpen, profileOpen, periodOpen]);

  const closeMenus = () => {
    setNotifyOpen(false);
    setProfileOpen(false);
    setPeriodOpen(false);
  };

  const handleSignOut = () => {
    closeMenus();
    clearSession();
    navigate('/login');
  };

  return (
    <header ref={headerRef} className="dash-header">
      <div className="dash-header__intro">
        <h1 className="dash-header__title">{t('dashboard.welcome')}</h1>
        <p className="dash-header__subtitle">{t('dashboard.welcomeSubtitle')}</p>
      </div>

      <div className="dash-header__aside">
        <div className="dash-header__toolbar">
          <div className="dash-header__locale">
            <LanguageToggle />
          </div>

          <div className="dash-header__menu-wrap">
            <button
              type="button"
              className={`dash-header__notify ${notifyOpen ? 'dash-header__notify--open' : ''}`}
              aria-label={t('eventWorkspace.notifications')}
              aria-expanded={notifyOpen}
              aria-haspopup="dialog"
              onClick={() => {
                setNotifyOpen((open) => !open);
                setProfileOpen(false);
                setPeriodOpen(false);
              }}
            >
              <IconBell />
              {hasNotifications ? <span className="dash-header__notify-dot" aria-hidden="true" /> : null}
            </button>
            {notifyOpen ? (
              <div className="dash-header__popover dash-header__popover--notify" role="dialog">
                <div className="dash-header__popover-head">
                  <strong>{t('dashboard.notificationsTitle')}</strong>
                  <Link to={ordersHref} className="dash-header__popover-link" onClick={closeMenus}>
                    {t('dashboard.viewAll')}
                  </Link>
                </div>
                {hasNotifications ? (
                  <ul className="dash-header__notify-list">
                    {notificationItems.map((item) => (
                      <li key={item.id} className="dash-header__notify-item">
                        <span className="dash-header__notify-icon">
                          <DashboardActivityIcon type={item.icon} />
                        </span>
                        <div className="dash-header__notify-body">
                          <p>{item.title}</p>
                          {item.subtitle ? <span>{item.subtitle}</span> : null}
                        </div>
                        <span className="dash-header__notify-time">
                          {formatMinutesAgo(item.minutesAgo, dateLocale)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="dash-header__notify-empty">{t('dashboard.notificationsEmpty')}</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="dash-header__menu-wrap">
            <button
              type="button"
              className={`dash-header__profile ${profileOpen ? 'dash-header__profile--open' : ''}`}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              onClick={() => {
                setProfileOpen((open) => !open);
                setNotifyOpen(false);
                setPeriodOpen(false);
              }}
            >
              <span className="dash-header__profile-text">
                <strong>{displayName}</strong>
                <span>{t('common.administrator')}</span>
              </span>
              <span className="dash-header__avatar">{initials}</span>
              <IconChevronDown className="dash-header__chevron" />
            </button>
            {profileOpen ? (
              <ul className="dash-header__popover dash-header__popover--menu" role="menu">
                <li role="none">
                  <button type="button" role="menuitem" className="dash-header__menu-item" onClick={handleSignOut}>
                    <IconLogout className="dash-header__menu-icon" />
                    {t('common.signOut')}
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
        </div>

        <div className="dash-header__menu-wrap dash-header__menu-wrap--date">
          <button
            type="button"
            className={`dash-header__date ${periodOpen ? 'dash-header__date--open' : ''}`}
            aria-haspopup="listbox"
            aria-expanded={periodOpen}
            onClick={() => {
              setPeriodOpen((open) => !open);
              setNotifyOpen(false);
              setProfileOpen(false);
            }}
          >
            <IconCalendar className="dash-header__date-icon" />
            <span>{periodLabel}</span>
            <IconChevronDown className="dash-header__date-chevron" />
          </button>
          {periodOpen ? (
            <ul className="dash-header__popover dash-header__popover--period" role="listbox">
              {DASHBOARD_SALES_PERIODS.map((option) => (
                <li key={option} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={salesPeriod === option}
                    className={`dash-header__menu-item ${salesPeriod === option ? 'is-active' : ''}`}
                    onClick={() => {
                      onSalesPeriodChange(option);
                      setPeriodOpen(false);
                    }}
                  >
                    {option === 'today'
                      ? formatTodayDate(dateLocale, t)
                      : t(DASHBOARD_PERIOD_LABEL_KEYS[option])}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </header>
  );
}
