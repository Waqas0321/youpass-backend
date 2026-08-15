import type { ReactNode } from 'react';

type Props = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  variant?: 'default' | 'danger';
  children: ReactNode;
};

export function StaffQrActionButton({
  label,
  disabled = false,
  onClick,
  variant = 'default',
  children,
}: Props) {
  return (
    <button
      type="button"
      className={`staff-qr-action-btn${variant === 'danger' ? ' staff-qr-action-btn--delete' : ''}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
