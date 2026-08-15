import { DashboardActivityFeed } from './DashboardActivityFeed';
import { DashboardCategoryDonut } from './DashboardCategoryDonut';
import { DashboardCreateEventCta } from './DashboardCreateEventCta';
import { DashboardSalesChart, type HourlySalesPoint } from './DashboardSalesChart';
import { DashboardTopProducts } from './DashboardTopProducts';
import type { DashboardActivityItem } from './dashboardData';

type CategorySlice = {
  id: string;
  label: string;
  value: number;
};

type ProductRank = {
  id: string;
  name: string;
  count: number;
};

type DashboardBodyProps = {
  eventId?: string;
  hourlySalesLast24h: HourlySalesPoint[];
  activityItems: DashboardActivityItem[];
  topProducts: ProductRank[];
  categories: CategorySlice[];
};

export function DashboardBody({
  eventId,
  hourlySalesLast24h,
  activityItems,
  topProducts,
  categories,
}: DashboardBodyProps) {
  return (
    <div className="dash-body">
      <div className="dash-body__left">
        <DashboardSalesChart hourlySales={hourlySalesLast24h} />
        <div className="dash-body__split">
          <DashboardTopProducts eventId={eventId} topProducts={topProducts} />
          <DashboardCategoryDonut categories={categories} />
        </div>
      </div>
      <div className="dash-body__right">
        <DashboardActivityFeed eventId={eventId} items={activityItems} />
        <DashboardCreateEventCta />
      </div>
    </div>
  );
}
