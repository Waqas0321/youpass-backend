import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n/useI18n';
import type { CompTypeId } from './eventCompsUtils';
import {
  CompsBenefitTextarea,
  CompsCodeNote,
  CompsDateInput,
  CompsFormField,
  CompsInfoBanner,
  CompsPhoneField,
  CompsTextInput,
  CompsTimeRangeField,
  CompsTypeSelect,
} from './CompsFormShared';
import { buildCreateCompBody } from './eventCompsForm';

type Props = {
  open: boolean;
  eventId: string;
  producerId: string;
  onClose: () => void;
  onCreated: () => void;
};

const INITIAL_FORM = {
  name: '',
  phone: '',
  type: '' as CompTypeId | '',
  benefit: '',
  issueDate: '',
  timeFrom: '22:00',
  timeTo: '04:00',
};

export function EventCompsCreateModal({ open, eventId, producerId, onClose, onCreated }: Props) {
  const { t } = useI18n();
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setForm(INITIAL_FORM);
    setSaving(false);
    setError('');
  }, [open]);

  const canSubmit = Boolean(
    producerId &&
      eventId &&
      form.name.trim() &&
      form.phone.trim() &&
      form.type &&
      form.benefit.trim() &&
      form.issueDate &&
      form.timeFrom &&
      form.timeTo,
  );

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (!canSubmit || !form.type) {
      return;
    }

    setSaving(true);
    setError('');

    const body = buildCreateCompBody({
      eventId,
      name: form.name,
      phone: form.phone,
      type: form.type,
      benefit: form.benefit,
      issueDate: form.issueDate,
      timeFrom: form.timeFrom,
      timeTo: form.timeTo,
    });

    const result = await adminApi.createInvitation(producerId, body);
    if (!result.ok) {
      setError(result.error ?? t('eventComps.createError'));
      setSaving(false);
      return;
    }

    onCreated();
    onClose();
    setSaving(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventComps.createModal.title')}
      closeLabel={t('eventComps.createModal.close')}
      error={error}
      contentClassName="modal__panel event-comps-create-modal"
      footer={
        <div className="event-comps-create-modal__footer event-comps-create-modal__footer--split">
          <CompsCodeNote>{t('eventComps.createModal.codeNote')}</CompsCodeNote>
          <div className="event-comps-create-form__footer">
            <button type="button" className="ghost-btn" onClick={onClose} disabled={saving}>
              {t('eventComps.createModal.cancel')}
            </button>
            <button
              type="button"
              className="primary-btn event-comps-create-form__submit"
              disabled={saving || !canSubmit}
              onClick={() => void handleSubmit()}
            >
              {saving ? t('eventComps.createModal.saving') : t('eventComps.createModal.submit')}
            </button>
          </div>
        </div>
      }
    >
      <div className="event-comps-create-modal__body">
        <CompsInfoBanner>{t('eventComps.createModal.infoBanner')}</CompsInfoBanner>

        <ol className="event-comps-form-sections">
          <li>
            <CompsFormField label={t('eventComps.createModal.fields.name')} required>
              <CompsTextInput
                value={form.name}
                placeholder={t('eventComps.createModal.namePlaceholder')}
                onChange={(value) => updateField('name', value)}
              />
            </CompsFormField>
          </li>
          <li>
            <CompsFormField label={t('eventComps.createModal.fields.phone')} required>
              <CompsPhoneField
                value={form.phone}
                placeholder={t('eventComps.createModal.phonePlaceholder')}
                onChange={(value) => updateField('phone', value)}
              />
            </CompsFormField>
          </li>
          <li>
            <CompsFormField label={t('eventComps.createModal.fields.type')} required>
              <CompsTypeSelect
                value={form.type}
                placeholder={t('eventComps.createModal.selectType')}
                createLabel={t('eventComps.createModal.createType')}
                onChange={(value) => updateField('type', value)}
                onCreateType={() => undefined}
              />
            </CompsFormField>
          </li>
          <li>
            <CompsFormField
              label={t('eventComps.createModal.fields.benefit')}
              required
              hint={t('eventComps.createModal.benefitHint')}
            >
              <CompsBenefitTextarea
                value={form.benefit}
                placeholder={t('eventComps.createModal.benefitPlaceholder')}
                onChange={(value) => updateField('benefit', value)}
              />
            </CompsFormField>
          </li>
          <li>
            <CompsFormField
              label={t('eventComps.createModal.fields.issueDate')}
              required
              hint={t('eventComps.createModal.issueDateHint')}
            >
              <CompsDateInput value={form.issueDate} onChange={(value) => updateField('issueDate', value)} />
            </CompsFormField>
          </li>
          <li>
            <CompsFormField
              label={t('eventComps.createModal.fields.timeRange')}
              required
              hint={t('eventComps.createModal.timeRangeHint')}
            >
              <CompsTimeRangeField
                from={form.timeFrom}
                to={form.timeTo}
                fromLabel={t('eventComps.createModal.timeFrom')}
                toLabel={t('eventComps.createModal.timeTo')}
                onFromChange={(value) => updateField('timeFrom', value)}
                onToChange={(value) => updateField('timeTo', value)}
              />
            </CompsFormField>
          </li>
        </ol>
      </div>
    </Modal>
  );
}
