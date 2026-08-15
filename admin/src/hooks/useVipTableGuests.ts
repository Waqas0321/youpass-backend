import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import {
  mapAdminVipTableGuest,
  type EventVipTableRow,
  type VipTableGuest,
} from '../components/event-vip-tables/eventVipTablesData';

export type VipTableGuestBuyer = {
  name: string;
  phone: string;
  avatarInitials: string;
  avatarUrl?: string;
};

export function useVipTableGuests(
  eventId: string,
  table: EventVipTableRow | null,
  open: boolean,
) {
  const [guests, setGuests] = useState<VipTableGuest[]>([]);
  const [buyer, setBuyer] = useState<VipTableGuestBuyer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!open || !table || !eventId) {
      setGuests([]);
      setBuyer(null);
      return;
    }

    setLoading(true);
    setError('');

    const result = await adminApi.eventVipTableGuests(eventId, table.id);
    setLoading(false);

    if (!result.ok) {
      setGuests([]);
      setBuyer(null);
      setError(result.error ?? 'Could not load guests');
      return;
    }

    const payload = result.data!;
    setGuests((payload.guests ?? []).map(mapAdminVipTableGuest));
    setBuyer(
      payload.buyer
        ? {
            name: payload.buyer.name,
            phone: payload.buyer.phone,
            avatarInitials: payload.buyer.avatar_initials,
            avatarUrl: payload.buyer.avatar_url ?? undefined,
          }
        : null,
    );
  }, [eventId, open, table]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const cancelGuest = useCallback(
    async (guestId: string) => {
      if (!table || !eventId || guestId.startsWith('empty-')) {
        return false;
      }

      const result = await adminApi.cancelEventVipTableGuest(eventId, table.id, guestId);
      if (!result.ok) {
        setError(result.error ?? 'Could not cancel guest entry');
        return false;
      }

      await reload();
      return true;
    },
    [eventId, reload, table],
  );

  return { guests, buyer, loading, error, cancelGuest, reloadGuests: reload };
}
