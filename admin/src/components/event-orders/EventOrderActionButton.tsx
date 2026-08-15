import type { ReactNode } from 'react';

type Props = {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function EventOrderActionButton({ label, icon, danger = false, disabled, onClick }: Props) {
  return (
    <button
      type="button"
      className={`event-orders-action${danger ? ' event-orders-action--danger' : ''}`}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="event-orders-action__icon">{icon}</span>
      <span className="event-orders-action__label">{label}</span>
    </button>
  );
}
