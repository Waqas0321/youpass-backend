export type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

export type SparkPoint = {
  date: string;
  value: number;
};

export function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function buildDonutSegments(slices: DonutSlice[], radius = 46) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return slices.map((slice) => {
    const dash = (slice.value / total) * circumference;
    const segment = {
      ...slice,
      dash,
      offset,
      pct: (slice.value / total) * 100,
    };
    offset += dash;
    return segment;
  });
}

export function sparklinePath(points: SparkPoint[], width: number, height: number) {
  if (points.length === 0) {
    return '';
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point.value - min) / range) * (height - 8) - 4;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function sparklineAreaPath(points: SparkPoint[], width: number, height: number) {
  const line = sparklinePath(points, width, height);
  if (!line) {
    return '';
  }
  return `${line} L ${width} ${height} L 0 ${height} Z`;
}

export function formatThousandsLabel(value: number, locale: string) {
  if (value >= 1000) {
    const formatted = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(Math.round(value / 1000));
    return `${formatted}K`;
  }

  return new Intl.NumberFormat(locale).format(value);
}
