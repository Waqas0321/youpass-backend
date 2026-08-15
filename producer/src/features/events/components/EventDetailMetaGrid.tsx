import type { ReactNode } from 'react';
import type { ProducerEvent } from '../types';
import {
  IconCalendar,
  IconDrink,
  IconMapPin,
  IconTicket,
  IconUsers,
} from '../../../components/ui/Icons';
import { useI18n } from '../../../i18n/useI18n';
import { eventCategoryLabel } from '../../../i18n/localize';
import { formatEventLongDate } from '../../calendar/formatCalendarDates';
import { formatCount } from '../../dashboard/dashboardChartUtils';

type Props = {
  event: ProducerEvent;
};

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="prod-event-detail__meta-item">
      <span className="prod-event-detail__meta-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="prod-event-detail__meta-copy">
        <span className="prod-event-detail__meta-label">{label}</span>
        <span className="prod-event-detail__meta-value">{value}</span>
      </div>
    </div>
  );
}

export function EventDetailMetaGrid({ event }: Props) {
  const { t, dateLocale, numberLocale } = useI18n();
  const hoursSuffix = t('dashboard.hoursSuffix');

  return (
    <section className="prod-event-detail__meta">
      <MetaItem icon={<IconUsers />} label={t('eventDetail.name')} value={event.displayTitle} />
      <MetaItem
        icon={<IconDrink />}
        label={t('eventDetail.category')}
        value={
          <span className={`prod-event-detail__badge prod-event-detail__badge--${event.categoryTone}`}>
            {eventCategoryLabel(t, event.categoryTone)}
          </span>
        }
      />
      <MetaItem
        icon={<IconCalendar />}
        label={t('eventDetail.date')}
        value={formatEventLongDate(event.date, dateLocale)}
      />
      <MetaItem
        icon={<IconCalendar />}
        label={t('eventDetail.openingTime')}
        value={`${event.openingTime} ${hoursSuffix}`}
      />
      <MetaItem
        icon={<IconCalendar />}
        label={t('eventDetail.closingTime')}
        value={`${event.closingTime} ${hoursSuffix}`}
      />
      <MetaItem icon={<IconMapPin />} label={t('eventDetail.venue')} value={event.venue} />
      <MetaItem icon={<IconMapPin />} label={t('eventDetail.address')} value={event.address} />
      <MetaItem
        icon={<IconTicket />}
        label={t('eventDetail.eventCapacity')}
        value={`${formatCount(event.capacity, numberLocale)} ${t('dashboard.people')}`}
      />
      <MetaItem icon={<IconUsers />} label={t('eventDetail.producer')} value={event.producer} />
    </section>
  );
}
