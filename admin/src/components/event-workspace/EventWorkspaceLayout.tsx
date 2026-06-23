import { Link, NavLink, useParams } from 'react-router-dom';
import { AdminEvent } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { IconBell } from '../ui/Icons';
import { LanguageToggle } from '../ui/LanguageToggle';
import { StatusPill } from '../ui/StatusPill';

type Props = {
  event: AdminEvent | null;
  children: React.ReactNode;
};

const navKeys = [
  { to: 'summary', key: 'summary', disabled: true },
  { to: 'info', key: 'info', disabled: true },
  { to: 'drinks', key: 'drinks', disabled: false },
  { to: 'tickets', key: 'tickets', disabled: true },
  { to: 'floor-plan', key: 'floorPlan', disabled: true },
  { to: 'vip-tables', key: 'vipTables', disabled: true },
  { to: 'orders', key: 'orders', disabled: false },
  { to: 'staff-qr', key: 'staffQr', disabled: true },
  { to: 'analytics', key: 'analytics', disabled: true },
  { to: 'invitations', key: 'invitations', disabled: true },
  { to: 'payments', key: 'payments', disabled: true },
  { to: 'settings', key: 'settings', disabled: true },
] as const;

function producerInitials(name?: string | null) {
  if (!name?.trim()) {
    return 'YP';
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function EventWorkspaceLayout({ event, children }: Props) {
  const { eventId } = useParams();
  const { t, dateLocale } = useI18n();
  const producerName = event?.producer_name?.trim() || 'Producer';

  function formatEventDate(iso: string) {
    return new Intl.DateTimeFormat(dateLocale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  }

  function formatEventTime(iso: string) {
    return new Intl.DateTimeFormat(dateLocale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: dateLocale !== 'es-CL',
    }).format(new Date(iso));
  }

  return (
    <div className="event-workspace">
      <aside className="event-workspace__sidebar">
        <div className="event-workspace__brand">YouPass</div>

        <Link to="/events" className="event-workspace__back">
          ← {t('eventWorkspace.backToEvents')}
        </Link>

        {event ? (
          <div className="event-workspace__event-card">
            {event.image_url ? (
              <img src={event.image_url} alt="" className="event-workspace__event-image" />
            ) : (
              <div className="event-workspace__event-image event-workspace__event-image--placeholder" />
            )}
            <div className="event-workspace__event-body">
              <div className="event-workspace__event-top">
                <strong>{event.title}</strong>
                <StatusPill
                  label={event.status ?? 'draft'}
                  tone={event.status === 'published' ? 'success' : 'neutral'}
                />
              </div>
              <p>
                {formatEventDate(event.starts_at)} · {formatEventTime(event.starts_at)}
              </p>
              <p className="muted">
                {event.location_display ?? `${event.venue_name ?? 'Venue'}, ${event.city}`}
              </p>
              <button type="button" className="outline-btn outline-btn--sm event-workspace__summary-btn" disabled>
                {t('eventWorkspace.viewEventSummary')}
              </button>
            </div>
          </div>
        ) : null}

        <nav className="event-workspace__nav">
          {navKeys.map((item) =>
            item.disabled ? (
              <span key={item.key} className="event-workspace__nav-link event-workspace__nav-link--disabled">
                {t(`eventWorkspace.nav.${item.key}`)}
              </span>
            ) : (
              <NavLink
                key={item.key}
                to={`/events/${eventId}/${item.to}`}
                className={({ isActive }) =>
                  isActive
                    ? 'event-workspace__nav-link event-workspace__nav-link--active'
                    : 'event-workspace__nav-link'
                }
              >
                {t(`eventWorkspace.nav.${item.key}`)}
              </NavLink>
            ),
          )}
        </nav>
      </aside>

      <div className="event-workspace__content">
        <header className="event-workspace__topbar">
          <div className="event-workspace__topbar-spacer" />
          <div className="event-workspace__topbar-actions">
            <LanguageToggle />
            <button type="button" className="event-workspace__icon-btn" aria-label={t('eventWorkspace.notifications')}>
              <IconBell />
            </button>
            <div className="event-workspace__profile">
              <span className="event-workspace__avatar">{producerInitials(producerName)}</span>
              <div>
                <strong>{producerName}</strong>
                <p>{t('common.administrator')}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="event-workspace__main">{children}</main>
      </div>
    </div>
  );
}
