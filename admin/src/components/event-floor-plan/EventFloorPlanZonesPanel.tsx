import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type AdminEvent, type AdminVenueZone } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { IconEdit, IconPlus, IconTrash } from '../ui/Icons';
import { LoadingBlock } from '../ui/LoadingBlock';
import { EventFloorPlanZoneModal } from './EventFloorPlanZoneModal';
import { filterVipZones } from './eventFloorPlanZoneUtils';

type Props = {
  eventId: string;
  event: AdminEvent | null;
  onChanged?: () => void;
};

export function EventFloorPlanZonesPanel({ eventId, event, onChanged }: Props) {
  const { t } = useI18n();
  const [zones, setZones] = useState<AdminVenueZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<AdminVenueZone | null>(null);

  const reload = useCallback(async () => {
    if (!eventId) {
      setZones([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const result = await adminApi.eventVenueLayout(eventId);
    setLoading(false);

    if (!result.ok) {
      setZones([]);
      setError(result.error ?? t('eventFloorPlan.zones.loadError'));
      return;
    }

    setZones(filterVipZones(result.data?.layout?.zones ?? []));
  }, [eventId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function ensureVenueLayout() {
    if (!event) {
      return false;
    }

    const existing = await adminApi.eventVenueLayout(eventId);
    if (existing.ok && existing.data?.layout) {
      return true;
    }

    const result = await adminApi.upsertVenueLayout(eventId, {
      venue_name: event.venue_name ?? `${event.title} - Main Hall`,
      width_meters: 36,
      height_meters: 18,
      table_lock_minutes: 10,
    });

    if (!result.ok) {
      setError(result.error ?? t('eventFloorPlan.zones.layoutError'));
      return false;
    }

    return true;
  }

  async function openCreateModal() {
    setError('');
    const ready = await ensureVenueLayout();
    if (!ready) {
      return;
    }

    setEditingZone(null);
    setModalOpen(true);
  }

  function openEditModal(zone: AdminVenueZone) {
    setEditingZone(zone);
    setModalOpen(true);
  }

  async function removeZone(zone: AdminVenueZone) {
    if (!window.confirm(t('eventFloorPlan.zones.deleteConfirm', { name: zone.name }))) {
      return;
    }

    const result = await adminApi.deleteVenueZone(eventId, zone.zone_id);
    if (!result.ok) {
      setError(result.error ?? t('eventFloorPlan.zones.deleteError'));
      return;
    }

    await reload();
    onChanged?.();
  }

  return (
    <section className="event-floor-plan-zones" aria-labelledby="event-floor-plan-zones-title">
      <header className="event-floor-plan-zones__header">
        <div>
          <h2 id="event-floor-plan-zones-title">{t('eventFloorPlan.zones.title')}</h2>
          <p>{t('eventFloorPlan.zones.subtitle')}</p>
        </div>
        <button type="button" className="event-workspace__btn event-workspace__btn--primary" onClick={() => void openCreateModal()}>
          <IconPlus />
          {t('eventFloorPlan.zones.addZone')}
        </button>
      </header>

      {error ? <p className="event-floor-plan-zones__error">{error}</p> : null}

      {loading ? (
        <LoadingBlock label={t('eventFloorPlan.zones.loading')} />
      ) : zones.length === 0 ? (
        <div className="event-floor-plan-zones__empty">
          <p>{t('eventFloorPlan.zones.emptyBody')}</p>
          <button type="button" className="event-workspace__btn event-workspace__btn--ghost" onClick={() => void openCreateModal()}>
            <IconPlus />
            {t('eventFloorPlan.zones.addFirstZone')}
          </button>
        </div>
      ) : (
        <>
          <ul className="event-floor-plan-zones__list">
            {zones.map((zone) => (
              <li key={zone.zone_id} className="event-floor-plan-zones__item">
                <span className="event-floor-plan-zones__swatch" style={{ backgroundColor: zone.color }} aria-hidden />
                <div className="event-floor-plan-zones__copy">
                  <strong>{zone.name}</strong>
                  <small>
                    {t('eventFloorPlan.zones.meta', {
                      tables: String(zone.total_tables),
                      capacity: String(zone.capacity_per_table ?? '—'),
                    })}
                  </small>
                </div>
                <div className="event-floor-plan-zones__actions">
                  <button type="button" className="event-floor-plan-zones__action" onClick={() => openEditModal(zone)}>
                    <IconEdit />
                    <span>{t('eventFloorPlan.zones.edit')}</span>
                  </button>
                  <button type="button" className="event-floor-plan-zones__action event-floor-plan-zones__action--danger" onClick={() => void removeZone(zone)}>
                    <IconTrash />
                    <span>{t('eventFloorPlan.zones.delete')}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <p className="event-floor-plan-zones__next-step">
            {t('eventFloorPlan.zones.nextStep')}{' '}
            <Link to={`/events/${eventId}/vip-tables`}>{t('eventFloorPlan.zones.nextStepLink')}</Link>
          </p>
        </>
      )}

      <EventFloorPlanZoneModal
        open={modalOpen}
        eventId={eventId}
        zone={editingZone}
        nextDisplayOrder={zones.length + 1}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          void reload();
          onChanged?.();
        }}
      />
    </section>
  );
}
