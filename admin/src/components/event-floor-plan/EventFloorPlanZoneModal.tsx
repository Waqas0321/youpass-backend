import { useEffect, useState } from 'react';
import { adminApi, type AdminVenueZone } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { EventInfoField } from '../event-info/EventInfoField';
import { Modal } from '../ui/Modal';
import { buildZoneInput, defaultZoneColor } from './eventFloorPlanZoneUtils';

type Props = {
  open: boolean;
  eventId: string;
  zone: AdminVenueZone | null;
  nextDisplayOrder: number;
  onClose: () => void;
  onSaved: () => void;
};

export function EventFloorPlanZoneModal({
  open,
  eventId,
  zone,
  nextDisplayOrder,
  onClose,
  onSaved,
}: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [color, setColor] = useState(defaultZoneColor(0));
  const [capacity, setCapacity] = useState('8');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setColor(defaultZoneColor(nextDisplayOrder));
      setCapacity('8');
      setSaving(false);
      setError('');
      return;
    }

    if (zone) {
      setName(zone.name);
      setColor(zone.color || defaultZoneColor(zone.display_order));
      setCapacity(String(zone.capacity_per_table ?? 8));
    } else {
      setName('');
      setColor(defaultZoneColor(nextDisplayOrder));
      setCapacity('8');
    }
    setError('');
  }, [nextDisplayOrder, open, zone]);

  async function handleSave() {
    if (!name.trim()) {
      setError(t('eventFloorPlan.zonesModal.nameRequired'));
      return;
    }

    const capacityValue = Number(capacity);
    if (!Number.isFinite(capacityValue) || capacityValue <= 0) {
      setError(t('eventFloorPlan.zonesModal.invalidCapacity'));
      return;
    }

    setSaving(true);
    setError('');

    const payload = buildZoneInput({
      name,
      color,
      capacityPerTable: capacityValue,
      displayOrder: zone?.display_order ?? nextDisplayOrder,
    });

    const result = zone
      ? await adminApi.updateVenueZone(eventId, zone.zone_id, {
          name: payload.name,
          color: payload.color,
          capacity_per_table: payload.capacity_per_table,
        })
      : await adminApi.createVenueZone(eventId, payload);

    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? t('eventFloorPlan.zonesModal.saveError'));
      return;
    }

    onSaved();
    onClose();
  }

  const footer = (
    <>
      <button type="button" className="event-floor-plan-zone-modal__cancel" onClick={onClose}>
        {t('eventFloorPlan.zonesModal.cancel')}
      </button>
      <button
        type="button"
        className="event-floor-plan-zone-modal__submit"
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving
          ? t('eventFloorPlan.zonesModal.saving')
          : zone
            ? t('eventFloorPlan.zonesModal.save')
            : t('eventFloorPlan.zonesModal.create')}
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={zone ? t('eventFloorPlan.zonesModal.editTitle') : t('eventFloorPlan.zonesModal.createTitle')}
      subtitle={t('eventFloorPlan.zonesModal.subtitle')}
      closeLabel={t('eventFloorPlan.zonesModal.close')}
      titleId="event-floor-plan-zone-modal-title"
      contentClassName="event-floor-plan-zone-modal"
      backdropClassName="modal__backdrop"
      error={error}
      footer={footer}
    >
      <div className="event-floor-plan-zone-modal__grid">
        <EventInfoField label={t('eventFloorPlan.zonesModal.name')} required>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('eventFloorPlan.zonesModal.namePlaceholder')}
          />
        </EventInfoField>

        <EventInfoField label={t('eventFloorPlan.zonesModal.color')} required>
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </EventInfoField>

        <EventInfoField
          label={t('eventFloorPlan.zonesModal.capacity')}
          hint={t('eventFloorPlan.zonesModal.capacityHint')}
        >
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
        </EventInfoField>
      </div>
    </Modal>
  );
}
