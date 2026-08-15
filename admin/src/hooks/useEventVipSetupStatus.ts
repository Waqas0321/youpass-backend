import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { filterVipZones } from '../components/event-floor-plan/eventFloorPlanZoneUtils';
import type { VipZoneOption } from '../components/event-vip-tables/eventVipTablesData';

export type EventVipSetupStatus = {
  hasMapImage: boolean;
  zoneCount: number;
  tableCount: number;
  layoutConfigured: boolean;
  zones: VipZoneOption[];
  loading: boolean;
};

export function useEventVipSetupStatus(eventId: string, mapImageUrl?: string | null) {
  const [status, setStatus] = useState<EventVipSetupStatus>({
    hasMapImage: Boolean(mapImageUrl),
    zoneCount: 0,
    tableCount: 0,
    layoutConfigured: false,
    zones: [],
    loading: true,
  });

  const reload = useCallback(async () => {
    if (!eventId) {
      setStatus({
        hasMapImage: false,
        zoneCount: 0,
        tableCount: 0,
        layoutConfigured: false,
        zones: [],
        loading: false,
      });
      return;
    }

    setStatus((current) => ({ ...current, loading: true }));

    const [layoutResult, tablesResult] = await Promise.all([
      adminApi.eventVenueLayout(eventId),
      adminApi.eventVipTables(eventId),
    ]);

    const vipZones = filterVipZones(layoutResult.data?.layout?.zones ?? []);
    const zones: VipZoneOption[] = vipZones.map((zone) => ({
      zoneId: zone.zone_id,
      externalId: zone.external_id,
      label: zone.name,
    }));

    const tableCount = tablesResult.ok ? (tablesResult.data?.tables.length ?? 0) : 0;
    const layoutConfigured = Boolean(layoutResult.data?.layout);

    setStatus({
      hasMapImage: Boolean(mapImageUrl),
      zoneCount: zones.length,
      tableCount,
      layoutConfigured,
      zones,
      loading: false,
    });
  }, [eventId, mapImageUrl]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...status, reloadSetup: reload };
}
