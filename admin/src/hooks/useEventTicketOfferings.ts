import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { mapOfferingToTicketRow, type EventTicketRow } from '../components/event-tickets/eventTicketsData';

export function useEventTicketOfferings(eventId: string) {
  const [tickets, setTickets] = useState<EventTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!eventId) {
      setTickets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const result = await adminApi.eventTicketOfferings(eventId);
    if (!result.ok) {
      setTickets([]);
      setError(result.error ?? 'Could not load tickets');
      setLoading(false);
      return;
    }

    const offerings = result.data?.offerings ?? [];
    setTickets(offerings.map((offering, index) => mapOfferingToTicketRow(offering, index)));
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { tickets, loading, error, reload };
}
