import type { PaymentChartPoint } from './eventPaymentsDemo';

type Tone = 'purple' | 'red';

type Props = {
  title: string;
  subtitle: string;
  points: PaymentChartPoint[];
  tone: Tone;
};

function buildSmoothPath(
  values: number[],
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
) {
  if (values.length === 0) {
    return '';
  }

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...values, 1);
  const coords = values.map((value, index) => {
    const x = padding.left + (index / Math.max(values.length - 1, 1)) * chartWidth;
    const y = padding.top + chartHeight - (value / max) * chartHeight;
    return { x, y };
  });

  if (coords.length === 1) {
    return `M ${coords[0].x} ${coords[0].y}`;
  }

  let path = `M ${coords[0].x} ${coords[0].y}`;
  for (let index = 0; index < coords.length - 1; index += 1) {
    const current = coords[index];
    const next = coords[index + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

export function EventPaymentsMiniLineChart({ title, subtitle, points, tone }: Props) {
  const width = 320;
  const height = 200;
  const padding = { top: 20, right: 12, bottom: 8, left: 12 };
  const values = points.map((point) => point.value);
  const chartHeight = height - padding.top - padding.bottom;
  const linePath = buildSmoothPath(values, width, height, padding);
  const areaPath = `${linePath} L ${width - padding.right} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;
  const gradientId = `event-payments-line-${tone}`;
  const gridLines = [0.25, 0.5, 0.75].map((fraction) => padding.top + chartHeight * (1 - fraction));

  return (
    <article className={`event-payments-chart event-payments-chart--line event-payments-chart--${tone}`}>
      <header className="event-payments-chart__header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </header>
      <div className="event-payments-chart__canvas">
        <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone === 'purple' ? '#a855f7' : '#f87171'} stopOpacity="0.35" />
              <stop offset="100%" stopColor={tone === 'purple' ? '#a855f7' : '#f87171'} stopOpacity="0" />
            </linearGradient>
          </defs>
          {gridLines.map((y) => (
            <line
              key={y}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              className="event-payments-chart__grid-line"
            />
          ))}
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={linePath} className="event-payments-chart__line" />
        </svg>
        <div className="event-payments-chart__axis">
          {points.map((point) => (
            <span key={point.label}>{point.label}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
