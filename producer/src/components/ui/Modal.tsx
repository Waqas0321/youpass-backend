import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from './Icons';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  closeLabel: string;
  headerLeading?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  panelClassName?: string;
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  closeLabel,
  headerLeading,
  children,
  footer,
  panelClassName = '',
}: Props) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="producer-modal__backdrop" onClick={onClose}>
      <div
        className={`producer-modal__panel ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="producer-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="producer-modal__header">
          <div className="producer-modal__header-main">
            {headerLeading}
            <div className="producer-modal__header-text">
              <h2 id="producer-modal-title">{title}</h2>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </div>
          <button type="button" className="producer-modal__close" onClick={onClose} aria-label={closeLabel}>
            <IconX />
          </button>
        </header>

        <div className="producer-modal__body">{children}</div>
        {footer ? <footer className="producer-modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
