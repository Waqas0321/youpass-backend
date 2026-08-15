import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from '../../api/client';
import { Modal } from '../ui/Modal';
import { IconChevronRight, IconPlus, IconTicket, IconTrash } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import type { CompTypeId } from './eventCompsUtils';
import {
  CompsBenefitTextarea,
  CompsDateInput,
  CompsFormField,
  CompsInfoBanner,
  CompsPhoneField,
  CompsTextInput,
  CompsTimeRangeField,
  CompsTypeSelect,
} from './CompsFormShared';
import { buildCreateCompBody } from './eventCompsForm';

type BatchStep = 1 | 2;

type BeneficiaryRow = {
  id: string;
  selected: boolean;
  name: string;
  phone: string;
};

let rowCounter = 0;

function createBeneficiaryRow(): BeneficiaryRow {
  rowCounter += 1;
  return { id: `beneficiary-${rowCounter}`, selected: false, name: '', phone: '' };
}

function createInitialRows(count = 5): BeneficiaryRow[] {
  return Array.from({ length: count }, () => createBeneficiaryRow());
}

function countValidBeneficiaries(rows: BeneficiaryRow[]) {
  return rows.filter((row) => row.name.trim() && row.phone.trim()).length;
}

type BatchForm = {
  type: CompTypeId | '';
  benefit: string;
  issueDate: string;
  timeFrom: string;
  timeTo: string;
};

const INITIAL_FORM: BatchForm = {
  type: '',
  benefit: '',
  issueDate: '',
  timeFrom: '22:00',
  timeTo: '04:00',
};

type Props = {
  open: boolean;
  eventId: string;
  producerId: string;
  onClose: () => void;
  onCreated: (count: number) => void;
};

export function EventCompsCreateBatchModal({ open, eventId, producerId, onClose, onCreated }: Props) {
  const { t } = useI18n();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<BatchStep>(1);
  const [form, setForm] = useState<BatchForm>(INITIAL_FORM);
  const [rows, setRows] = useState<BeneficiaryRow[]>(() => createInitialRows());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setStep(1);
    setForm(INITIAL_FORM);
    setRows(createInitialRows());
    setSaving(false);
    setError('');
  }, [open]);

  const validCount = useMemo(() => countValidBeneficiaries(rows), [rows]);
  const selectedCount = useMemo(() => rows.filter((row) => row.selected).length, [rows]);

  const configValid = Boolean(
    form.type && form.benefit.trim() && form.issueDate && form.timeFrom && form.timeTo,
  );

  const canContinue = configValid && validCount > 0;

  function updateForm<K extends keyof BatchForm>(key: K, value: BatchForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateRow(id: string, patch: Partial<BeneficiaryRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeSelectedRows() {
    setRows((current) => {
      const remaining = current.filter((row) => !row.selected);
      return remaining.length > 0 ? remaining : createInitialRows(1);
    });
  }

  async function handleConfirm() {
    if (!producerId || !eventId || !form.type || validCount === 0) {
      return;
    }

    setSaving(true);
    setError('');

    const validRows = rows.filter((row) => row.name.trim() && row.phone.trim());
    let created = 0;
    let lastError = '';

    for (const row of validRows) {
      const body = buildCreateCompBody({
        eventId,
        name: row.name,
        phone: row.phone,
        type: form.type,
        benefit: form.benefit,
        issueDate: form.issueDate,
        timeFrom: form.timeFrom,
        timeTo: form.timeTo,
      });

      const result = await adminApi.createInvitation(producerId, body);
      if (result.ok) {
        created += 1;
      } else {
        lastError = result.error ?? t('eventComps.createError');
      }
    }

    if (created === 0) {
      setError(lastError || t('eventComps.createError'));
      setSaving(false);
      return;
    }

    onCreated(created);
    onClose();
    setSaving(false);
  }

  function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const dataLines = lines[0]?.toLowerCase().includes('name') ? lines.slice(1) : lines;
      const imported = dataLines.map((line) => {
        const parts = line.split(',').map((part) => part.trim().replace(/^"|"$/g, ''));
        return {
          ...createBeneficiaryRow(),
          name: parts[0] ?? '',
          phone: parts[1] ?? '',
        };
      });
      if (imported.length > 0) {
        setRows(imported);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventComps.batchModal.title')}
      subtitle={t('eventComps.batchModal.subtitle')}
      closeLabel={t('eventComps.batchModal.close')}
      error={error}
      contentClassName="modal__panel event-comps-batch-modal"
      footer={
        <div className={`event-comps-batch-modal__footer${step === 1 ? ' event-comps-batch-modal__footer--split' : ''}`}>
          {step === 1 ? (
            <>
              <p className="event-comps-batch-modal__summary">
                <span className="event-comps-batch-modal__summary-icon" aria-hidden="true">
                  <IconTicket />
                </span>
                <span>{t('eventComps.batchModal.footerSummary', { count: validCount })}</span>
              </p>
              <div className="event-comps-create-form__footer">
                <button type="button" className="ghost-btn" onClick={onClose}>
                  {t('eventComps.batchModal.cancel')}
                </button>
                <button
                  type="button"
                  className="primary-btn event-comps-create-form__submit"
                  disabled={!canContinue}
                  onClick={() => setStep(2)}
                >
                  {t('eventComps.batchModal.next')}
                  <IconChevronRight />
                </button>
              </div>
            </>
          ) : (
            <div className="event-comps-create-form__footer">
              <button type="button" className="ghost-btn" onClick={() => setStep(1)} disabled={saving}>
                {t('eventComps.batchModal.back')}
              </button>
              <button
                type="button"
                className="primary-btn event-comps-create-form__submit"
                disabled={saving}
                onClick={() => void handleConfirm()}
              >
                {saving ? t('eventComps.batchModal.saving') : t('eventComps.batchModal.submit', { count: validCount })}
              </button>
            </div>
          )}
        </div>
      }
    >
      <div className="event-comps-batch-modal__body">
        <ol className="event-comps-batch-stepper">
          <li className={step === 1 ? 'is-active' : 'is-complete'}>
            <span>1</span>
            {t('eventComps.batchModal.steps.config')}
          </li>
          <li className={step === 1 ? undefined : 'is-complete'}>
            <span>2</span>
            {t('eventComps.batchModal.steps.beneficiaries')}
          </li>
          <li className={step === 2 ? 'is-active' : undefined}>
            <span>3</span>
            {t('eventComps.batchModal.steps.review')}
          </li>
        </ol>

        {step === 1 ? (
          <>
            <ol className="event-comps-form-sections">
              <li>
                <CompsFormField label={t('eventComps.batchModal.fields.type')} required>
                  <CompsTypeSelect
                    value={form.type}
                    placeholder={t('eventComps.createModal.selectType')}
                    createLabel={t('eventComps.createModal.createType')}
                    onChange={(value) => updateForm('type', value)}
                    onCreateType={() => undefined}
                  />
                </CompsFormField>
              </li>
              <li>
                <CompsFormField label={t('eventComps.batchModal.fields.benefit')} required>
                  <CompsBenefitTextarea
                    value={form.benefit}
                    placeholder={t('eventComps.createModal.benefitPlaceholder')}
                    onChange={(value) => updateForm('benefit', value)}
                  />
                </CompsFormField>
              </li>
              <li>
                <CompsFormField label={t('eventComps.batchModal.fields.issueDate')} required>
                  <CompsDateInput value={form.issueDate} onChange={(value) => updateForm('issueDate', value)} />
                </CompsFormField>
              </li>
              <li>
                <CompsFormField label={t('eventComps.batchModal.fields.timeRange')} required hint={t('eventComps.createModal.timeRangeHint')}>
                  <CompsTimeRangeField
                    from={form.timeFrom}
                    to={form.timeTo}
                    fromLabel={t('eventComps.createModal.timeFrom')}
                    toLabel={t('eventComps.createModal.timeTo')}
                    onFromChange={(value) => updateForm('timeFrom', value)}
                    onToChange={(value) => updateForm('timeTo', value)}
                  />
                </CompsFormField>
              </li>
            </ol>

            <CompsInfoBanner>{t('eventComps.batchModal.infoBanner')}</CompsInfoBanner>

            <section className="event-comps-batch-beneficiaries">
              <div className="event-comps-batch-beneficiaries__head">
                <h3 className="event-comps-batch-beneficiaries__title">
                  <span className="event-comps-batch-beneficiaries__index">5.</span>
                  {t('eventComps.batchModal.beneficiariesTitle')}
                </h3>
                <div className="event-comps-batch-beneficiaries__actions">
                  <button type="button" className="event-comps-batch-beneficiaries__btn" onClick={() => setRows((current) => [...current, createBeneficiaryRow()])}>
                    <IconPlus />
                    {t('eventComps.batchModal.addRow')}
                  </button>
                  <button type="button" className="event-comps-batch-beneficiaries__import" onClick={() => importInputRef.current?.click()}>
                    <span className="event-comps-batch-beneficiaries__excel-icon" aria-hidden="true">
                      X
                    </span>
                    {t('eventComps.batchModal.importExcel')}
                  </button>
                  <input ref={importInputRef} type="file" accept=".csv,text/csv" hidden onChange={handleImportFile} />
                  <button
                    type="button"
                    className="event-comps-batch-beneficiaries__delete-selected"
                    disabled={selectedCount === 0}
                    onClick={removeSelectedRows}
                  >
                    <IconTrash />
                    {t('eventComps.batchModal.deleteSelected')}
                  </button>
                </div>
              </div>

              <div className="event-comps-batch-beneficiaries__table-wrap">
                <table className="event-comps-batch-beneficiaries__table">
                  <thead>
                    <tr>
                      <th aria-hidden="true" />
                      <th>{t('eventComps.batchModal.columns.index')}</th>
                      <th>{t('eventComps.batchModal.columns.name')}</th>
                      <th>{t('eventComps.batchModal.columns.phone')}</th>
                      <th aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(event) => updateRow(row.id, { selected: event.target.checked })}
                            aria-label={t('eventComps.batchModal.selectRow', { index: index + 1 })}
                          />
                        </td>
                        <td>{index + 1}</td>
                        <td>
                          <CompsTextInput
                            value={row.name}
                            placeholder={t('eventComps.createModal.namePlaceholder')}
                            onChange={(value) => updateRow(row.id, { name: value })}
                          />
                        </td>
                        <td>
                          <CompsPhoneField
                            value={row.phone}
                            placeholder={t('eventComps.createModal.phonePlaceholder')}
                            onChange={(value) => updateRow(row.id, { phone: value })}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="event-comps-batch-beneficiaries__delete"
                            disabled={rows.length <= 1}
                            onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                          >
                            <IconTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="event-comps-batch-beneficiaries__add-many"
                onClick={() =>
                  setRows((current) => [...current, ...Array.from({ length: 10 }, () => createBeneficiaryRow())])
                }
              >
                <IconPlus />
                {t('eventComps.batchModal.addManyRows')}
              </button>
            </section>
          </>
        ) : (
          <div className="event-comps-batch-review">
            <h3>{t('eventComps.batchModal.reviewTitle')}</h3>
            <dl>
              <div>
                <dt>{t('eventComps.batchModal.fields.type')}</dt>
                <dd>{form.type ? t(`eventComps.types.${form.type}`) : '—'}</dd>
              </div>
              <div>
                <dt>{t('eventComps.batchModal.fields.benefit')}</dt>
                <dd>{form.benefit || '—'}</dd>
              </div>
              <div>
                <dt>{t('eventComps.batchModal.fields.issueDate')}</dt>
                <dd>{form.issueDate || '—'}</dd>
              </div>
              <div>
                <dt>{t('eventComps.batchModal.fields.timeRange')}</dt>
                <dd>
                  {form.timeFrom && form.timeTo ? `${form.timeFrom} – ${form.timeTo}` : '—'}
                </dd>
              </div>
              <div>
                <dt>{t('eventComps.batchModal.beneficiariesTitle')}</dt>
                <dd>{t('eventComps.batchModal.reviewBeneficiaries', { count: validCount })}</dd>
              </div>
            </dl>
            <CompsInfoBanner>{t('eventComps.batchModal.reviewBanner')}</CompsInfoBanner>
          </div>
        )}
      </div>
    </Modal>
  );
}
