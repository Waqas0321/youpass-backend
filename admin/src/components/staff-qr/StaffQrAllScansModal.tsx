import { useEffect, useState } from 'react';
import { adminApi, type AdminEventStaffQrScanItem } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { IconBan, IconCheckCircle, IconChevronLeft, IconChevronRight, IconX } from '../ui/Icons';

const PAGE_SIZE = 12;

function liveInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

type Props = {
  open: boolean;
  eventId: string;
  onClose: () => void;
};

export function StaffQrAllScansModal({ open, eventId, onClose }: Props) {
  const { t, numberLocale } = useI18n();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [scans, setScans] = useState<AdminEventStaffQrScanItem[]>([]);

  useEffect(() => {
    if (!open || !eventId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    void adminApi.eventStaffQrScans(eventId, page, PAGE_SIZE).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok || !result.data) {
        setLoading(false);
        setError(result.error ?? t('staffQr.allScansLoadError'));
        return;
      }

      setScans(result.data.scans);
      setTotal(result.data.total);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [eventId, open, page, t]);

  useEffect(() => {
    if (open) {
      setPage(1);
    }
  }, [open, eventId]);

  if (!open) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="staff-qr-modal-backdrop" onClick={onClose}>
      <div
        className="staff-qr-modal staff-qr-modal--all-scans"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="staff-qr-modal__header">
          <div>
            <h2>{t('staffQr.allScansTitle')}</h2>
            <p className="staff-qr-modal__subtitle">{t('staffQr.allScansSubtitle')}</p>
          </div>
          <button
            type="button"
            className="staff-qr-modal__close"
            aria-label={t('staffQr.closeModal')}
            onClick={onClose}
          >
            <IconX />
          </button>
        </header>

        {loading ? (
          <p className="staff-qr-all-scans__status">{t('staffQr.loading')}</p>
        ) : error ? (
          <p className="staff-qr-all-scans__status staff-qr-all-scans__status--error">{error}</p>
        ) : scans.length === 0 ? (
          <p className="staff-qr-all-scans__status">{t('staffQr.allScansEmpty')}</p>
        ) : (
          <ul className="staff-qr-live staff-qr-live--modal">
            {scans.map((item) => (
              <li key={item.id}>
                <span className="staff-qr-live__avatar">{liveInitials(item.staff_name)}</span>
                <div className="staff-qr-live__body">
                  <div className="staff-qr-live__row">
                    <strong>{item.time_label}</strong>
                    <span>{item.staff_name}</span>
                  </div>
                  <p>
                    {item.detail} · {item.zone}
                  </p>
                </div>
                {item.outcome === 'already_used' ? (
                  <IconBan className="staff-qr-live__check staff-qr-live__check--invalid" />
                ) : (
                  <IconCheckCircle className="staff-qr-live__check" />
                )}
              </li>
            ))}
          </ul>
        )}

        <footer className="staff-qr-pagination staff-qr-all-scans__footer">
          <span>
            {t('staffQr.allScansShowing', {
              from: String(from),
              to: String(to),
              total: new Intl.NumberFormat(numberLocale).format(total),
            })}
          </span>
          <div className="staff-qr-pagination__controls">
            <button
              type="button"
              disabled={page <= 1}
              aria-label={t('staffQr.prevPage')}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <IconChevronLeft />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              aria-label={t('staffQr.nextPage')}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              <IconChevronRight />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
