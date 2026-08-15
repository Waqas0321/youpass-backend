import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { AdminEvent } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import {
  IconCalendar,
  IconChart,
  IconChevronRight,
  IconClock,
  IconMapPin,
  IconMoreVertical,
} from '../ui/Icons';
import {
  eventDisplayBadge,
  formatEventCapacityPct,
  truncateDescription,
} from './eventsUtils';

type EventListCardProps = {
  event: AdminEvent;
  onManage: (event: AdminEvent) => void;
  onEdit: (event: AdminEvent) => void;
  onTogglePublish: (event: AdminEvent) => void;
  onDelete: (event: AdminEvent) => void;
};

function formatRevenue(value: number, locale: string, currency = 'CLP') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTimeLabel(iso: string, dateLocale: string) {
  return new Intl.DateTimeFormat(dateLocale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function EventListCard({
  event,
  onManage,
  onEdit,
  onTogglePublish,
  onDelete,
}: EventListCardProps) {
  const { t, numberLocale, dateLocale } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);
  const badge = eventDisplayBadge(event);
  const isDraft = event.status === 'draft';
  const ticketsSold = event.tickets_sold ?? 0;
  const capacityTotal = event.capacity_total;
  const capacityAvailable = event.capacity_available;
  const capacityPct = formatEventCapacityPct(ticketsSold, capacityTotal);
  const totalRevenue = event.total_revenue_clp ?? 0;
  const revenueDelta = event.revenue_delta_pct ?? 0;
  const hasCapacity = capacityTotal !== null && capacityTotal !== undefined && capacityTotal > 0;

  const dateLabel = new Intl.DateTimeFormat(dateLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(event.starts_at));

  const timeLabel = formatTimeLabel(event.starts_at, dateLocale);

  const locationLabel =
    event.venue_name && event.city
      ? `${event.venue_name}, ${event.city}`
      : (event.location_display ?? event.city ?? event.venue_name ?? '—');

  const ticketsValue = isDraft ? '—' : new Intl.NumberFormat(numberLocale).format(ticketsSold);

  const revenueValue = isDraft ? '—' : formatRevenue(totalRevenue, numberLocale, event.currency_code);

  const capacityValue =
    isDraft || !hasCapacity ? '—' : new Intl.NumberFormat(numberLocale).format(capacityTotal);

  const ticketsHint = isDraft
    ? t('eventsPage.notConfigured')
    : capacityPct !== null
      ? t('eventsPage.capacityPct', { value: String(capacityPct) })
      : t('eventsPage.noCapacityData');

  const revenueHint = isDraft
    ? t('eventsPage.notConfigured')
    : totalRevenue > 0
      ? t('eventsPage.revenueDelta', {
          value: `${revenueDelta >= 0 ? '+' : ''}${revenueDelta}`,
        })
      : t('eventsPage.noRevenueYet');

  const capacityHint = isDraft
    ? t('eventsPage.notConfigured')
    : !hasCapacity
      ? t('eventsPage.notConfigured')
      : capacityAvailable !== null && capacityAvailable !== undefined
        ? t('eventsPage.availableCapacity', {
            value: new Intl.NumberFormat(numberLocale).format(capacityAvailable),
          })
        : t('eventsPage.noCapacityData');

  return (
    <article className={`events-list-card ${isDraft ? 'events-list-card--draft' : ''}`}>
      <div className="events-list-card__media">
        {event.image_url && !imageFailed ? (
          <img src={event.image_url} alt="" onError={() => setImageFailed(true)} />
        ) : (
          <div className="events-list-card__media-placeholder" />
        )}
      </div>

      <div className="events-list-card__main">
        <div className="events-list-card__title-row">
          <h3>{event.title}</h3>
          {badge ? (
            <span className={`events-list-card__badge events-list-card__badge--${badge}`}>
              {t(`eventsPage.badge.${badge}`)}
            </span>
          ) : null}
        </div>

        <ul className="events-list-card__meta">
          <li>
            <IconCalendar />
            <span>{dateLabel}</span>
          </li>
          <li>
            <IconClock />
            <span>{timeLabel}</span>
          </li>
          <li>
            <IconMapPin />
            <span>{locationLabel}</span>
          </li>
        </ul>

        {event.description ? (
          <p className="events-list-card__description">{truncateDescription(event.description, 140)}</p>
        ) : null}
      </div>

      <div className="events-list-card__metrics">
        <div className="events-list-card__metric">
          <span className="events-list-card__metric-label">{t('eventsPage.ticketsSold')}</span>
          <strong>{ticketsValue}</strong>
          <small>{ticketsHint}</small>
        </div>
        <div className="events-list-card__metric">
          <span className="events-list-card__metric-label">{t('eventsPage.totalRevenue')}</span>
          <strong>{revenueValue}</strong>
          <small
            className={
              !isDraft && totalRevenue > 0 && revenueDelta >= 0
                ? 'events-list-card__metric-hint--positive'
                : undefined
            }
          >
            {revenueHint}
          </small>
        </div>
        <div className="events-list-card__metric">
          <span className="events-list-card__metric-label">{t('eventsPage.capacity')}</span>
          <strong>{capacityValue}</strong>
          <small>{capacityHint}</small>
        </div>
      </div>

      <div className="events-list-card__actions">
        {isDraft ? (
          <Link
            to={`/events/${event.id}/info`}
            className="events-list-card__manage"
            onClick={() => onEdit(event)}
          >
            <span>{t('eventsPage.continueEditing')}</span>
            <IconChevronRight />
          </Link>
        ) : (
          <Link
            to={`/events/${event.id}/summary`}
            className="events-list-card__manage"
            onClick={() => onManage(event)}
          >
            <span>{t('eventsPage.manage')}</span>
            <IconChevronRight />
          </Link>
        )}
        {!isDraft ? (
          <Link to={`/events/${event.id}/analytics`} className="events-list-card__analytics">
            <IconChart />
            {t('eventsPage.analytics')}
          </Link>
        ) : null}
        <details className="events-list-card__menu">
          <summary aria-label={t('eventsPage.moreActions')}>
            <IconMoreVertical />
          </summary>
          <div className="events-list-card__menu-panel">
            <button type="button" onClick={() => onEdit(event)}>
              {t('eventsPage.editEvent')}
            </button>
            <button type="button" onClick={() => onTogglePublish(event)}>
              {event.status === 'published' ? t('eventsPage.unpublish') : t('eventsPage.publish')}
            </button>
            <button type="button" className="is-danger" onClick={() => onDelete(event)}>
              {t('eventsPage.deleteEvent')}
            </button>
          </div>
        </details>
      </div>
    </article>
  );
}
