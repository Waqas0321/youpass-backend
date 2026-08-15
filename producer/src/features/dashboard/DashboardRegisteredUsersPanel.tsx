import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { formatSparklineLabel } from '../calendar/formatCalendarDates';
import {
  formatCount,
  formatPercent,
  formatThousandsLabel,
  sparklineAreaPath,
  sparklinePath,
} from './dashboardChartUtils';
import type { ProducerDashboardData } from './dashboardDemo';

type Props = {
  data: ProducerDashboardData['registeredUsers'];
};

const Y_LABELS = [90000, 75000, 60000, 30000];

export function DashboardRegisteredUsersPanel({ data }: Props) {
  const { t, dateLocale, numberLocale } = useI18n();
  const chartWidth = 320;
  const chartHeight = 120;
  const line = sparklinePath(data.trend, chartWidth, chartHeight);
  const area = sparklineAreaPath(data.trend, chartWidth, chartHeight);

  return (
    <article className="prod-dash-panel prod-dash-panel--users">
      <header className="prod-dash-panel__header">
        <h2>{t('dashboard.registeredUsers')}</h2>
        <Link to="/users" className="prod-dash-panel__link">
          {t('dashboard.viewFullReport')} →
        </Link>
      </header>

      <div className="prod-dash-kpis">
        <div className="prod-dash-kpi">
          <strong className="prod-dash-kpi__value">{formatCount(data.total, numberLocale)}</strong>
          <span className="prod-dash-kpi__label">{t('dashboard.totalUsers')}</span>
          <span className="prod-dash-kpi__delta prod-dash-kpi__delta--up">
            +{formatPercent(data.deltaPct, numberLocale)}% {t('dashboard.vsPreviousMonth')}
          </span>
        </div>
        <div className="prod-dash-kpi">
          <strong className="prod-dash-kpi__value">
            {formatCount(data.newLast30Days, numberLocale)}
          </strong>
          <span className="prod-dash-kpi__label">{t('dashboard.newUsers30Days')}</span>
        </div>
      </div>

      <div className="prod-dash-line-chart">
        <h3>{t('dashboard.registeredUsers')}</h3>
        <div className="prod-dash-line-chart__canvas">
          <div className="prod-dash-line-chart__y-axis" aria-hidden="true">
            {Y_LABELS.map((label) => (
              <span key={label}>{formatThousandsLabel(label, numberLocale)}</span>
            ))}
          </div>
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" aria-hidden="true">
            <path d={area} className="prod-dash-line-chart__area" />
            <path d={line} className="prod-dash-line-chart__line" />
          </svg>
        </div>
        <div className="prod-dash-line-chart__x-axis">
          {data.trend.map((point) => (
            <span key={point.date}>{formatSparklineLabel(point.date, dateLocale)}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
