import { useI18n } from '../../i18n/useI18n';
import type { EventLifecycleFilter } from './eventsUtils';

type EventsFilterTabsProps = {
  activeFilter: EventLifecycleFilter;
  counts: Record<EventLifecycleFilter, number>;
  onFilterChange: (filter: EventLifecycleFilter) => void;
};

const FILTERS: EventLifecycleFilter[] = ['all', 'active', 'upcoming', 'finished', 'drafts'];

const FILTER_LABEL_KEYS: Record<EventLifecycleFilter, 'eventsPage.filterAll' | 'eventsPage.filterActive' | 'eventsPage.filterUpcoming' | 'eventsPage.filterFinished' | 'eventsPage.filterDrafts'> = {
  all: 'eventsPage.filterAll',
  active: 'eventsPage.filterActive',
  upcoming: 'eventsPage.filterUpcoming',
  finished: 'eventsPage.filterFinished',
  drafts: 'eventsPage.filterDrafts',
};

export function EventsFilterTabs({ activeFilter, counts, onFilterChange }: EventsFilterTabsProps) {
  const { t } = useI18n();

  return (
    <div className="events-filter-tabs" role="tablist">
      {FILTERS.map((filter) => (
        <button
          key={filter}
          type="button"
          role="tab"
          aria-selected={activeFilter === filter}
          className={activeFilter === filter ? 'is-active' : undefined}
          onClick={() => onFilterChange(filter)}
        >
          {t(FILTER_LABEL_KEYS[filter])} ({counts[filter]})
        </button>
      ))}
    </div>
  );
}
