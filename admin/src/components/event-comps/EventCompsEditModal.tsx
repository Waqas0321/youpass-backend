import { useEffect, useState } from 'react';
import type { Comp, CompTypeId } from './eventCompsUtils';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n/useI18n';
import {
  CompsBenefitTextarea,
  CompsDateInput,
  CompsFormField,
  CompsPhoneField,
  CompsTextInput,
  CompsTimeRangeField,
  CompsTypeSelect,
} from './CompsFormShared';

type Props = {
  open: boolean;
  comp: Comp | null;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    phone: string;
    type: CompTypeId;
    benefit: string;
    issueDate: string;
    timeFrom: string;
    timeTo: string;
  }) => void;
};

export function EventCompsEditModal({ open, comp, saving, error, onClose, onSave }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<CompTypeId | ''>('');
  const [benefit, setBenefit] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');

  useEffect(() => {
    if (!open || !comp) {
      return;
    }
    setName(comp.beneficiary_name);
    setPhone(comp.phone);
    setType(comp.type);
    setBenefit(comp.benefit);
    setIssueDate(comp.issue_date ?? '');
    setTimeFrom(comp.time_from ?? '');
    setTimeTo(comp.time_to ?? '');
  }, [open, comp]);

  if (!comp) {
    return null;
  }

  const canSave = Boolean(name.trim() && phone.trim() && type && benefit.trim() && issueDate && timeFrom && timeTo);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventComps.editModal.title')}
      subtitle={comp.code}
      closeLabel={t('eventComps.editModal.close')}
      error={error}
      contentClassName="modal__panel event-comps-edit-modal"
      footer={
        <div className="event-comps-create-form__footer">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={saving}>
            {t('eventComps.editModal.cancel')}
          </button>
          <button
            type="button"
            className="primary-btn event-comps-create-form__submit"
            disabled={saving || !canSave}
            onClick={() =>
              type &&
              onSave({
                name: name.trim(),
                phone: phone.trim(),
                type,
                benefit: benefit.trim(),
                issueDate,
                timeFrom,
                timeTo,
              })
            }
          >
            {saving ? t('eventComps.editModal.saving') : t('eventComps.editModal.save')}
          </button>
        </div>
      }
    >
      <div className="event-comps-create-modal__body">
        <CompsFormField label={t('eventComps.createModal.fields.name')} required>
          <CompsTextInput value={name} onChange={setName} placeholder={t('eventComps.createModal.namePlaceholder')} />
        </CompsFormField>
        <CompsFormField label={t('eventComps.createModal.fields.phone')} required>
          <CompsPhoneField value={phone} onChange={setPhone} placeholder={t('eventComps.createModal.phonePlaceholder')} />
        </CompsFormField>
        <CompsFormField label={t('eventComps.createModal.fields.type')} required>
          <CompsTypeSelect
            value={type}
            placeholder={t('eventComps.createModal.selectType')}
            createLabel={t('eventComps.createModal.createType')}
            onChange={setType}
            onCreateType={onClose}
          />
        </CompsFormField>
        <CompsFormField label={t('eventComps.createModal.fields.benefit')} required>
          <CompsBenefitTextarea
            value={benefit}
            placeholder={t('eventComps.createModal.benefitPlaceholder')}
            onChange={setBenefit}
          />
        </CompsFormField>
        <CompsFormField label={t('eventComps.createModal.fields.issueDate')} required>
          <CompsDateInput value={issueDate} onChange={setIssueDate} />
        </CompsFormField>
        <CompsFormField label={t('eventComps.createModal.fields.timeRange')} required>
          <CompsTimeRangeField
            from={timeFrom}
            to={timeTo}
            fromLabel={t('eventComps.createModal.timeFrom')}
            toLabel={t('eventComps.createModal.timeTo')}
            onFromChange={setTimeFrom}
            onToChange={setTimeTo}
          />
        </CompsFormField>
      </div>
    </Modal>
  );
}
