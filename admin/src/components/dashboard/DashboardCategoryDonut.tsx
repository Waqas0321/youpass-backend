import { useI18n } from '../../i18n/useI18n';

type CategorySlice = {
  id: string;
  label: string;
  value: number;
};

type DashboardCategoryDonutProps = {
  categories: CategorySlice[];
};

const CATEGORY_COLORS = ['#ffb800', '#e5a024', '#c88a12', '#a67310', '#8f5e0a'];

export function DashboardCategoryDonut({ categories }: DashboardCategoryDonutProps) {
  const { t } = useI18n();
  const total = categories.reduce((sum, slice) => sum + slice.value, 0) || 1;
  let offset = 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  return (
    <article className="dash-panel dash-panel--donut">
      <header className="dash-panel__header">
        <h3>{t('dashboard.ticketsByCategory')}</h3>
      </header>
      <div className="dash-donut">
        <svg viewBox="0 0 140 140" aria-hidden="true">
          <circle cx="70" cy="70" r={radius} className="dash-donut__track" />
          {categories.map((slice, index) => {
            const fraction = slice.value / total;
            const dash = fraction * circumference;
            const circle = (
              <circle
                key={slice.id}
                cx="70"
                cy="70"
                r={radius}
                className="dash-donut__slice"
                stroke={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += dash;
            return circle;
          })}
        </svg>
        <ul className="dash-donut__legend">
          {categories.length === 0 ? (
            <li className="dash-donut__empty">{t('dashboard.noTicketCategories')}</li>
          ) : (
            categories.map((slice, index) => (
              <li key={slice.id}>
                <span
                  className="dash-donut__swatch"
                  style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                />
                <span>{slice.label}</span>
                <strong>{Math.round((slice.value / total) * 100)}%</strong>
              </li>
            ))
          )}
        </ul>
      </div>
    </article>
  );
}
