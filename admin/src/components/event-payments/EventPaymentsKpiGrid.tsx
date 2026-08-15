import type { ReactNode } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { IconInfo, IconTrending } from '../ui/Icons';
import { formatPaymentClp, type PaymentKpi } from './eventPaymentsDemo';

type KpiId = PaymentKpi['id'];

type Props = {
  kpis: PaymentKpi[];
  icons: Record<KpiId, ReactNode>;
};

function formatDelta(deltaPct: number, locale: string) {
  const sign = deltaPct >= 0 ? '+ ' : '- ';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(deltaPct));
  return `${sign}${formatted}%`;
}

function deltaClassName(kpi: PaymentKpi) {
  if (kpi.deltaTone === 'neutral') {
    return 'is-neutral';
  }
  if (kpi.deltaTone === 'bad') {
    return 'is-bad';
  }
  return kpi.deltaPct >= 0 ? 'is-up' : 'is-down';
}

export function EventPaymentsKpiGrid({ kpis, icons }: Props) {
  const { t, numberLocale } = useI18n();

  return (
    <section className="event-payments-kpi-grid" aria-label={t('eventPayments.kpiSection')}>
      {kpis.map((kpi) => {
        const deltaText =
          kpi.deltaPct === 0 && kpi.deltaTone === 'neutral'
            ? '- 0.0%'
            : formatDelta(kpi.deltaPct, numberLocale);
        const deltaLabel = t('eventPayments.kpi.vsPreviousPeriod', { delta: deltaText });

        return (
          <article key={kpi.id} className={`event-payments-kpi event-payments-kpi--${kpi.tone}`}>
            <span className="event-payments-kpi__icon">{icons[kpi.id]}</span>
            <div className="event-payments-kpi__body">
              <p className="event-payments-kpi__label">
                {t(`eventPayments.kpi.${kpi.id}`)}
                <button type="button" className="event-payments-kpi__info" aria-label={t('eventPayments.kpi.info')}>
                  <IconInfo />
                </button>
              </p>
              <strong className="event-payments-kpi__value">{formatPaymentClp(kpi.value, numberLocale)}</strong>
              <p className={`event-payments-kpi__delta ${deltaClassName(kpi)}`}>
                <IconTrending className="event-payments-kpi__delta-icon" />
                <span>{deltaLabel}</span>
              </p>
            </div>
          </article>
        );
      })}
    </section>
  );
}
