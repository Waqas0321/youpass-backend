import { useMemo } from 'react';
import { EventAnalyticsDonutPanel } from '../event-analytics/EventAnalyticsDonutPanel';
import { useI18n } from '../../i18n/useI18n';
import { formatPaymentClp, type PaymentCategorySlice, type PaymentChartPoint } from './eventPaymentsDemo';
import { EventPaymentsMiniLineChart } from './EventPaymentsMiniLineChart';

type Props = {
  dailySales: PaymentChartPoint[];
  refundSeries: PaymentChartPoint[];
  revenueByCategory: PaymentCategorySlice[];
  paymentMethods: PaymentCategorySlice[];
};

export function EventPaymentsChartsGrid({
  dailySales,
  refundSeries,
  revenueByCategory,
  paymentMethods,
}: Props) {
  const { t, numberLocale } = useI18n();

  const categorySlices = useMemo(
    () =>
      revenueByCategory.map((slice) => {
        const key = `eventPayments.categories.${slice.label}`;
        const translated = t(key);
        return {
          label: translated === key ? slice.label : translated,
          value: slice.value,
        };
      }),
    [revenueByCategory, t],
  );

  const methodSlices = useMemo(
    () =>
      paymentMethods.map((slice) => {
        const key = `eventPayments.methods.labels.${slice.label}`;
        const translated = t(key);
        return {
          label: translated === key ? slice.label : translated,
          value: slice.value,
        };
      }),
    [paymentMethods, t],
  );

  const categoryTotal = revenueByCategory.reduce((sum, slice) => sum + slice.value, 0);
  const methodTotal = paymentMethods.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <section className="event-payments-charts-grid" aria-label={t('eventPayments.chartsSection')}>
      <EventPaymentsMiniLineChart
        title={t('eventPayments.charts.dailySales')}
        subtitle={t('eventPayments.charts.last7Days')}
        points={dailySales}
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
        points={refundSeries}
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
