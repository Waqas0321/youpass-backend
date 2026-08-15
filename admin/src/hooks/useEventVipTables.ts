import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import {
  extractVipZones,
  mapAdminVipTableRow,
  type EventVipTableRow,
  type VipZoneOption,
} from '../components/event-vip-tables/eventVipTablesData';
import { filterVipZones } from '../components/event-floor-plan/eventFloorPlanZoneUtils';

function mapLayoutZones(zones: ReturnType<typeof filterVipZones>): VipZoneOption[] {
  return zones.map((zone) => ({
    zoneId: zone.zone_id,
    externalId: zone.external_id,
    label: zone.name,
  }));
}

export function useEventVipTables(eventId: string) {
  const [tables, setTables] = useState<EventVipTableRow[]>([]);
  const [currency, setCurrency] = useState('CLP');
  const [layoutConfigured, setLayoutConfigured] = useState(false);
  const [zones, setZones] = useState<VipZoneOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [ensuringLayout, setEnsuringLayout] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!eventId) {
      setTables([]);
      setZones([]);
      setLayoutConfigured(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const [tablesResult, layoutResult] = await Promise.all([
      adminApi.eventVipTables(eventId),
      adminApi.eventVenueLayout(eventId),
    ]);

    if (!tablesResult.ok) {
      setTables([]);
      setZones([]);
      setLayoutConfigured(false);
      setError(tablesResult.error ?? 'Could not load VIP tables');
      setLoading(false);
      return;
    }

    const payload = tablesResult.data!;
    const nextCurrency = payload.currency || 'CLP';
    const rows = payload.tables.map((row) => mapAdminVipTableRow(row, nextCurrency));
    const layoutZones = mapLayoutZones(filterVipZones(layoutResult.data?.layout?.zones ?? []));
    const nextZones = layoutZones.length > 0 ? layoutZones : extractVipZones(rows);

    setCurrency(nextCurrency);
    setLayoutConfigured(payload.layout_configured || layoutZones.length > 0);
    setTables(rows);
    setZones(nextZones);
    setLoading(false);
  }, [eventId]);

  const ensureLayout = useCallback(async () => {
    if (!eventId) {
      return false;
    }

    setEnsuringLayout(true);
    setError('');

    const result = await adminApi.ensureEventVipLayout(eventId);
    setEnsuringLayout(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not set up VIP layout');
      return false;
    }

    await reload();
    return true;
  }, [eventId, reload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const zonesReady = zones.length > 0;

  return {
    tables,
    currency,
    layoutConfigured,
    zonesReady,
    zones,
    loading,
    ensuringLayout,
    error,
    reload,
    ensureLayout,
  };
}
