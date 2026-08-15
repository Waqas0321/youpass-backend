import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { EventInfoField } from '../event-info/EventInfoField';
import { Modal } from '../ui/Modal';
import { formatVipTablePrice, type EventVipTableRow } from './eventVipTablesData';

type Props = {
  open: boolean;
  eventId: string;
  table: EventVipTableRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export function EventVipTableEditModal({ open, eventId, table, onClose, onSaved }: Props) {
  const { t, numberLocale } = useI18n();
  const [number, setNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !table) {
      setNumber('');
      setCapacity('');
      setPrice('');
      setSaving(false);
      setError('');
      return;
    }

    setNumber(String(table.number));
    setCapacity(String(table.capacity));
    setPrice(String(table.price));
    setError('');
  }, [open, table]);

  if (!table) {
    return null;
  }

  async function handleSave() {
    if (!table) {
      return;
    }

    const nextNumber = Number(number);
    const nextCapacity = Number(capacity);
    const nextPrice = Number(price);

    if (!Number.isFinite(nextNumber) || nextNumber <= 0) {
      setError(t('eventVipTables.editModal.invalidNumber'));
      return;
    }

    if (!Number.isFinite(nextCapacity) || nextCapacity <= 0) {
      setError(t('eventVipTables.editModal.invalidCapacity'));
      return;
    }

    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      setError(t('eventVipTables.editModal.invalidPrice'));
      return;
    }

    setSaving(true);
    setError('');

    const result = await adminApi.editEventVipTable(eventId, table.id, {
      number: nextNumber,
      capacity: nextCapacity,
      price: nextPrice,
      label: `Mesa ${nextNumber}`,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? t('eventVipTables.editModal.saveError'));
      return;
    }

    onSaved();
    onClose();
  }

  const footer = (
    <>
      <button type="button" className="event-vip-table-modal__cancel" onClick={onClose}>
        {t('eventVipTables.editModal.cancel')}
      </button>
      <button
        type="button"
        className="event-vip-table-modal__submit"
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving ? t('eventVipTables.editModal.saving') : t('eventVipTables.editModal.submit')}
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventVipTables.editModal.title')}
      subtitle={t('eventVipTables.editModal.subtitle', {
        zone: table.zoneLabel,
        number: String(table.number),
      })}
      closeLabel={t('eventVipTables.editModal.close')}
      titleId="event-vip-table-edit-modal-title"
      contentClassName="event-vip-table-modal"
      backdropClassName="modal__backdrop"
      error={error}
      footer={footer}
    >
      <div className="event-vip-table-modal__grid">
        <EventInfoField label={t('eventVipTables.editModal.number')} required className="event-vip-table-modal__field">
          <input
            type="number"
            min={1}
            value={number}
            onChange={(event) => setNumber(event.target.value)}
          />
        </EventInfoField>

        <EventInfoField
          label={t('eventVipTables.editModal.capacity')}
          required
          className="event-vip-table-modal__field"
        >
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            disabled={table.status === 'paid'}
          />
        </EventInfoField>

        <EventInfoField label={t('eventVipTables.editModal.price')} required className="event-vip-table-modal__field">
          <span className="event-vip-table-modal__price-input">
            <span className="event-vip-table-modal__price-prefix">$</span>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              disabled={table.status === 'paid'}
            />
            <span className="event-vip-table-modal__price-suffix">{table.currency}</span>
          </span>
        </EventInfoField>
      </div>

      {table.status === 'paid' ? (
        <p className="event-vip-table-modal__paid-note">
          {t('eventVipTables.editModal.paidNote', {
            price: formatVipTablePrice(table.price, table.currency, numberLocale),
          })}
        </p>
      ) : null}
    </Modal>
  );
}
