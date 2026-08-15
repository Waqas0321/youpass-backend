import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { AdminEvent } from '../../api/client';
import { useSelectedEvent } from '../../context/SelectedEventContext';

type Result = {
  eventId: string;
  event: AdminEvent | null;
  loading: boolean;
  notFound: boolean;
};

/**
 * Resolves the current workspace event from SelectedEventContext
 * instead of re-fetching the full events list on every page mount.
 */
export function useEventWorkspaceEvent(): Result {
  const { eventId = '' } = useParams();
  const { events, eventsLoading, setSelectedEventId } = useSelectedEvent();

  const event = useMemo(
    () => (eventId ? (events.find((item) => item.id === eventId) ?? null) : null),
    [events, eventId],
  );

  useEffect(() => {
    if (event) {
      setSelectedEventId(event.id);
    }
  }, [event, setSelectedEventId]);

  return {
    eventId,
    event,
    loading: eventsLoading,
    notFound: !eventsLoading && Boolean(eventId) && !event,
  };
}
