import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from './Icons';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  titleIcon?: ReactNode;
  headerAction?: ReactNode;
  closeLabel: string;
  titleId?: string;
  contentClassName?: string;
  backdropClassName?: string;
  error?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  titleIcon,
  headerAction,
  closeLabel,
  titleId = 'app-modal-title',
  contentClassName = 'modal__panel',
  backdropClassName = 'modal__backdrop',
  error,
  children,
  footer,
}: ModalProps) {
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
    <div className={backdropClassName} onClick={onClose}>
      <div
        className={contentClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={`modal__header${headerAction ? ' modal__header--split' : ''}`}>
          {headerAction ? (
            <>
              <div className="modal__header-row">
                <h2 id={titleId} className={titleIcon ? 'modal__title-with-icon' : undefined}>
                  {titleIcon ? <span className="modal__title-icon">{titleIcon}</span> : null}
                  <span>{title}</span>
                </h2>
                <div className="modal__header-actions">
                  {headerAction}
                  <button type="button" className="modal__close" onClick={onClose} aria-label={closeLabel}>
                    <IconX />
                  </button>
                </div>
              </div>
              {subtitle ? <p className="modal__header-subtitle">{subtitle}</p> : null}
            </>
          ) : (
            <>
              <div className="modal__header-main">
                <h2 id={titleId} className={titleIcon ? 'modal__title-with-icon' : undefined}>
                  {titleIcon ? <span className="modal__title-icon">{titleIcon}</span> : null}
                  <span>{title}</span>
                </h2>
                {subtitle ? <p>{subtitle}</p> : null}
              </div>
              <div className="modal__header-actions">
                <button type="button" className="modal__close" onClick={onClose} aria-label={closeLabel}>
                  <IconX />
                </button>
              </div>
            </>
          )}
        </header>

        {error ? <p className="modal__error">{error}</p> : null}

        <div className="modal__body">{children}</div>

        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
