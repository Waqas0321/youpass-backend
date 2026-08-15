import type { ReactNode } from 'react';

type EventInfoFieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function EventInfoField({
  label,
  required = false,
  hint,
  icon,
  className,
  children,
}: EventInfoFieldProps) {
  return (
    <label className={`event-info-field ${className ?? ''}`.trim()}>
      <span className="event-info-field__label">
        {label}
        {required ? <span className="event-info-field__required">*</span> : null}
      </span>
      <span className={`event-info-field__control${icon ? ' event-info-field__control--icon' : ''}`}>
        {icon ? <span className="event-info-field__icon">{icon}</span> : null}
        {children}
      </span>
      {hint ? <span className="event-info-field__hint">{hint}</span> : null}
    </label>
  );
}
