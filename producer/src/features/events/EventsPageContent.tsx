import { useMemo, useState } from 'react';
import { ProducerPageActions } from '../../components/layout/ProducerPageActions';
import { IconSearch } from '../../components/ui/Icons';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useI18n } from '../../i18n/useI18n';
import { formatDateRangeLabel } from '../calendar/formatCalendarDates';
import { producerEventCatalog } from './eventCatalog';
import { EventListCard } from './EventListCard';
import { useEventDetailModal } from './EventDetailModalProvider';
import {
  EVENTS_LIST_DATE_RANGE,
  filterProducerEvents,
  sortProducerEventsByDate,
} from './eventsListUtils';

export function EventsPageContent() {
  const { openEventDetail } = useEventDetailModal();
  const { t, dateLocale } = useI18n();
  const [query, setQuery] = useState('');

  const dateRangeLabel = useMemo(
    () => formatDateRangeLabel(EVENTS_LIST_DATE_RANGE.start, EVENTS_LIST_DATE_RANGE.end, dateLocale),
    [dateLocale],
  );

  const events = useMemo(() => {
    const sorted = sortProducerEventsByDate(producerEventCatalog);
    return filterProducerEvents(sorted, query, dateLocale);
  }, [dateLocale, query]);

  useDocumentTitle('events');

  return (
    <section className="prod-events-page">
      <header className="prod-events-page__header">
        <div className="prod-events-page__intro">
          <h1>{t('events.title')}</h1>
          <p>{t('events.subtitle')}</p>
        </div>
        <ProducerPageActions dateRangeLabel={dateRangeLabel} />
      </header>

      <label className="prod-events-search">
        <IconSearch className="prod-events-search__icon" aria-hidden="true" />
        <span className="prod-events-search__label">{t('events.searchAriaLabel')}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('events.searchPlaceholder')}
          aria-label={t('events.searchAriaLabel')}
        />
      </label>

      {events.length === 0 ? (
        <p className="prod-events-page__empty">{t('events.noResults')}</p>
      ) : (
        <div className="prod-events-grid">
          {events.map((event) => (
            <EventListCard
              key={event.id}
              event={event}
              onViewInfo={openEventDetail}
            />
          ))}
        </div>
      )}
    </section>
  );
}
