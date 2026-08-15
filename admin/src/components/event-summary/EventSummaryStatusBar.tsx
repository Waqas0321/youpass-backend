import type { ReactNode } from 'react';
import { IconCalendar, IconPause, IconPlayCircle } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';

type EventSummaryStatusBarProps = {
  badge: 'active' | 'upcoming' | 'draft' | null;
  dateLabel: string;
  timeLabel: string;
  locationLabel: string;
  capacityLabel: string | null;
  salesPaused: boolean;
  salesToggleDisabled: boolean;
  salesToggleLoading: boolean;
  onToggleSales: () => void;
};

function StatusSegment({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`event-summary__status-segment ${className ?? ''}`.trim()}>
      <span className="event-summary__status-label">{label}</span>
      {children}
    </div>
  );
}

export function EventSummaryStatusBar({
  badge,
  dateLabel,
  timeLabel,
  locationLabel,
  capacityLabel,
  salesPaused,
  salesToggleDisabled,
  salesToggleLoading,
  onToggleSales,
}: EventSummaryStatusBarProps) {
  const { t } = useI18n();

  const statusHint = salesPaused
    ? t('eventSummary.eventStatusPausedHint')
    : badge === 'active'
      ? t('eventSummary.eventStatusActiveHint')
      : badge === 'upcoming'
        ? t('eventSummary.eventStatusUpcomingHint')
        : null;

  return (
    <section className="event-summary__status-bar" aria-label={t('eventSummary.eventStatus')}>
      <div className="event-summary__status-segment event-summary__status-segment--state">
        <span className="event-summary__status-icon" aria-hidden="true">
          <IconCalendar />
        </span>
        <div>
          <span className="event-summary__status-label">{t('eventSummary.eventStatus')}</span>
          {badge ? (
            <strong className={`event-summary__status-value event-summary__status-value--${badge}`}>
              {t(`eventsPage.badge.${badge}`)}
            </strong>
          ) : (
            <strong className="event-summary__status-value">—</strong>
          )}
          {statusHint ? (
            <p
              className={`event-summary__status-hint ${
                salesPaused ? 'event-summary__status-hint--paused' : ''
              }`.trim()}
            >
              {statusHint}
            </p>
          ) : null}
        </div>
      </div>

      <StatusSegment label={t('eventSummary.dateTime')}>
        <strong className="event-summary__status-detail">
          {dateLabel}
          {timeLabel ? ` · ${timeLabel}` : ''}
        </strong>
      </StatusSegment>

      <StatusSegment label={t('eventSummary.location')}>
        <strong className="event-summary__status-detail">{locationLabel || '—'}</strong>
      </StatusSegment>

      <StatusSegment label={t('eventSummary.totalCapacityLabel')}>
        <strong className="event-summary__status-detail">{capacityLabel ?? '—'}</strong>
      </StatusSegment>

      <button
        type="button"
        className={`event-summary__pause-btn ${
          salesPaused ? 'event-summary__pause-btn--paused' : ''
        }`.trim()}
        disabled={salesToggleDisabled || salesToggleLoading}
        onClick={onToggleSales}
        aria-busy={salesToggleLoading}
      >
        {salesPaused ? <IconPlayCircle /> : <IconPause />}
        {salesToggleLoading
          ? t('eventSummary.salesToggleLoading')
          : salesPaused
            ? t('eventSummary.resumeSales')
            : t('eventSummary.pauseSales')}
      </button>
    </section>
  );
}
