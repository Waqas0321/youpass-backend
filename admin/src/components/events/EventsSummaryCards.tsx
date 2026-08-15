import type { ComponentType } from 'react';
import type { AdminEvent, AdminEventsListSummary } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import {
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconPlayCircle,
} from '../ui/Icons';
import { countEventsByLifecycle } from './eventsUtils';

type EventsSummaryCardsProps = {
  events: AdminEvent[];
  summary?: AdminEventsListSummary;
};

type SummaryCardConfig = {
  label: string;
  value: string;
  hint: string;
  hintTone: 'positive' | 'muted';
  Icon: ComponentType<{ className?: string }>;
};

export function EventsSummaryCards({ events, summary }: EventsSummaryCardsProps) {
  const { t } = useI18n();
  const lifecycleCounts = countEventsByLifecycle(events);
  const createdThisMonth = summary?.created_this_month ?? 0;

  const cards: SummaryCardConfig[] = [
    {
      label: t('eventsPage.kpiTotalEvents'),
      value: String(summary?.total_events ?? events.length),
      hint: t('eventsPage.kpiTotalEventsHint', { count: String(createdThisMonth) }),
      hintTone: createdThisMonth > 0 ? 'positive' : 'muted',
      Icon: IconCalendar,
    },
    {
      label: t('eventsPage.kpiActiveEvents'),
      value: String(lifecycleCounts.active),
      hint: t('eventsPage.kpiActiveEventsHint'),
      hintTone: lifecycleCounts.active > 0 ? 'positive' : 'muted',
      Icon: IconPlayCircle,
    },
    {
      label: t('eventsPage.kpiUpcomingEvents'),
      value: String(lifecycleCounts.upcoming),
      hint: t('eventsPage.kpiUpcomingEventsHint'),
      hintTone: 'muted',
      Icon: IconClock,
    },
    {
      label: t('eventsPage.kpiFinishedEvents'),
      value: String(lifecycleCounts.finished),
      hint: t('eventsPage.kpiFinishedEventsHint'),
      hintTone: 'muted',
      Icon: IconCheckCircle,
    },
  ];

  return (
    <div className="events-summary-grid">
      {cards.map((card) => {
        const Icon = card.Icon;
        return (
          <article key={card.label} className="events-summary-card">
            <span className="events-summary-card__icon" aria-hidden="true">
              <Icon />
            </span>
            <div className="events-summary-card__body">
              <p className="events-summary-card__label">{card.label}</p>
              <strong className="events-summary-card__value">{card.value}</strong>
              <span
                className={`events-summary-card__hint events-summary-card__hint--${card.hintTone}`}
              >
                {card.hint}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
