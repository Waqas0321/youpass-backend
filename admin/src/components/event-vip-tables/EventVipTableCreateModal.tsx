import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { useVipTableCreateForm } from '../../hooks/useVipTableCreateForm';
import { EventInfoField } from '../event-info/EventInfoField';
import { Modal } from '../ui/Modal';
import { IconMapPin, IconPlus } from '../ui/Icons';
import type { VipZoneOption } from './eventVipTablesData';

type Props = {
  open: boolean;
  eventId: string;
  zones: VipZoneOption[];
  currency: string;
  onClose: () => void;
  onCreated: () => void;
};

export function EventVipTableCreateModal({
  open,
  eventId,
  zones,
  currency,
  onClose,
  onCreated,
}: Props) {
  const { t } = useI18n();
  const { form, updateForm, saving, error, persistTable } = useVipTableCreateForm(
    eventId,
    open,
    zones,
    onCreated,
    onClose,
  );

  const footer = (
    <>
      <button type="button" className="event-vip-table-modal__cancel" onClick={onClose}>
        {t('eventVipTables.createModal.cancel')}
      </button>
      <button
        type="button"
        className="event-vip-table-modal__submit"
        disabled={saving || zones.length === 0}
        onClick={() => void persistTable()}
      >
        {saving ? t('eventVipTables.createModal.saving') : t('eventVipTables.createModal.submit')}
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventVipTables.createModal.title')}
      subtitle={t('eventVipTables.createModal.subtitle')}
      closeLabel={t('eventVipTables.createModal.close')}
      titleId="event-vip-table-modal-title"
      contentClassName="event-vip-table-modal"
      backdropClassName="modal__backdrop"
      error={error}
      footer={footer}
    >
      <div className="event-vip-table-modal__grid">
        <EventInfoField
          label={t('eventVipTables.createModal.number')}
          required
          className="event-vip-table-modal__field"
        >
          <input
            type="number"
            min={1}
            value={form.number}
            onChange={(event) => updateForm('number', event.target.value)}
            placeholder={t('eventVipTables.createModal.numberPlaceholder')}
          />
        </EventInfoField>

        <EventInfoField label={t('eventVipTables.createModal.zone')} required className="event-vip-table-modal__field">
          <select value={form.zoneId} onChange={(event) => updateForm('zoneId', event.target.value)}>
            <option value="">{t('eventVipTables.createModal.zonePlaceholder')}</option>
            {zones.map((zone) => (
              <option key={zone.zoneId} value={zone.zoneId}>
                {zone.label}
              </option>
            ))}
          </select>
        </EventInfoField>

        <EventInfoField
          label={t('eventVipTables.createModal.capacity')}
          required
          hint={t('eventVipTables.createModal.capacityHint')}
          className="event-vip-table-modal__field"
        >
          <input
            type="number"
            min={1}
            value={form.capacity}
            onChange={(event) => updateForm('capacity', event.target.value)}
            placeholder={t('eventVipTables.createModal.capacityPlaceholder')}
          />
        </EventInfoField>

        <EventInfoField
          label={t('eventVipTables.createModal.price')}
          required
          hint={t('eventVipTables.createModal.priceHint')}
          className="event-vip-table-modal__field"
        >
          <span className="event-vip-table-modal__price-input">
            <span className="event-vip-table-modal__price-prefix">$</span>
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(event) => updateForm('price', event.target.value)}
              placeholder={t('eventVipTables.createModal.pricePlaceholder')}
            />
            <span className="event-vip-table-modal__price-suffix">{currency}</span>
          </span>
        </EventInfoField>
      </div>

      <section className="event-vip-table-modal__zone-cta">
        <span className="event-vip-table-modal__zone-cta-icon" aria-hidden>
          <IconMapPin />
        </span>
        <div className="event-vip-table-modal__zone-cta-copy">
          <strong>{t('eventVipTables.createModal.zoneCtaTitle')}</strong>
          <p>{t('eventVipTables.createModal.zoneCtaBody')}</p>
        </div>
        <Link
          to={`/events/${eventId}/floor-plan`}
          className="event-vip-table-modal__zone-cta-btn"
          onClick={onClose}
        >
          <IconPlus />
          {t('eventVipTables.createModal.createZone')}
        </Link>
      </section>
    </Modal>
  );
}
