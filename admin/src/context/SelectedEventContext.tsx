import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { adminApi, type AdminEvent } from '../api/client';

const STORAGE_KEY = 'youpass-admin-selected-event';

function eventActivityScore(event: AdminEvent) {
  return (event.ticket_order_count ?? 0) + (event.drink_order_count ?? 0);
}

function pickDefaultEventId(events: AdminEvent[]) {
  if (events.length === 0) {
    return null;
  }

  const withActivity = events.filter((event) => eventActivityScore(event) > 0);
  if (withActivity.length > 0) {
    return [...withActivity].sort((left, right) => eventActivityScore(right) - eventActivityScore(left))[0]
      ?.id;
  }

  return events[0]?.id ?? null;
}

type SelectedEventContextValue = {
  events: AdminEvent[];
  eventsLoading: boolean;
  selectedEventId: string | null;
  selectedEvent: AdminEvent | null;
  setSelectedEventId: (eventId: string) => void;
  refreshEvents: () => Promise<void>;
};

const SelectedEventContext = createContext<SelectedEventContextValue | null>(null);

export function SelectedEventProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEventId, setSelectedEventIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  const refreshEvents = useCallback(async () => {
    setEventsLoading(true);
    const result = await adminApi.events();
    setEventsLoading(false);

    if (!result.ok) {
      setEvents([]);
      return;
    }

    const nextEvents = [...(result.data?.events ?? [])].sort(
      (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
    );
    setEvents(nextEvents);

    setSelectedEventIdState((current) => {
      if (current && nextEvents.some((event) => event.id === current)) {
        return current;
      }
      const fallback = pickDefaultEventId(nextEvents) ?? null;
      if (fallback) {
        window.localStorage.setItem(STORAGE_KEY, fallback);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      return fallback;
    });
  }, []);

  useEffect(() => {
    void refreshEvents();
  }, [refreshEvents]);

  const setSelectedEventId = useCallback((eventId: string) => {
    setSelectedEventIdState(eventId);
    window.localStorage.setItem(STORAGE_KEY, eventId);
  }, []);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const value = useMemo(
    () => ({
      events,
      eventsLoading,
      selectedEventId,
      selectedEvent,
      setSelectedEventId,
      refreshEvents,
    }),
    [events, eventsLoading, selectedEventId, selectedEvent, setSelectedEventId, refreshEvents],
  );

  return (
    <SelectedEventContext.Provider value={value}>{children}</SelectedEventContext.Provider>
  );
}

export function useSelectedEvent() {
  const context = useContext(SelectedEventContext);
  if (!context) {
    throw new Error('useSelectedEvent must be used within SelectedEventProvider');
  }
  return context;
}
