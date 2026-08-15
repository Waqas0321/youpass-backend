import { useMemo } from 'react';
import { EventAnalyticsDonutPanel } from '../event-analytics/EventAnalyticsDonutPanel';
import { useI18n } from '../../i18n/useI18n';
import {
  DAILY_SALES_POINTS,
  formatPaymentClp,
  PAYMENT_METHOD_SLICES,
  REFUND_POINTS,
  REVENUE_BY_CATEGORY,
} from './eventPaymentsDemo';
import { EventPaymentsMiniLineChart } from './EventPaymentsMiniLineChart';

export function EventPaymentsChartsGrid() {
  const { t, numberLocale } = useI18n();

  const categorySlices = useMemo(
    () =>
      REVENUE_BY_CATEGORY.map((slice) => ({
        label: t(`eventPayments.categories.${slice.label}`),
        value: slice.value,
      })),
    [t],
  );

  const methodSlices = useMemo(
    () =>
      PAYMENT_METHOD_SLICES.map((slice) => ({
        label: t(`eventPayments.methods.labels.${slice.label}`),
        value: slice.value,
      })),
    [t],
  );

  const categoryTotal = REVENUE_BY_CATEGORY.reduce((sum, slice) => sum + slice.value, 0);
  const methodTotal = PAYMENT_METHOD_SLICES.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <section className="event-payments-charts-grid" aria-label={t('eventPayments.chartsSection')}>
      <EventPaymentsMiniLineChart
        title={t('eventPayments.charts.dailySales')}
        subtitle={t('eventPayments.charts.last7Days')}
        points={DAILY_SALES_POINTS}
        tone="purple"
      />
      <EventAnalyticsDonutPanel
        title={t('eventPayments.charts.revenueByCategory')}
        emptyLabel={t('eventPayments.emptyChart')}
        slices={categorySlices}
        palette="default"
        centerDisplay={formatPaymentClp(categoryTotal, numberLocale)}
      />
      <EventPaymentsMiniLineChart
        title={t('eventPayments.charts.refunds')}
        subtitle={t('eventPayments.charts.last7Days')}
        points={REFUND_POINTS}
        tone="red"
      />
      <EventAnalyticsDonutPanel
        title={t('eventPayments.charts.paymentMethods')}
        emptyLabel={t('eventPayments.emptyChart')}
        slices={methodSlices}
        palette="payment"
        panelVariant="payment"
        centerDisplay={formatPaymentClp(methodTotal, numberLocale)}
      />
    </section>
  );
}
