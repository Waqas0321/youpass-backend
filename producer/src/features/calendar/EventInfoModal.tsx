import type { ReactNode } from 'react';
import { Modal } from '../../components/ui/Modal';
import {
  IconCalendar,
  IconDrink,
  IconUsers,
} from '../../components/ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import { eventCategoryLabel } from '../../i18n/localize';
import { formatEventLongDate } from './formatCalendarDates';
import type { CalendarEvent } from './calendarDemo';
import { formatCount } from '../dashboard/dashboardChartUtils';

type Props = {
  open: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
  onViewPage: (eventId: string) => void;
};

function DetailRow({
  label,
  value,
  highlight = false,
  icon,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="prod-event-info__row">
      <span className="prod-event-info__label">{label}</span>
      <span className={highlight ? 'prod-event-info__value prod-event-info__value--highlight' : 'prod-event-info__value'}>
        {icon ? <span className="prod-event-info__value-with-icon">{icon}{value}</span> : value}
      </span>
    </div>
  );
}

export function EventInfoModal({ open, event, onClose, onViewPage }: Props) {
  const { t, dateLocale, numberLocale } = useI18n();

  if (!event) {
    return null;
  }

  const schedule = `${event.scheduleStart} – ${event.scheduleEnd}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('calendar.eventInfoTitle')}
      closeLabel={t('calendar.closeModal')}
      panelClassName="producer-modal__panel--event-info"
      footer={
        <button
          type="button"
          className="producer-modal__btn producer-modal__btn--primary producer-modal__btn--full"
          onClick={() => onViewPage(event.id)}
        >
          {t('calendar.viewEventPage')}
        </button>
      }
    >
      <div className="prod-event-info">
        <section className="prod-event-info__section">
          <header className="prod-event-info__section-header">
            <IconCalendar className="prod-event-info__section-icon" />
            <h3>{t('calendar.eventDetailsSection')}</h3>
          </header>
          <div className="prod-event-info__rows">
            <DetailRow label={t('calendar.eventNameLabel')} value={event.title} highlight />
            <DetailRow label={t('dashboard.date')} value={formatEventLongDate(event.date, dateLocale)} />
            <DetailRow label={t('calendar.scheduleLabel')} value={schedule} />
            <DetailRow
              label={t('dashboard.category')}
              value={eventCategoryLabel(t, event.categoryTone)}
              icon={<IconDrink className="prod-event-info__inline-icon" />}
            />
            <DetailRow label={t('dashboard.venue')} value={event.venue} />
            <DetailRow label={t('dashboard.producer')} value={event.producer} />
            <DetailRow
              label={t('dashboard.capacity')}
              value={`${formatCount(event.capacity, numberLocale)} ${t('dashboard.people')}`}
            />
            <DetailRow label={t('calendar.addressLabel')} value={event.address} />
          </div>
        </section>

        <section className="prod-event-info__section">
          <header className="prod-event-info__section-header">
            <IconUsers className="prod-event-info__section-icon" />
            <h3>{t('calendar.producersSection')}</h3>
          </header>
          <p className="prod-event-info__producers">{event.producers}</p>
        </section>
      </div>
    </Modal>
  );
}
