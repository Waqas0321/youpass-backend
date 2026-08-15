import { ChangeEvent, useRef, useState } from 'react';
import { adminApi, TICKET_IMAGE_UPLOAD_FOLDER } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { EventInfoField } from '../event-info/EventInfoField';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { IconCalendar, IconClock, IconUpload } from '../ui/Icons';
import { EventTicketPreviewCard } from './EventTicketPreviewCard';
import {
  TICKET_DESCRIPTION_MAX,
  TICKET_IMAGE_MAX_BYTES,
  type TicketFormState,
} from './eventTicketForm';
import {
  GENERAL_TICKET_OFFERING_TYPES,
  VIP_TICKET_OFFERING_TYPES,
  type TicketOfferingType,
} from './eventTicketOfferingTypes';

type Props = {
  form: TicketFormState;
  updateForm: <K extends keyof TicketFormState>(key: K, value: TicketFormState[K]) => void;
  onError: (message: string) => void;
  isEdit: boolean;
  usedOfferingTypes: TicketOfferingType[];
};

export function EventTicketCreateFormFields({
  form,
  updateForm,
  onError,
  isEdit,
  usedOfferingTypes,
}: Props) {
  const { t, numberLocale } = useI18n();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (file.size > TICKET_IMAGE_MAX_BYTES) {
      onError(t('eventTickets.createModal.imageTooLarge'));
      return;
    }

    setUploadingImage(true);
    const result = await adminApi.uploadImage(file, TICKET_IMAGE_UPLOAD_FOLDER);
    setUploadingImage(false);

    if (!result.ok || !result.data?.url) {
      onError(result.error ?? t('eventTickets.createModal.uploadError'));
      return;
    }

    updateForm('imageUrl', result.data.url);
  }

  const priceLabel = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }).format(
    Number(form.price) || 0,
  );

  return (
    <>
      <div className="event-ticket-modal__row event-ticket-modal__row--3">
        <EventInfoField label={t('eventTickets.createModal.name')} required className="event-ticket-modal__field">
          <input
            value={form.name}
            onChange={(e) => updateForm('name', e.target.value)}
            placeholder={t('eventTickets.createModal.namePlaceholder')}
          />
        </EventInfoField>
        <EventInfoField label={t('eventTickets.createModal.price')} required className="event-ticket-modal__field">
          <span className="event-ticket-modal__price-input">
            <span className="event-ticket-modal__price-prefix">$</span>
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => updateForm('price', e.target.value)}
            />
            <span className="event-ticket-modal__price-suffix">CLP</span>
          </span>
        </EventInfoField>
        <EventInfoField
          label={t('eventTickets.createModal.stock')}
          required
          hint={t('eventTickets.createModal.stockHint')}
          className="event-ticket-modal__field"
        >
          <input
            type="number"
            min={0}
            value={form.stock}
            onChange={(e) => updateForm('stock', e.target.value)}
          />
        </EventInfoField>
      </div>

      <section className="event-ticket-modal__section">
        <h3>{t('eventTickets.createModal.datesTitle')}</h3>
        <div className="event-ticket-modal__row event-ticket-modal__row--2">
          <div className="event-ticket-modal__date-group">
            <EventInfoField
              label={t('eventTickets.createModal.validityDate')}
              icon={<IconCalendar />}
              className="event-ticket-modal__field"
            >
              <input
                type="date"
                value={form.validFromDate}
                onChange={(e) => updateForm('validFromDate', e.target.value)}
              />
            </EventInfoField>
            <div className="event-ticket-modal__time-row">
              <EventInfoField label={t('eventTickets.createModal.from')} icon={<IconClock />} className="event-ticket-modal__field">
                <input type="time" value={form.validFromTime} onChange={(e) => updateForm('validFromTime', e.target.value)} />
              </EventInfoField>
              <EventInfoField label={t('eventTickets.createModal.to')} icon={<IconClock />} className="event-ticket-modal__field">
                <input type="time" value={form.validToTime} onChange={(e) => updateForm('validToTime', e.target.value)} />
              </EventInfoField>
            </div>
          </div>
          <div className="event-ticket-modal__date-group">
            <EventInfoField
              label={t('eventTickets.createModal.expiryDate')}
              icon={<IconCalendar />}
              className="event-ticket-modal__field"
            >
              <input type="date" value={form.expiryDate} onChange={(e) => updateForm('expiryDate', e.target.value)} />
            </EventInfoField>
            <EventInfoField label={t('eventTickets.createModal.time')} icon={<IconClock />} className="event-ticket-modal__field">
              <input type="time" value={form.expiryTime} onChange={(e) => updateForm('expiryTime', e.target.value)} />
            </EventInfoField>
          </div>
        </div>
      </section>

      <EventInfoField
        label={t('eventTickets.createModal.description')}
        required
        className="event-ticket-modal__field event-info-field--textarea event-ticket-modal__field--description"
      >
        <textarea
          rows={4}
          maxLength={TICKET_DESCRIPTION_MAX}
          value={form.description}
          onChange={(e) => updateForm('description', e.target.value)}
          placeholder={t('eventTickets.createModal.descriptionPlaceholder')}
        />
        <span className="event-info-field__counter">
          {t('eventTickets.createModal.descriptionCount', {
            count: String(form.description.length),
            max: String(TICKET_DESCRIPTION_MAX),
          })}
        </span>
      </EventInfoField>

      <div className="event-ticket-modal__split">
        <section className="event-ticket-modal__section">
          <h3>{t('eventTickets.createModal.configTitle')}</h3>
          <ToggleSwitch
            className="event-ticket-modal__toggle-row"
            label={t('eventTickets.createModal.showInApp')}
            hint={t('eventTickets.createModal.showInAppHint')}
            checked={form.showInApp}
            onChange={(checked) => updateForm('showInApp', checked)}
          />
          <ToggleSwitch
            className="event-ticket-modal__toggle-row"
            label={t('eventTickets.createModal.featured')}
            hint={t('eventTickets.createModal.featuredHint')}
            checked={form.featured}
            onChange={(checked) => updateForm('featured', checked)}
          />
          <EventInfoField
            label={t('eventTickets.createModal.limitPerUser')}
            hint={t('eventTickets.createModal.limitPerUserHint')}
            className="event-ticket-modal__field"
          >
            <div className="event-ticket-modal__limit-input">
              <input
                type="number"
                min={0}
                disabled={form.unlimitedPerUser}
                value={form.limitPerUser}
                onChange={(e) => updateForm('limitPerUser', e.target.value)}
              />
              <button
                type="button"
                className={`event-ticket-modal__chip${form.unlimitedPerUser ? ' is-active' : ''}`}
                onClick={() => updateForm('unlimitedPerUser', !form.unlimitedPerUser)}
              >
                {t('eventTickets.createModal.unlimited')}
              </button>
            </div>
          </EventInfoField>
          <ToggleSwitch
            className="event-ticket-modal__toggle-row"
            label={t('eventTickets.createModal.promoCode')}
            hint={t('eventTickets.createModal.promoCodeHint')}
            checked={form.promoCodeRequired}
            onChange={(checked) => updateForm('promoCodeRequired', checked)}
          />
        </section>

        <section className="event-ticket-modal__section">
          <h3>{t('eventTickets.createModal.extraTitle')}</h3>
          <EventInfoField label={t('eventTickets.createModal.category')} className="event-ticket-modal__field">
            <select
              value={form.offeringType}
              disabled={isEdit}
              onChange={(e) =>
                updateForm('offeringType', e.target.value as TicketFormState['offeringType'])
              }
            >
              <option value="">{t('eventTickets.createModal.categoryPlaceholder')}</option>
              <optgroup label={t('eventTickets.createModal.typeSectionGeneral')}>
                {GENERAL_TICKET_OFFERING_TYPES.map((option) => {
                  const used = !isEdit && usedOfferingTypes.includes(option.value);
                  return (
                    <option key={option.value} value={option.value} disabled={used}>
                      {t(option.labelKey)}
                      {used ? ` ${t('eventTickets.createModal.typeAlreadyUsed')}` : ''}
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label={t('eventTickets.createModal.typeSectionVip')}>
                {VIP_TICKET_OFFERING_TYPES.map((option) => {
                  const used = !isEdit && usedOfferingTypes.includes(option.value);
                  return (
                    <option key={option.value} value={option.value} disabled={used}>
                      {t(option.labelKey)}
                      {used ? ` ${t('eventTickets.createModal.typeAlreadyUsed')}` : ''}
                    </option>
                  );
                })}
              </optgroup>
            </select>
          </EventInfoField>

          <EventInfoField label={t('eventTickets.createModal.color')} className="event-ticket-modal__field">
            <span className="event-ticket-modal__color-row">
              <label className="event-ticket-modal__color-swatch" style={{ background: form.color }}>
                <input type="color" value={form.color} onChange={(e) => updateForm('color', e.target.value)} />
              </label>
              <input
                className="event-ticket-modal__color-code"
                value={form.color.toUpperCase()}
                onChange={(e) => updateForm('color', e.target.value)}
              />
            </span>
          </EventInfoField>

          <div className="event-ticket-modal__upload-block">
            <span className="event-info-field__label">{t('eventTickets.createModal.image')}</span>
            <button
              type="button"
              className="event-ticket-modal__upload-drop"
              disabled={uploadingImage}
              onClick={() => imageInputRef.current?.click()}
            >
              <IconUpload />
              <strong>
                {uploadingImage ? t('eventTickets.createModal.uploading') : t('eventTickets.createModal.uploadImage')}
              </strong>
              <span>{t('eventTickets.createModal.imageHint')}</span>
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png"
              hidden
              onChange={(e) => void handleImageChange(e)}
            />
          </div>

          <div className="event-ticket-modal__preview">
            <span className="event-info-field__label">{t('eventTickets.createModal.preview')}</span>
            <EventTicketPreviewCard
              name={form.name}
              nameFallback={t('eventTickets.createModal.previewName')}
              priceLabel={priceLabel}
              color={form.color}
              imageUrl={form.imageUrl}
              validFromLabel={t('eventTickets.createModal.previewValidFrom')}
              validToLabel={t('eventTickets.createModal.previewValidTo')}
            />
          </div>
        </section>
      </div>
    </>
  );
}
