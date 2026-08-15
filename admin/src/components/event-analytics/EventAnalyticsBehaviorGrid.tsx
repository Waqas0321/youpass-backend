import { useI18n } from '../../i18n/useI18n';
import { IconChart, IconDrink, IconTicket, IconUsers } from '../ui/Icons';
import type { EventAnalyticsView } from './buildEventAnalyticsView';
import { EventAnalyticsBehaviorCard } from './EventAnalyticsBehaviorCard';
import { formatAnalyticsPercent } from './formatAnalyticsDelta';

type Props = {
  behavior: EventAnalyticsView['behavior'];
};

function formatBehaviorDelta(deltaPct: number, locale: string) {
  const rounded = Math.round(deltaPct * 10) / 10;
  if (Number.isInteger(rounded)) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(rounded);
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rounded);
}

export function EventAnalyticsBehaviorGrid({ behavior }: Props) {
  const { t, numberLocale } = useI18n();

  const cards = [
    {
      tone: 'purple' as const,
      icon: <IconTicket />,
      label: t('eventAnalytics.peakEntryHour'),
      value: `${behavior.peakEntryHour ?? '—'}${t('eventAnalytics.behaviorHourSuffix')}`,
      deltaLabel: t('eventAnalytics.behaviorDeltaVsAverage', {
        value: formatBehaviorDelta(behavior.peakEntryDeltaPct, numberLocale),
      }),
      curve: behavior.peakEntryCurve,
      gradientId: 'behavior-entry-fill',
    },
    {
      tone: 'blue' as const,
      icon: <IconDrink />,
      label: t('eventAnalytics.peakConsumptionHour'),
      value: `${behavior.peakConsumptionHour ?? '—'}${t('eventAnalytics.behaviorHourSuffix')}`,
      deltaLabel: t('eventAnalytics.behaviorDeltaVsAverage', {
        value: formatBehaviorDelta(behavior.peakConsumptionDeltaPct, numberLocale),
      }),
      curve: behavior.peakConsumptionCurve,
      gradientId: 'behavior-consumption-fill',
    },
    {
      tone: 'green' as const,
      icon: <IconUsers />,
      label: t('eventAnalytics.recurringUsers'),
      value: new Intl.NumberFormat(numberLocale).format(behavior.recurringUsers),
      deltaLabel: t('eventAnalytics.behaviorDeltaVsAverage', {
        value: formatBehaviorDelta(behavior.recurringDeltaPct, numberLocale),
      }),
      curve: behavior.recurringCurve,
      gradientId: 'behavior-recurring-fill',
    },
    {
      tone: 'gold' as const,
      icon: <IconChart />,
      label: t('eventAnalytics.socialConversion'),
      value:
        behavior.socialConversionPct == null
          ? '—'
          : formatAnalyticsPercent(behavior.socialConversionPct, numberLocale),
      deltaLabel: t('eventAnalytics.behaviorDeltaVsAverage', {
        value: formatBehaviorDelta(behavior.socialDeltaPct, numberLocale),
      }),
      curve: behavior.socialCurve,
      gradientId: 'behavior-social-fill',
    },
  ];

  return (
    <section className="event-analytics__behavior">
      {cards.map((card) => (
        <EventAnalyticsBehaviorCard key={card.gradientId} {...card} />
      ))}
    </section>
  );
}
