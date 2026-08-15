import { Link, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AdminEvent } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { eventDisplayBadge } from '../events/eventsUtils';
import { IconBell, IconCalendar, IconChevronDown, IconMapPin, IconUsers } from '../ui/Icons';
import { LanguageToggle } from '../ui/LanguageToggle';
import { EVENT_WORKSPACE_NAV } from './eventWorkspaceNav';
import { EventWorkspaceNavLink } from './EventWorkspaceNavLink';
import type { EventWorkspaceDraft } from './eventWorkspaceTypes';

type Props = {
  event: AdminEvent | null;
  children: React.ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
  pageTitleIcon?: ReactNode;
  headerActions?: ReactNode;
  isNewEvent?: boolean;
  draftPreview?: EventWorkspaceDraft;
};

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

export function EventWorkspaceLayout({
  event,
  children,
  pageTitle,
  pageSubtitle,
  pageTitleIcon,
  headerActions,
  isNewEvent = false,
  draftPreview,
}: Props) {
  const { eventId = '' } = useParams();
  const { t, dateLocale } = useI18n();
  const navEventId = isNewEvent ? 'new' : eventId;
  const producerName = event?.producer_name?.trim() || 'Producer';
  const lifecycleBadge = event ? eventDisplayBadge(event) : null;

  const previewTitle =
    event?.title?.trim() ||
    draftPreview?.title?.trim() ||
    (isNewEvent ? t('eventInfo.newEventTitle') : '');
  const previewImage = event?.image_url ?? draftPreview?.image_url;
  const previewStartsAt = event?.starts_at ?? draftPreview?.starts_at;
  const previewVenue = event?.venue_name ?? draftPreview?.venue_name ?? '';
  const previewCity = event?.city ?? draftPreview?.city ?? '';
  const joinedLocation = [previewVenue, previewCity].filter(Boolean).join(', ');
  const previewLocation =
    event?.location_display ??
    (joinedLocation || (isNewEvent ? t('eventInfo.locationPending') : ''));
  const previewCapacity = event?.capacity_total ?? draftPreview?.capacity_total ?? null;
  const showEventCard = Boolean(event) || isNewEvent;

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

        {showEventCard ? (
          <div
            className={`event-workspace__event-card${isNewEvent && !event ? ' event-workspace__event-card--draft' : ''}`}
          >
            {previewImage ? (
              <img src={previewImage} alt="" className="event-workspace__event-image" />
            ) : (
              <div className="event-workspace__event-image event-workspace__event-image--placeholder" />
            )}
            <div className="event-workspace__event-body">
              <div className="event-workspace__event-top">
                <strong>{previewTitle}</strong>
                {lifecycleBadge ? (
                  <span
                    className={`event-workspace__event-badge event-workspace__event-badge--${lifecycleBadge}`}
                  >
                    {t(`eventsPage.badge.${lifecycleBadge}`)}
                  </span>
                ) : (
                  <span className="event-workspace__event-badge event-workspace__event-badge--draft">
                    {t('eventsPage.badge.draft')}
                  </span>
                )}
              </div>
              {previewStartsAt ? (
                <p className="event-workspace__event-meta">
                  <IconCalendar className="event-workspace__event-meta-icon" />
                  <span>
                    {formatEventDate(previewStartsAt)} · {formatEventTime(previewStartsAt)} hrs
                  </span>
                </p>
              ) : isNewEvent ? (
                <p className="event-workspace__event-meta muted">
                  <IconCalendar className="event-workspace__event-meta-icon" />
                  <span>{t('eventInfo.schedulePending')}</span>
                </p>
              ) : null}
              {previewLocation ? (
                <p className="event-workspace__event-meta muted">
                  <IconMapPin className="event-workspace__event-meta-icon" />
                  <span>{previewLocation}</span>
                </p>
              ) : null}
              {previewCapacity ? (
                <p className="event-workspace__event-meta muted">
                  <IconUsers className="event-workspace__event-meta-icon" />
                  <span>
                    {t('eventSummary.totalCapacityLabel')}:{' '}
                    {new Intl.NumberFormat(dateLocale).format(previewCapacity)}
                  </span>
                </p>
              ) : isNewEvent ? (
                <p className="event-workspace__event-meta muted">
                  <IconUsers className="event-workspace__event-meta-icon" />
                  <span>{t('eventInfo.capacityPending')}</span>
                </p>
              ) : null}
              {event && !isNewEvent ? (
                <Link
                  to={`/events/${eventId}/summary`}
                  className="outline-btn outline-btn--sm event-workspace__summary-btn"
                >
                  {t('eventWorkspace.viewEventSummary')}
                </Link>
              ) : (
                <span className="outline-btn outline-btn--sm event-workspace__summary-btn event-workspace__summary-btn--disabled">
                  {t('eventWorkspace.viewEventSummary')}
                </span>
              )}
            </div>
          </div>
        ) : null}

        <nav className="event-workspace__nav">
          {EVENT_WORKSPACE_NAV.map((item) => {
            const locked = isNewEvent ? item.key !== 'info' : !item.enabled;

            return (
              <EventWorkspaceNavLink
                key={item.key}
                eventId={navEventId}
                route={item.route}
                navKey={item.key}
                locked={locked}
                icon={<item.Icon className="event-workspace__nav-icon" />}
              />
            );
          })}
        </nav>
      </aside>

      <div className="event-workspace__content">
        <header className={`event-workspace__page-header${pageTitle ? '' : ' event-workspace__page-header--actions-only'}${headerActions ? ' event-workspace__page-header--with-actions' : ''}`}>
          {pageTitle || pageSubtitle ? (
            <div className="event-workspace__page-intro">
              {pageTitle ? (
                <h1 className="event-workspace__page-title">
                  {pageTitleIcon ? (
                    <span className="event-workspace__page-title-icon">{pageTitleIcon}</span>
                  ) : null}
                  <span>{pageTitle}</span>
                </h1>
              ) : null}
              {pageSubtitle ? <p className="event-workspace__page-subtitle">{pageSubtitle}</p> : null}
            </div>
          ) : null}
          <div className="event-workspace__topbar-row">
            <LanguageToggle />
            <button type="button" className="event-workspace__icon-btn" aria-label={t('eventWorkspace.notifications')}>
              <IconBell />
            </button>
            <div className="event-workspace__profile event-workspace__profile--rich">
              <span className="event-workspace__avatar">{producerInitials(producerName)}</span>
              <div>
                <strong>{producerName}</strong>
                <p>{t('common.administrator')}</p>
              </div>
              <IconChevronDown className="event-workspace__profile-chevron" />
            </div>
          </div>
          {headerActions ? (
            <div className="event-workspace__header-actions">{headerActions}</div>
          ) : null}
        </header>

        <main className="event-workspace__main">{children}</main>
      </div>
    </div>
  );
}
