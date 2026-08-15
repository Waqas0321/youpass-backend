import { useMemo } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { countryLabel, genderLabel } from '../../i18n/localize';
import { buildDonutSegments, formatPercent } from './dashboardChartUtils';
import { CITY_LABELS, producerBarLabel, type GenderSlice, type ProducerBarItem } from './dashboardDemo';

type Props = {
  genderSlices: GenderSlice[];
  ageGroups: ProducerBarItem[];
  countries: ProducerBarItem[];
  cities: ProducerBarItem[];
};

function HorizontalBars({
  title,
  items,
  resolveLabel,
  suffix = '%',
}: {
  title: string;
  items: ProducerBarItem[];
  resolveLabel: (item: ProducerBarItem) => string;
  suffix?: string;
}) {
  const { numberLocale } = useI18n();

  return (
    <div className="prod-dash-mini-panel">
      <h3>{title}</h3>
      <ul className="prod-dash-mini-bars">
        {items.map((item) => (
          <li key={item.id}>
            <span>{resolveLabel(item)}</span>
            <div className="prod-dash-mini-bars__track">
              <span
                className="prod-dash-mini-bars__fill"
                style={{
                  width: `${(item.value / item.max) * 100}%`,
                  background: item.color || '#a855f7',
                }}
              />
            </div>
            <strong>
              {suffix === '%'
                ? `${formatPercent(item.value, numberLocale)}%`
                : formatPercent(item.value, numberLocale)}
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GenderDonut({ title, slices }: { title: string; slices: GenderSlice[] }) {
  const { t, numberLocale } = useI18n();
  const chartSlices = useMemo(
    () =>
      slices.map((slice) => ({
        label: slice.id,
        value: slice.value,
        color: slice.color,
      })),
    [slices],
  );
  const segments = buildDonutSegments(chartSlices, 42);
  const radius = 42;

  return (
    <div className="prod-dash-mini-panel prod-dash-mini-panel--donut">
      <h3>{title}</h3>
      <div className="prod-dash-mini-donut">
        <svg viewBox="0 0 110 110" aria-hidden="true">
          <circle cx="55" cy="55" r={radius} className="prod-dash-mini-donut__track" />
          {segments.map((segment) => (
            <circle
              key={segment.label}
              cx="55"
              cy="55"
              r={radius}
              className="prod-dash-mini-donut__slice"
              stroke={segment.color}
              strokeDasharray={`${segment.dash} ${2 * Math.PI * radius - segment.dash}`}
              strokeDashoffset={-segment.offset}
              transform="rotate(-90 55 55)"
            />
          ))}
        </svg>
        <ul className="prod-dash-mini-donut__legend">
          {segments.map((segment) => (
            <li key={segment.label}>
              <span className="prod-dash-mini-donut__swatch" style={{ background: segment.color }} />
              <span>{genderLabel(t, segment.label as GenderSlice['id'])}</span>
              <strong>{formatPercent(segment.pct, numberLocale)}%</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function DashboardDemographicsPanel({ genderSlices, ageGroups, countries, cities }: Props) {
  const { t } = useI18n();

  return (
    <article className="prod-dash-panel prod-dash-panel--demographics">
      <header className="prod-dash-panel__header">
        <h2>{t('dashboard.demographics')}</h2>
      </header>
      <div className="prod-dash-demographics">
        <GenderDonut title={t('dashboard.byGender')} slices={genderSlices} />
        <HorizontalBars
          title={t('dashboard.byAge')}
          items={ageGroups}
          resolveLabel={(item) => item.id}
        />
        <HorizontalBars
          title={t('dashboard.byCountry')}
          items={countries}
          resolveLabel={(item) => countryLabel(t, item.id)}
        />
        <HorizontalBars
          title={t('dashboard.topCities')}
          items={cities}
          resolveLabel={(item) => producerBarLabel(item.id, CITY_LABELS[item.id])}
        />
      </div>
    </article>
  );
}
