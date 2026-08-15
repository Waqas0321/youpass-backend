import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProducerPageActions } from '../../components/layout/ProducerPageActions';
import {
  IconInfo,
  IconList,
  IconPlus,
  IconTrash,
  IconUpload,
} from '../../components/ui/Icons';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useI18n } from '../../i18n/useI18n';
import { formatDateRangeLabel } from '../calendar/formatCalendarDates';
import {
  createGeneralProducerRow,
  createInitialRegistrationForm,
  PRODUCER_REGISTRATION_DATE_RANGE,
  type ProducerRegistrationFormState,
} from './producerRegistrationForm';

type SectionProps = {
  number: number;
  title: string;
  action?: ReactNode;
  children: React.ReactNode;
};

function RegistrationSection({ number, title, action, children }: SectionProps) {
  return (
    <section className="prod-reg-section">
      <header className="prod-reg-section__header">
        <div className="prod-reg-section__title-wrap">
          <span className="prod-reg-section__number">{number}</span>
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function FormField({
  id,
  label,
  value,
  placeholder,
  type = 'text',
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="prod-reg-field" htmlFor={id}>
      <span className="prod-reg-field__label">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function ProducerRegistrationPageContent() {
  const navigate = useNavigate();
  const { locale, t, dateLocale } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProducerRegistrationFormState>(createInitialRegistrationForm);

  const dateRangeLabel = useMemo(
    () =>
      formatDateRangeLabel(
        PRODUCER_REGISTRATION_DATE_RANGE.start,
        PRODUCER_REGISTRATION_DATE_RANGE.end,
        dateLocale,
      ),
    [dateLocale],
  );

  useDocumentTitle('producerRegistration');

  function updateField<K extends keyof ProducerRegistrationFormState>(
    key: K,
    value: ProducerRegistrationFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateProducer(id: string, key: 'fullName' | 'phone', value: string) {
    setForm((current) => ({
      ...current,
      generalProducers: current.generalProducers.map((row) =>
        row.id === id ? { ...row, [key]: value } : row,
      ),
    }));
  }

  function removeProducer(id: string) {
    setForm((current) => ({
      ...current,
      generalProducers:
        current.generalProducers.length <= 1
          ? current.generalProducers
          : current.generalProducers.filter((row) => row.id !== id),
    }));
  }

  function addProducer() {
    setForm((current) => ({
      ...current,
      generalProducers: [...current.generalProducers, createGeneralProducerRow()],
    }));
  }

  function handleLogoChange(file: File | null) {
    updateField('logoFileName', file?.name ?? null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <section className="prod-reg-page" key={locale}>
      <header className="prod-reg-page__header">
        <div className="prod-reg-page__intro">
          <h1>{t('producerRegistration.title')}</h1>
          <p>{t('producerRegistration.subtitle')}</p>
        </div>
        <ProducerPageActions dateRangeLabel={dateRangeLabel} />
      </header>

      <form className="prod-reg-form" onSubmit={handleSubmit}>
        <RegistrationSection
          number={1}
          title={t('producerRegistration.sectionOwnerTitle')}
          action={
            <button
              type="button"
              className="prod-reg-link-btn"
              onClick={() => navigate('/producer-registration/registered')}
            >
              <IconList className="prod-reg-link-btn__icon" aria-hidden="true" />
              <span>{t('producerRegistration.viewRegistered')}</span>
            </button>
          }
        >
          <div className="prod-reg-grid prod-reg-grid--2">
            <FormField
              id="owner-full-name"
              label={t('producerRegistration.ownerFullNameLabel')}
              value={form.ownerFullName}
              placeholder={t('producerRegistration.ownerFullNamePlaceholder')}
              onChange={(value) => updateField('ownerFullName', value)}
            />
            <FormField
              id="owner-contact"
              label={t('producerRegistration.contactNumberLabel')}
              value={form.ownerContactNumber}
              placeholder={t('producerRegistration.contactNumberPlaceholder')}
              onChange={(value) => updateField('ownerContactNumber', value)}
            />
          </div>
        </RegistrationSection>

        <RegistrationSection number={2} title={t('producerRegistration.sectionLegalTitle')}>
          <div className="prod-reg-grid prod-reg-grid--legal">
            <FormField
              id="legal-company-name"
              label={t('producerRegistration.legalNameLabel')}
              value={form.legalCompanyName}
              placeholder={t('producerRegistration.legalNamePlaceholder')}
              onChange={(value) => updateField('legalCompanyName', value)}
            />
            <div className="prod-reg-upload">
              <span className="prod-reg-field__label">{t('producerRegistration.logoLabel')}</span>
              <button
                type="button"
                className="prod-reg-upload__dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleLogoChange(event.dataTransfer.files?.[0] ?? null);
                }}
              >
                <IconUpload className="prod-reg-upload__icon" aria-hidden="true" />
                <strong>{t('producerRegistration.logoUploadTitle')}</strong>
                <span>{t('producerRegistration.logoUploadHint')}</span>
                {form.logoFileName ? (
                  <span className="prod-reg-upload__filename">{form.logoFileName}</span>
                ) : null}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                className="prod-reg-upload__input"
                onChange={(event) => handleLogoChange(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </RegistrationSection>

        <RegistrationSection number={3} title={t('producerRegistration.sectionAccessTitle')}>
          <FormField
            id="official-email"
            label={t('producerRegistration.officialEmailLabel')}
            value={form.officialEmail}
            placeholder={t('producerRegistration.officialEmailPlaceholder')}
            type="email"
            onChange={(value) => updateField('officialEmail', value)}
          />
          <div className="prod-reg-info" role="note">
            <IconInfo className="prod-reg-info__icon" aria-hidden="true" />
            <p>{t('producerRegistration.passwordInfo')}</p>
          </div>
        </RegistrationSection>

        <RegistrationSection number={4} title={t('producerRegistration.sectionProducersTitle')}>
          <ul className="prod-reg-producers">
            {form.generalProducers.map((row) => (
              <li key={row.id} className="prod-reg-producers__row">
                <FormField
                  id={`producer-name-${row.id}`}
                  label={t('producerRegistration.producerFullNameLabel')}
                  value={row.fullName}
                  placeholder={t('producerRegistration.producerFullNamePlaceholder')}
                  onChange={(value) => updateProducer(row.id, 'fullName', value)}
                />
                <FormField
                  id={`producer-phone-${row.id}`}
                  label={t('producerRegistration.producerPhoneLabel')}
                  value={row.phone}
                  placeholder={t('producerRegistration.producerPhonePlaceholder')}
                  onChange={(value) => updateProducer(row.id, 'phone', value)}
                />
                <button
                  type="button"
                  className="prod-reg-producers__remove"
                  aria-label={t('producerRegistration.removeProducer')}
                  onClick={() => removeProducer(row.id)}
                >
                  <IconTrash aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="prod-reg-add-btn" onClick={addProducer}>
            <IconPlus className="prod-reg-add-btn__icon" aria-hidden="true" />
            <span>{t('producerRegistration.addProducer')}</span>
          </button>
        </RegistrationSection>

        <footer className="prod-reg-form__footer">
          <button type="submit" className="prod-reg-form__submit">
            {t('producerRegistration.submit')}
          </button>
          <button
            type="button"
            className="prod-reg-form__cancel"
            onClick={() => navigate('/')}
          >
            {t('producerRegistration.cancel')}
          </button>
        </footer>
      </form>
    </section>
  );
}
