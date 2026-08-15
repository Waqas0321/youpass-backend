import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, AdminEvent, AdminEventsListSummary } from '../api/client';
import { EventListCard } from '../components/events/EventListCard';
import { EventsFilterTabs } from '../components/events/EventsFilterTabs';
import { EventsPageHeader } from '../components/events/EventsPageHeader';
import { EventsSummaryCards } from '../components/events/EventsSummaryCards';
import {
  countEventsByLifecycle,
  filterEventsByLifecycle,
  filterEventsBySearch,
  type EventLifecycleFilter,
} from '../components/events/eventsUtils';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { EventsPagination } from '../components/events/EventsPagination';
import { IconSearch, IconSettings } from '../components/ui/Icons';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { useSelectedEvent } from '../context/SelectedEventContext';
import { useI18n } from '../i18n/useI18n';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function EventsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { setSelectedEventId } = useSelectedEvent();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [listSummary, setListSummary] = useState<AdminEventsListSummary | undefined>();
  const [filter, setFilter] = useState<EventLifecycleFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const lifecycleCounts = useMemo(() => countEventsByLifecycle(events), [events]);

  const filteredEvents = useMemo(() => {
    const byLifecycle = filterEventsByLifecycle(events, filter);
    return filterEventsBySearch(byLifecycle, search);
  }, [events, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filter, search, pageSize]);

  async function load() {
    const eventsResult = await adminApi.events();
    setLoading(false);

    if (!eventsResult.ok) {
      setError(eventsResult.error ?? 'Failed to load events');
      return;
    }

    setEvents(eventsResult.data?.events ?? []);
    setListSummary(eventsResult.data?.summary);
    setError('');
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreateForm() {
    navigate('/events/new/info');
  }

  function editEvent(event: AdminEvent) {
    setSelectedEventId(event.id);
    navigate(`/events/${event.id}/info`);
  }

  function manageEvent(event: AdminEvent) {
    setSelectedEventId(event.id);
  }

  async function togglePublish(event: AdminEvent) {
    const nextStatus = event.status === 'published' ? 'draft' : 'published';
    const result = await adminApi.updateEvent(event.id, { status: nextStatus });
    if (!result.ok) {
      setError(result.error ?? 'Status update failed');
      return;
    }
    setMessage(nextStatus === 'published' ? 'Event published to the app.' : 'Event moved to draft.');
    await load();
  }

  async function removeEvent(event: AdminEvent) {
    const confirmed = window.confirm(`Delete "${event.title}"? This cannot be undone.`);
    if (!confirmed) return;

    const result = await adminApi.deleteEvent(event.id);
    if (!result.ok) {
      setError(result.error ?? 'Delete failed');
      return;
    }
    setMessage('Event deleted.');
    await load();
  }

  if (loading) {
    return <LoadingBlock label={t('eventsPage.loading')} />;
  }

  const paginationFrom = filteredEvents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const paginationTo = Math.min(currentPage * pageSize, filteredEvents.length);

  return (
    <section className="events-page">
      <EventsPageHeader onCreateEvent={openCreateForm} />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <EventsSummaryCards events={events} summary={listSummary} />

      <div className="events-page__filters-row">
        <EventsFilterTabs
          activeFilter={filter}
          counts={lifecycleCounts}
          onFilterChange={setFilter}
        />

        <div className="events-page__toolbar">
          <label className="events-page__search">
            <IconSearch />
            <input
              type="search"
              value={search}
              placeholder={t('eventsPage.searchPlaceholder')}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="button" className="events-page__filters-btn">
            <IconSettings />
            {t('eventsPage.filters')}
          </button>
        </div>
      </div>

      <div className="events-list">
        {paginatedEvents.length === 0 ? (
          <EmptyState title={t('eventsPage.emptyTitle')} description={t('eventsPage.emptyBody')} />
        ) : (
          paginatedEvents.map((event) => (
            <EventListCard
              key={event.id}
              event={event}
              onManage={manageEvent}
              onEdit={editEvent}
              onTogglePublish={togglePublish}
              onDelete={removeEvent}
            />
          ))
        )}
      </div>

      <EventsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        totalItems={filteredEvents.length}
        from={paginationFrom}
        to={paginationTo}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </section>
  );
}
