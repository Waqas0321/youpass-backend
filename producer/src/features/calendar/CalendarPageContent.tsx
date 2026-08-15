import { useCallback, useMemo, useState } from 'react';
import { ProducerPageActions } from '../../components/layout/ProducerPageActions';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useEventDetailModal } from '../../features/events/EventDetailModalProvider';
import { useI18n } from '../../i18n/useI18n';
import { CalendarLegend } from './CalendarLegend';
import { CalendarMonthGrid } from './CalendarMonthGrid';
import { CalendarToolbar } from './CalendarToolbar';
import { producerCalendarDemo } from './calendarDemo';
import { formatDateRangeLabel } from './formatCalendarDates';
import { EventInfoModal } from './EventInfoModal';
import { RescheduleEventModal } from './RescheduleEventModal';
import { addMonths } from './calendarUtils';

export function CalendarPageContent() {
  const { openEventDetail } = useEventDetailModal();
  const { t, dateLocale } = useI18n();
  const demo = producerCalendarDemo;
  const dateRangeLabel = useMemo(
    () => formatDateRangeLabel(demo.dateRangeStart, demo.dateRangeEnd, dateLocale),
    [dateLocale, demo.dateRangeEnd, demo.dateRangeStart],
  );
  const [events, setEvents] = useState(demo.events);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [infoEvent, setInfoEvent] = useState<typeof events[number] | null>(null);
  const [view, setView] = useState({
    year: demo.initialYear,
    month: demo.initialMonth,
  });

  useDocumentTitle('calendar');

  const goToToday = useCallback(() => {
    const today = new Date();
    setView({ year: today.getFullYear(), month: today.getMonth() });
  }, []);

  const goPrevious = useCallback(() => {
    setView((current) => addMonths(current.year, current.month, -1));
  }, []);

  const goNext = useCallback(() => {
    setView((current) => addMonths(current.year, current.month, 1));
  }, []);

  const monthEvents = useMemo(
    () =>
      events.filter((event) => {
        const date = new Date(`${event.date}T00:00:00`);
        return date.getFullYear() === view.year && date.getMonth() === view.month;
      }),
    [events, view.month, view.year],
  );

  function handleRescheduleSave(eventId: string, newDate: string) {
    setEvents((current) =>
      current.map((event) => (event.id === eventId ? { ...event, date: newDate } : event)),
    );
  }

  return (
    <section className="prod-cal-page">
      <header className="prod-cal-page__header">
        <div className="prod-cal-page__intro">
          <h1>{t('calendar.title')}</h1>
          <p>{t('calendar.subtitle')}</p>
        </div>
        <ProducerPageActions dateRangeLabel={dateRangeLabel} />
      </header>

      <CalendarToolbar
        year={view.year}
        month={view.month}
        onPrevious={goPrevious}
        onNext={goNext}
        onToday={goToToday}
        onReschedule={() => setRescheduleOpen(true)}
      />

      <CalendarMonthGrid
        year={view.year}
        month={view.month}
        events={monthEvents}
        onViewEvent={setInfoEvent}
      />
      <CalendarLegend />

      <RescheduleEventModal
        open={rescheduleOpen}
        events={events}
        onClose={() => setRescheduleOpen(false)}
        onSave={handleRescheduleSave}
      />

      <EventInfoModal
        open={infoEvent !== null}
        event={infoEvent}
        onClose={() => setInfoEvent(null)}
        onViewPage={(eventId) => {
          setInfoEvent(null);
          openEventDetail(eventId);
        }}
      />
    </section>
  );
}
