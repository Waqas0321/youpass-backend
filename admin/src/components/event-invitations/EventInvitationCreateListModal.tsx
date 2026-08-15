import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from '../../api/client';
import { Modal } from '../ui/Modal';
import { IconChevronDown, IconPlus, IconTrash, IconUpload } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import {
  countValidGuestRows,
  createEmptyGuestRow,
  createInitialGuestRows,
  INVITATION_LIST_OPTIONS,
  INVITATION_TYPE_OPTIONS,
  type CreateListGuestRow,
} from './eventInvitationCreateListDemo';
import { buildCreateInvitationBody } from './eventInvitationForm';

type Props = {
  open: boolean;
  eventId: string;
  producerId: string;
  onClose: () => void;
  onCreated: (guestCount: number) => void;
};

function parseCsvRows(text: string): CreateListGuestRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const first = lines[0].toLowerCase();
  const hasHeader = first.includes('name') || first.includes('nombre');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const parts = line.split(',').map((part) => part.trim().replace(/^"|"$/g, ''));
    return {
      ...createEmptyGuestRow(),
      name: parts[0] ?? '',
      phone: parts[1] ?? '',
      listAssignment: parts[2] ?? '',
      invitationType: parts[3] ?? '',
    };
  });
}

export function EventInvitationCreateListModal({
  open,
  eventId,
  producerId,
  onClose,
  onCreated,
}: Props) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [globalList, setGlobalList] = useState('');
  const [globalType, setGlobalType] = useState('');
  const [rows, setRows] = useState<CreateListGuestRow[]>(() => createInitialGuestRows());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setGlobalList('');
    setGlobalType('');
    setRows(createInitialGuestRows());
    setSaving(false);
    setError('');
  }, [open]);

  const guestCount = useMemo(() => countValidGuestRows(rows), [rows]);

  function updateRow(id: string, patch: Partial<CreateListGuestRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    setRows((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((row) => row.id !== id);
    });
  }

  function addRow() {
    setRows((current) => [...current, createEmptyGuestRow()]);
  }

  async function handleSubmit() {
    if (!producerId || !eventId || guestCount === 0) {
      return;
    }

    setSaving(true);
    setError('');

    const validRows = rows.filter((row) => row.name.trim() && row.phone.trim());
    let created = 0;
    let lastError = '';

    for (const row of validRows) {
      const listAssignment = row.listAssignment || globalList;
      const invitationType = row.invitationType || globalType;

      if (!listAssignment || !invitationType) {
        lastError = t('eventInvitations.createListModal.missingDefaults');
        continue;
      }

      const body = buildCreateInvitationBody({
        eventId,
        name: row.name,
        phone: row.phone,
        listAssignment,
        invitationType,
      });

      const result = await adminApi.createInvitation(producerId, body);
      if (result.ok) {
        created += 1;
      } else {
        lastError = result.error ?? t('eventInvitations.createError');
      }
    }

    if (created === 0) {
      setError(lastError || t('eventInvitations.createError'));
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
      const imported = parseCsvRows(text);
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
      title={t('eventInvitations.createListModal.title')}
      subtitle={t('eventInvitations.createListModal.subtitle')}
      closeLabel={t('eventInvitations.createListModal.close')}
      error={error}
      contentClassName="modal__panel event-invitations-create-list-modal"
      footer={
        <div className="event-invitations-create-list__footer">
          <p className="event-invitations-create-list__count">
            {t('eventInvitations.createListModal.guestCount', { count: guestCount })}
          </p>
          <div className="event-invitations-create-list__footer-actions">
            <button type="button" className="ghost-btn" onClick={onClose} disabled={saving}>
              {t('eventInvitations.createListModal.cancel')}
            </button>
            <button
              type="button"
              className="primary-btn event-invitations-create-list__submit"
              disabled={saving || guestCount === 0 || !globalList || !globalType}
              onClick={() => void handleSubmit()}
            >
              {saving
                ? t('eventInvitations.createListModal.saving')
                : t('eventInvitations.createListModal.submit', { count: guestCount })}
            </button>
          </div>
        </div>
      }
    >
      <div className="event-invitations-create-list">
        <div className="event-invitations-create-list__globals">
          <div className="event-invitations-create-list__global-field">
            <label className="event-invitations-create-list__label">
              {t('eventInvitations.createListModal.globalList')}
              <span className="event-invitations-create-list__required">*</span>
            </label>
            <label className="event-invitations-create-list__select">
              <select value={globalList} onChange={(event) => setGlobalList(event.target.value)}>
                <option value="">{t('eventInvitations.createListModal.selectList')}</option>
                {INVITATION_LIST_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(`eventInvitations.${option.labelKey}`)}
                  </option>
                ))}
              </select>
              <IconChevronDown />
            </label>
          </div>

          <div className="event-invitations-create-list__global-field">
            <label className="event-invitations-create-list__label">
              {t('eventInvitations.createListModal.globalType')}
              <span className="event-invitations-create-list__required">*</span>
            </label>
            <label className="event-invitations-create-list__select">
              <select value={globalType} onChange={(event) => setGlobalType(event.target.value)}>
                <option value="">{t('eventInvitations.createListModal.selectType')}</option>
                {INVITATION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(`eventInvitations.${option.labelKey}`)}
                  </option>
                ))}
              </select>
              <IconChevronDown />
            </label>
          </div>
        </div>

        <section className="event-invitations-create-list__section">
          <div className="event-invitations-create-list__section-head">
            <div>
              <h3>{t('eventInvitations.createListModal.guestsTitle')}</h3>
              <p>{t('eventInvitations.createListModal.guestsHint')}</p>
            </div>
            <button
              type="button"
              className="event-invitations-create-list__import"
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload />
              {t('eventInvitations.createListModal.importExcel')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={handleImportFile}
            />
          </div>

          <div className="event-invitations-create-list__table-wrap">
            <table className="event-invitations-create-list__table">
              <thead>
                <tr>
                  <th aria-hidden="true" />
                  <th>
                    {t('eventInvitations.createListModal.columns.name')}
                    <span className="event-invitations-create-list__required">*</span>
                  </th>
                  <th>
                    {t('eventInvitations.createListModal.columns.phone')}
                    <span className="event-invitations-create-list__required">*</span>
                  </th>
                  <th>{t('eventInvitations.createListModal.columns.list')}</th>
                  <th>{t('eventInvitations.createListModal.columns.type')}</th>
                  <th aria-label={t('eventInvitations.columns.actions')} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="event-invitations-create-list__index">{index + 1}</td>
                    <td>
                      <input
                        type="text"
                        value={row.name}
                        placeholder={t('eventInvitations.createListModal.namePlaceholder')}
                        onChange={(event) => updateRow(row.id, { name: event.target.value })}
                      />
                    </td>
                    <td>
                      <label className="event-invitations-create-list__phone">
                        <span className="event-invitations-create-list__phone-prefix" aria-hidden="true">
                          <span className="event-invitations-create-list__flag">🇨🇱</span>
                          +56
                        </span>
                        <input
                          type="tel"
                          inputMode="tel"
                          value={row.phone}
                          placeholder={t('eventInvitations.createListModal.phonePlaceholder')}
                          onChange={(event) => updateRow(row.id, { phone: event.target.value })}
                        />
                      </label>
                    </td>
                    <td>
                      <label className="event-invitations-create-list__select event-invitations-create-list__select--compact">
                        <select
                          value={row.listAssignment || globalList}
                          onChange={(event) => updateRow(row.id, { listAssignment: event.target.value })}
                        >
                          <option value="">{t('eventInvitations.createListModal.selectList')}</option>
                          {INVITATION_LIST_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {t(`eventInvitations.${option.labelKey}`)}
                            </option>
                          ))}
                        </select>
                        <IconChevronDown />
                      </label>
                    </td>
                    <td>
                      <label className="event-invitations-create-list__select event-invitations-create-list__select--compact">
                        <select
                          value={row.invitationType || globalType}
                          onChange={(event) => updateRow(row.id, { invitationType: event.target.value })}
                        >
                          <option value="">{t('eventInvitations.createListModal.selectType')}</option>
                          {INVITATION_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {t(`eventInvitations.${option.labelKey}`)}
                            </option>
                          ))}
                        </select>
                        <IconChevronDown />
                      </label>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="event-invitations-create-list__delete"
                        aria-label={t('eventInvitations.createListModal.removeRow')}
                        disabled={rows.length <= 1}
                        onClick={() => removeRow(row.id)}
                      >
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="event-invitations-create-list__add-row" onClick={addRow}>
            <IconPlus />
            {t('eventInvitations.createListModal.addRow')}
          </button>
        </section>
      </div>
    </Modal>
  );
}
