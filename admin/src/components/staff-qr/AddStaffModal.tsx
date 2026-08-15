import { useEffect, useId, useState } from 'react';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import type { AdminStaffRole } from '../../api/client';
import { IconInfo, IconPlus, IconX } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';

const PREFERRED_PHONE_COUNTRIES = ['cl', 'co', 'mx', 'ar', 'pe', 'us', 'br', 'es'] as const;

const DEFAULT_ZONES = [
  'Barra Principal',
  'Acceso General',
  'VIP 1',
  'VIP 2',
  'Zona General',
  'Backstage',
];

export type AddStaffFormValues = {
  name: string;
  phone: string;
  role_id: string;
  zone: string;
};

type Props = {
  open: boolean;
  roles: AdminStaffRole[];
  zones: string[];
  onClose: () => void;
  onSubmit: (values: AddStaffFormValues) => void;
  onZonesChange: (zones: string[]) => void;
};

function roleDisplayLabel(role: AdminStaffRole, t: ReturnType<typeof useI18n>['t']) {
  const slug = role.slug ?? role.id;
  const key = `staffQr.roles.${slug}` as 'staffQr.roles.bar';
  const translated = t(key);
  return translated.startsWith('staffQr.roles.') ? role.label : translated;
}

function emptyForm() {
  return {
    name: '',
    phone: '',
    role_id: '',
    zone: '',
  };
}

function isPhoneComplete(phone: string) {
  return phone.replace(/\D/g, '').length >= 10;
}

export function buildStaffZoneOptions(staffZones: string[]) {
  const merged = [...DEFAULT_ZONES, ...staffZones];
  return [...new Set(merged.map((zone) => zone.trim()).filter(Boolean))];
}

export function AddStaffModal({
  open,
  roles,
  zones,
  onClose,
  onSubmit,
  onZonesChange,
}: Props) {
  const { t } = useI18n();
  const formId = useId();
  const [form, setForm] = useState(emptyForm);
  const [showCreateZone, setShowCreateZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setShowCreateZone(false);
      setNewZoneName('');
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !isPhoneComplete(form.phone) || !form.role_id || !form.zone) {
      return;
    }

    onSubmit({
      name: form.name.trim(),
      phone: form.phone.trim(),
      role_id: form.role_id,
      zone: form.zone,
    });
  }

  function handleCreateZone(event: React.FormEvent) {
    event.preventDefault();
    const label = newZoneName.trim();
    if (!label) return;

    if (!zones.includes(label)) {
      onZonesChange([...zones, label]);
    }
    setForm((current) => ({ ...current, zone: label }));
    setNewZoneName('');
    setShowCreateZone(false);
  }

  return (
    <div className="staff-qr-modal-backdrop" onClick={onClose}>
      <form
        className="staff-qr-modal staff-qr-modal--add-staff"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        aria-labelledby={`${formId}-title`}
      >
        <header className="staff-qr-modal__header">
          <div>
            <h3 id={`${formId}-title`}>{t('staffQr.addStaffTitle')}</h3>
            <p className="staff-qr-modal__subtitle">{t('staffQr.addStaffSubtitle')}</p>
          </div>
          <button
            type="button"
            className="staff-qr-modal__close"
            onClick={onClose}
            aria-label={t('staffQr.closeModal')}
          >
            <IconX />
          </button>
        </header>

        <div className="staff-qr-add-form">
          <label className="staff-qr-add-form__field">
            <span className="staff-qr-add-form__label">
              {t('staffQr.staffName')}
              <span className="staff-qr-add-form__required" aria-hidden="true">
                *
              </span>
            </span>
            <input
              type="text"
              value={form.name}
              placeholder={t('staffQr.namePlaceholder')}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>

          <div className="staff-qr-add-form__field">
            <span className="staff-qr-add-form__label">
              {t('staffQr.staffPhone')}
              <span className="staff-qr-add-form__required" aria-hidden="true">
                *
              </span>
            </span>
            <div className="staff-qr-phone-field">
              <PhoneInput
                defaultCountry="cl"
                preferredCountries={[...PREFERRED_PHONE_COUNTRIES]}
                value={form.phone}
                onChange={(phone) => setForm((current) => ({ ...current, phone }))}
                placeholder={t('staffQr.phonePlaceholder')}
                className="staff-qr-phone-field__input"
                inputClassName="staff-qr-phone-field__number"
                countrySelectorStyleProps={{
                  buttonClassName: 'staff-qr-phone-field__country-btn',
                  dropdownStyleProps: {
                    className: 'staff-qr-phone-field__dropdown',
                    listItemClassName: 'staff-qr-phone-field__dropdown-item',
                  },
                }}
              />
            </div>
          </div>

          <div className="staff-qr-add-form__field">
            <span className="staff-qr-add-form__label">
              {t('staffQr.staffRole')}
              <span className="staff-qr-add-form__required" aria-hidden="true">
                *
              </span>
            </span>
            <select
              className="staff-qr-add-form__select-full"
              value={form.role_id}
              required
              onChange={(event) =>
                setForm((current) => ({ ...current, role_id: event.target.value }))
              }
            >
              <option value="" disabled>
                {t('staffQr.selectRole')}
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {roleDisplayLabel(role, t)}
                </option>
              ))}
            </select>
          </div>

          <div className="staff-qr-add-form__field">
            <span className="staff-qr-add-form__label">
              {t('staffQr.staffZone')}
              <span className="staff-qr-add-form__required" aria-hidden="true">
                *
              </span>
            </span>
            <div className="staff-qr-add-form__combo">
              <select
                value={form.zone}
                required
                onChange={(event) => setForm((current) => ({ ...current, zone: event.target.value }))}
              >
                <option value="" disabled>
                  {t('staffQr.selectZone')}
                </option>
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="staff-qr-add-form__create-btn"
                onClick={() => setShowCreateZone(true)}
              >
                <IconPlus />
                {t('staffQr.createZone')}
              </button>
            </div>
          </div>

          <p className="staff-qr-add-form__hint">
            <IconInfo />
            <span>{t('staffQr.addStaffHint')}</span>
          </p>
        </div>

        <footer className="staff-qr-modal__footer">
          <button type="button" className="ghost-btn staff-qr-modal__cancel" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="primary-btn staff-qr-modal__save">
            {t('staffQr.saveStaff')}
          </button>
        </footer>
      </form>

      {showCreateZone ? (
        <div
          className="staff-qr-modal-backdrop staff-qr-modal-backdrop--nested"
          onClick={() => setShowCreateZone(false)}
        >
          <form
            className="staff-qr-modal staff-qr-modal--mini"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleCreateZone}
          >
            <header className="staff-qr-modal__header">
              <h3>{t('staffQr.createZoneTitle')}</h3>
              <button
                type="button"
                className="staff-qr-modal__close"
                onClick={() => setShowCreateZone(false)}
                aria-label={t('staffQr.closeModal')}
              >
                <IconX />
              </button>
            </header>
            <label className="staff-qr-add-form__field">
              <span className="staff-qr-add-form__label">{t('staffQr.createZoneLabel')}</span>
              <input
                type="text"
                value={newZoneName}
                placeholder={t('staffQr.createZonePlaceholder')}
                onChange={(event) => setNewZoneName(event.target.value)}
                autoFocus
                required
              />
            </label>
            <footer className="staff-qr-modal__footer">
              <button
                type="button"
                className="ghost-btn staff-qr-modal__cancel"
                onClick={() => setShowCreateZone(false)}
              >
                {t('common.cancel')}
              </button>
              <button type="submit" className="primary-btn staff-qr-modal__save">
                {t('staffQr.createZone')}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
