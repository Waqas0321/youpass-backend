import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { EventInfoField } from '../event-info/EventInfoField';
import { Modal } from '../ui/Modal';
import type { EventVipTableRow, VipZoneOption } from './eventVipTablesData';

type Props = {
  open: boolean;
  eventId: string;
  table: EventVipTableRow | null;
  zones: VipZoneOption[];
  onClose: () => void;
  onSaved: () => void;
};

export function EventVipTableMoveModal({ open, eventId, table, zones, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [zoneId, setZoneId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const targetZones = useMemo(
    () => zones.filter((zone) => zone.zoneId !== table?.zoneId),
    [table?.zoneId, zones],
  );

  useEffect(() => {
    if (!open || !table) {
      setZoneId('');
      setSaving(false);
      setError('');
      return;
    }

    setZoneId(targetZones[0]?.zoneId ?? '');
    setError('');
  }, [open, table, targetZones]);

  if (!table) {
    return null;
  }

  async function handleSave() {
    if (!table) {
      return;
    }

    if (!zoneId) {
      setError(t('eventVipTables.moveModal.zoneRequired'));
      return;
    }

    setSaving(true);
    setError('');

    const result = await adminApi.moveEventVipTable(eventId, table.id, zoneId);
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? t('eventVipTables.moveModal.saveError'));
      return;
    }

    onSaved();
    onClose();
  }

  const footer = (
    <>
      <button type="button" className="event-vip-table-modal__cancel" onClick={onClose}>
        {t('eventVipTables.moveModal.cancel')}
      </button>
      <button
        type="button"
        className="event-vip-table-modal__submit"
        disabled={saving || targetZones.length === 0}
        onClick={() => void handleSave()}
      >
        {saving ? t('eventVipTables.moveModal.saving') : t('eventVipTables.moveModal.submit')}
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventVipTables.moveModal.title')}
      subtitle={t('eventVipTables.moveModal.subtitle', {
        zone: table.zoneLabel,
        number: String(table.number),
      })}
      closeLabel={t('eventVipTables.moveModal.close')}
      titleId="event-vip-table-move-modal-title"
      contentClassName="event-vip-table-modal"
      backdropClassName="modal__backdrop"
      error={error}
      footer={footer}
    >
      <EventInfoField label={t('eventVipTables.moveModal.zone')} required className="event-vip-table-modal__field">
        <select value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
          <option value="">{t('eventVipTables.moveModal.zonePlaceholder')}</option>
          {targetZones.map((zone) => (
            <option key={zone.zoneId} value={zone.zoneId}>
              {zone.label}
            </option>
          ))}
        </select>
      </EventInfoField>
    </Modal>
  );
}
