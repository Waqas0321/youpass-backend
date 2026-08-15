import { useMemo } from 'react';
import type { GenderSlice, ProducerBarItem } from '../dashboard/dashboardDemo';
import { buildDonutSegments, formatPercent } from '../dashboard/dashboardChartUtils';
import { genderLabel } from '../../i18n/localize';
import { useI18n } from '../../i18n/useI18n';

type Props = {
  genderSlices: GenderSlice[];
  ageGroups: ProducerBarItem[];
};

export function ReportsDemographicsPanel({ genderSlices, ageGroups }: Props) {
  const { locale, t, numberLocale } = useI18n();

  const chartSlices = useMemo(
    () =>
      genderSlices.map((slice) => ({
        label: slice.id,
        value: slice.value,
        color: slice.color,
      })),
    [genderSlices],
  );
  const segments = buildDonutSegments(chartSlices, 42);
  const radius = 42;

  return (
    <article className="prod-reports-panel prod-reports-panel--demographics" key={locale}>
      <header className="prod-reports-panel__header">
        <h2>{t('reports.attendeeDemographics')}</h2>
      </header>

      <div className="prod-reports-demographics">
        <div className="prod-reports-demographics__gender">
          <h3>{t('dashboard.byGender')}</h3>
          <div className="prod-reports-demographics__donut">
            <svg
              width="104"
              height="104"
              viewBox="0 0 104 104"
              aria-hidden="true"
            >
              <circle cx="52" cy="52" r={radius} className="prod-reports-demographics__track" />
              {segments.map((segment) => (
                <circle
                  key={segment.label}
                  cx="52"
                  cy="52"
                  r={radius}
                  className="prod-reports-demographics__slice"
                  stroke={segment.color}
                  strokeDasharray={`${segment.dash} ${2 * Math.PI * radius - segment.dash}`}
                  strokeDashoffset={-segment.offset}
                  transform="rotate(-90 52 52)"
                />
              ))}
            </svg>
            <ul className="prod-reports-demographics__legend">
              {segments.map((segment) => (
                <li key={segment.label}>
                  <span
                    className="prod-reports-demographics__swatch"
                    style={{ background: segment.color }}
                  />
                  <span>{genderLabel(t, segment.label as GenderSlice['id'])}</span>
                  <strong>{formatPercent(segment.pct, numberLocale)}%</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="prod-reports-demographics__age">
          <h3>{t('dashboard.byAge')}</h3>
          <ul className="prod-reports-demographics__bars">
            {ageGroups.map((group) => (
              <li key={group.id}>
                <span>{group.id}</span>
                <div className="prod-reports-demographics__bar-track">
                  <span
                    className="prod-reports-demographics__bar-fill"
                    style={{ width: `${(group.value / group.max) * 100}%` }}
                  />
                </div>
                <strong>{formatPercent(group.value, numberLocale)}%</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
