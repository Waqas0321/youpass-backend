import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { EventDetailModal } from './EventDetailModal';

type EventDetailModalContextValue = {
  openEventDetail: (eventId: string) => void;
  closeEventDetail: () => void;
};

const EventDetailModalContext = createContext<EventDetailModalContextValue | null>(null);

export function EventDetailModalProvider({ children }: { children: ReactNode }) {
  const [eventId, setEventId] = useState<string | null>(null);

  const openEventDetail = useCallback((id: string) => {
    setEventId(id);
  }, []);

  const closeEventDetail = useCallback(() => {
    setEventId(null);
  }, []);

  const value = useMemo(
    () => ({ openEventDetail, closeEventDetail }),
    [openEventDetail, closeEventDetail],
  );

  return (
    <EventDetailModalContext.Provider value={value}>
      {children}
      <EventDetailModal open={eventId !== null} eventId={eventId} onClose={closeEventDetail} />
    </EventDetailModalContext.Provider>
  );
}

export function useEventDetailModal() {
  const context = useContext(EventDetailModalContext);
  if (!context) {
    throw new Error('useEventDetailModal must be used within EventDetailModalProvider');
  }
  return context;
}
