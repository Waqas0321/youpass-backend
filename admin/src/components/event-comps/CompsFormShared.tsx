import type { ReactNode } from 'react';
import { IconCalendar, IconChevronDown, IconClock, IconPlus, IconTicket } from '../ui/Icons';
import { COMP_TYPES, type CompTypeId } from './eventCompsUtils';
import { COMP_BENEFIT_MAX_LENGTH } from './eventCompsFormConstants';
import { useI18n } from '../../i18n/useI18n';

type FieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
};

export function CompsFormField({ label, required, hint, children }: FieldProps) {
  return (
    <div className="event-comps-form-field">
      <span className="event-comps-form-field__label">
        {label}
        {required ? <span className="event-comps-form-field__required">*</span> : null}
      </span>
      {children}
      {hint ? <span className="event-comps-form-field__hint">{hint}</span> : null}
    </div>
  );
}

type PhoneFieldProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

export function CompsPhoneField({ value, placeholder, onChange }: PhoneFieldProps) {
  return (
    <span className="event-comps-form-field__phone">
      <span className="event-comps-form-field__phone-prefix" aria-hidden="true">
        <span className="event-comps-form-field__flag">🇨🇱</span>
        +56
        <IconChevronDown />
      </span>
      <input
        type="tel"
        inputMode="tel"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </span>
  );
}

type TypeSelectProps = {
  value: CompTypeId | '';
  onChange: (value: CompTypeId | '') => void;
  onCreateType: () => void;
  placeholder: string;
  createLabel: string;
};

export function CompsTypeSelect({
  value,
  onChange,
  onCreateType,
  placeholder,
  createLabel,
}: TypeSelectProps) {
  const { t } = useI18n();

  return (
    <div className="event-comps-form-field__row">
      <label className="event-comps-form-field__select">
        <select value={value} onChange={(event) => onChange(event.target.value as CompTypeId | '')}>
          <option value="">{placeholder}</option>
          {COMP_TYPES.map((option) => (
            <option key={option.id} value={option.id}>
              {t(`eventComps.types.${option.id}`)}
            </option>
          ))}
        </select>
        <IconChevronDown />
      </label>
      <button type="button" className="event-comps-form-field__inline-btn" onClick={onCreateType}>
        <IconPlus />
        {createLabel}
      </button>
    </div>
  );
}

type BenefitTextareaProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

export function CompsBenefitTextarea({ value, placeholder, onChange }: BenefitTextareaProps) {
  return (
    <div className="event-comps-form-field__textarea-wrap">
      <textarea
        value={value}
        maxLength={COMP_BENEFIT_MAX_LENGTH}
        placeholder={placeholder}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="event-comps-form-field__counter">
        {value.length}/{COMP_BENEFIT_MAX_LENGTH}
      </span>
    </div>
  );
}

type TimeRangeProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromLabel: string;
  toLabel: string;
};

export function CompsTimeRangeField({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel,
  toLabel,
}: TimeRangeProps) {
  const { t } = useI18n();
  const placeholder = t('eventComps.createModal.timePlaceholder');

  return (
    <div className="event-comps-form-field__time-range">
      <label className="event-comps-form-field__time">
        <span>{fromLabel}</span>
        <span className="event-comps-form-field__time-input">
          <IconClock aria-hidden="true" />
          <input
            type="time"
            className={!from ? 'is-empty' : undefined}
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
          />
          {!from ? <span className="event-comps-form-field__time-placeholder">{placeholder}</span> : null}
        </span>
      </label>
      <label className="event-comps-form-field__time">
        <span>{toLabel}</span>
        <span className="event-comps-form-field__time-input">
          <IconClock aria-hidden="true" />
          <input
            type="time"
            className={!to ? 'is-empty' : undefined}
            value={to}
            onChange={(event) => onToChange(event.target.value)}
          />
          {!to ? <span className="event-comps-form-field__time-placeholder">{placeholder}</span> : null}
        </span>
      </label>
    </div>
  );
}

import { Alert } from '../ui/Alert';

type InfoBannerProps = {
  children: ReactNode;
};

export function CompsInfoBanner({ children }: InfoBannerProps) {
  return (
    <Alert tone="purple" className="event-comps-form-info">
      {children}
    </Alert>
  );
}

type CodeNoteProps = {
  children: ReactNode;
};

export function CompsCodeNote({ children }: CodeNoteProps) {
  return (
    <p className="event-comps-form-code-note">
      <span className="event-comps-form-code-note__icon" aria-hidden="true">
        <IconTicket />
      </span>
      <span>{children}</span>
    </p>
  );
}

export function CompsTextInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      className="event-comps-form-field__input"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function CompsDateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();

  return (
    <label className="event-comps-form-field__date">
      <IconCalendar aria-hidden="true" />
      <input
        type="date"
        className={`event-comps-form-field__date-input${value ? '' : ' is-empty'}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {!value ? (
        <span className="event-comps-form-field__date-placeholder">
          {t('eventComps.createModal.datePlaceholder')}
        </span>
      ) : null}
    </label>
  );
}
