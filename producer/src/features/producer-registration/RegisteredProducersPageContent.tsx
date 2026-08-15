import { useMemo, useState } from 'react';
import { ProducerPageActions } from '../../components/layout/ProducerPageActions';
import { IconChevronDown, IconSearch } from '../../components/ui/Icons';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useI18n } from '../../i18n/useI18n';
import { formatDateRangeLabel } from '../calendar/formatCalendarDates';
import { RegisteredProducerCard } from './RegisteredProducerCard';
import { ProducerInfoModal } from './ProducerInfoModal';
import {
  filterRegisteredProducers,
  REGISTERED_PRODUCERS_DATE_RANGE,
  registeredProducersCatalog,
} from './registeredProducersDemo';

export function RegisteredProducersPageContent() {
  const { locale, t, dateLocale } = useI18n();
  const [query, setQuery] = useState('');
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null);

  const dateRangeLabel = useMemo(
    () =>
      formatDateRangeLabel(
        REGISTERED_PRODUCERS_DATE_RANGE.start,
        REGISTERED_PRODUCERS_DATE_RANGE.end,
        dateLocale,
      ),
    [dateLocale],
  );

  const producers = useMemo(
    () => filterRegisteredProducers(registeredProducersCatalog, query),
    [query],
  );

  const selectedProducer = useMemo(
    () => registeredProducersCatalog.find((producer) => producer.id === selectedProducerId) ?? null,
    [selectedProducerId],
  );

  useDocumentTitle('registeredProducers');

  return (
    <section className="prod-reg-list-page" key={locale}>
      <header className="prod-reg-list-page__header">
        <div className="prod-reg-list-page__intro">
          <h1>{t('registeredProducers.title')}</h1>
          <p>{t('registeredProducers.subtitle')}</p>
        </div>
        <ProducerPageActions dateRangeLabel={dateRangeLabel} />
      </header>

      <label className="prod-reg-list-search">
        <IconSearch className="prod-reg-list-search__icon" aria-hidden="true" />
        <span className="prod-reg-list-search__label">{t('registeredProducers.searchAriaLabel')}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('registeredProducers.searchPlaceholder')}
          aria-label={t('registeredProducers.searchAriaLabel')}
        />
      </label>

      {producers.length === 0 ? (
        <p className="prod-reg-list-page__empty">{t('registeredProducers.noResults')}</p>
      ) : (
        <>
          <div className="prod-reg-list-grid">
            {producers.map((producer) => (
              <RegisteredProducerCard
                key={producer.id}
                producer={producer}
                onViewInfo={setSelectedProducerId}
              />
            ))}
          </div>

          {producers.length > 4 ? (
            <p className="prod-reg-list-page__more">
              <IconChevronDown className="prod-reg-list-page__more-icon" aria-hidden="true" />
              <span>{t('registeredProducers.moreRegistered')}</span>
            </p>
          ) : null}
        </>
      )}

      <ProducerInfoModal
        open={selectedProducerId !== null}
        producer={selectedProducer}
        onClose={() => setSelectedProducerId(null)}
      />
    </section>
  );
}
