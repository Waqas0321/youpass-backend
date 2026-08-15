import { useEffect, useState } from 'react';
import type { AdminEventStaffQrDashboard } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { IconBan, IconCheckCircle } from '../ui/Icons';

const ZONE_BAR_COLORS: Record<string, string> = {
  'Barra Principal': '#9c5fd4',
  'Main bar': '#9c5fd4',
  'VIP 1': '#ffb800',
  'VIP 2': '#f472b6',
  'Acceso General': '#5b9cf6',
  'General access': '#5b9cf6',
  'Acceso VIP': '#ffb800',
  'Back stage': '#3ecf8e',
};

function zoneColor(zone: string) {
  return ZONE_BAR_COLORS[zone] ?? '#ffb800';
}

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

function MiniSparkline({ color }: { color: string }) {
  return (
    <svg className="staff-qr-sparkline" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 18 L15 14 L30 20 L45 10 L60 16 L75 8 L90 14 L105 6 L120 12"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  data: AdminEventStaffQrDashboard;
  fetchedAt?: string;
  onViewAll?: () => void;
};

export function StaffQrLiveSidebar({ data, fetchedAt, onViewAll }: Props) {
  const { t, numberLocale } = useI18n();
  const [updatedSecs, setUpdatedSecs] = useState(0);

  useEffect(() => {
    const anchor = fetchedAt ? new Date(fetchedAt).getTime() : Date.now();

    const sync = () => {
      setUpdatedSecs(Math.max(0, Math.round((Date.now() - anchor) / 1000)));
    };

    sync();
    const timer = window.setInterval(sync, 1000);
    return () => window.clearInterval(timer);
  }, [data.event_id, fetchedAt]);

  const zoneMax = Math.max(...data.activity_by_zone.map((row) => row.count), 1);
  const invalidShare = data.summary.invalid_qr_share_pct ?? 0;

  return (
    <aside className="staff-qr-sidebar">
      <article className="staff-qr-card staff-qr-card--live">
        <header className="staff-qr-live-header">
          <div>
            <h3>{t('staffQr.qrLive')}</h3>
            <p>{t('staffQr.updatedAgo', { secs: String(updatedSecs) })}</p>
          </div>
          <span className="staff-qr-live-badge">
            <span className="staff-qr-live-badge__dot" />
            {t('staffQr.liveBadge')}
          </span>
        </header>

        <h4 className="staff-qr-live-subtitle">{t('staffQr.recentScans')}</h4>
        <ul className="staff-qr-live">
          {data.qr_live.length === 0 ? (
            <li className="staff-qr-live__empty">{t('staffQr.recentScansEmpty')}</li>
          ) : (
            data.qr_live.slice(0, 5).map((item) => (
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
            ))
          )}
        </ul>
        <button
          type="button"
          className="staff-qr-live__view-all"
          disabled={!onViewAll || data.summary.scans_today === 0}
          onClick={onViewAll}
        >
          {t('staffQr.viewAllScans')}
        </button>

        <div className="staff-qr-mini-metrics">
          <article className="staff-qr-mini-metric staff-qr-mini-metric--red">
            <h4>{t('staffQr.invalidQrToday')}</h4>
            <strong>
              {new Intl.NumberFormat(numberLocale).format(data.summary.invalid_qr_today)}{' '}
              {t('staffQr.scansToday').toLowerCase()}
            </strong>
            {invalidShare > 0 ? (
              <span>
                {t('staffQr.invalidShare', {
                  pct: new Intl.NumberFormat(numberLocale, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }).format(invalidShare),
                })}
              </span>
            ) : null}
            <MiniSparkline color="#ff6b6b" />
          </article>

          {data.top_bar ? (
            <article className="staff-qr-mini-metric staff-qr-mini-metric--purple">
              <h4>{t('staffQr.topBar')}</h4>
              <strong className="staff-qr-mini-metric__name">{data.top_bar.name}</strong>
              <span>{t('staffQr.scansCount', { count: new Intl.NumberFormat(numberLocale).format(data.top_bar.scans) })}</span>
              <span>{t('staffQr.shareOfTotal', { pct: String(data.top_bar.share_pct) })}</span>
              <MiniSparkline color="#9c5fd4" />
            </article>
          ) : null}
        </div>

        <div className="staff-qr-zones-section">
          <h4>{t('staffQr.activityByZone')}</h4>
          <ul className="staff-qr-zones">
            {data.activity_by_zone.length === 0 ? (
              <li className="staff-qr-zones__empty">{t('staffQr.activityByZoneEmpty')}</li>
            ) : (
              data.activity_by_zone.map((row) => (
                <li key={row.zone}>
                  <div className="staff-qr-zones__row">
                    <span>{row.zone}</span>
                    <strong>{new Intl.NumberFormat(numberLocale).format(row.count)}</strong>
                  </div>
                  <div className="staff-qr-zones__bar">
                    <span
                      style={{
                        width: `${(row.count / zoneMax) * 100}%`,
                        background: zoneColor(row.zone),
                      }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </article>
    </aside>
  );
}
