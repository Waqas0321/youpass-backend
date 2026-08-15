/**
 * Validates dashboard header data sources and period filter behavior.
 *
 * Usage:
 *   PORT=3002 npx tsx scripts/test-admin-dashboard-header.ts
 */
import 'dotenv/config';
import { pickDefaultDashboardPeriod } from '../admin/src/components/dashboard/dashboardData.js';
import type { DashboardSalesPeriod } from '../admin/src/api/client.ts';

const port = process.env.PORT ?? '3002';
const API = `http://localhost:${port}/api/v1`;
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key';

async function api<T>(path: string): Promise<{ ok: boolean; status: number; body: T }> {
  const response = await fetch(`${API}${path}`, {
    headers: { 'x-admin-api-key': ADMIN_KEY },
  });
  const body = (await response.json()) as T;
  return { ok: response.ok, status: response.status, body };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  console.log('Dashboard header test\n');

  const eventsRes = await api<{ success: boolean; data: { events: Array<{ id: string; title: string; producer_name?: string }> } }>(
    '/admin/events',
  );
  assert(eventsRes.ok, `GET /admin/events failed (${eventsRes.status})`);
  const lahore = eventsRes.body.data.events.find((e) => e.title.includes('Lahore'));
  assert(Boolean(lahore), 'Lahore Beats Festival event not found');
  const eventId = lahore!.id;
  console.log('✓ Events API — found', lahore!.title);

  const producersRes = await api<{ success: boolean; data: { producers: Array<{ name: string }> } }>(
    '/admin/producers',
  );
  assert(producersRes.ok, `GET /admin/producers failed (${producersRes.status})`);
  assert(producersRes.body.data.producers.length > 0, 'No producers for profile fallback');
  console.log('✓ Producers API — profile name source OK');

  const dashRes = await api<{
    success: boolean;
    data: {
      currency: string;
      kpis: Record<string, { value: number }>;
      hourly_ticket_sales_by_period: Record<DashboardSalesPeriod, Array<{ hour: number; value: number }>>;
      recent_activity: unknown[];
    };
  }>(`/admin/events/${eventId}/dashboard`);

  assert(dashRes.ok, `GET dashboard failed (${dashRes.status})`);
  const dash = dashRes.body.data;
  assert(dash.recent_activity.length > 0, 'Notifications feed has no activity items');
  console.log('✓ Dashboard API —', dash.recent_activity.length, 'activity items for bell popover');

  const hourly = dash.hourly_ticket_sales_by_period;
  assert(Boolean(hourly), 'hourly_ticket_sales_by_period missing');
  for (const period of ['today', 'yesterday', 'last_7_days', 'all_time'] as const) {
    assert(Array.isArray(hourly[period]) && hourly[period].length === 24, `Invalid hourly data for ${period}`);
  }
  console.log('✓ Period buckets — all 4 ranges return 24 hourly points');

  const defaultPeriod = pickDefaultDashboardPeriod(hourly);
  const allTimeTotal = hourly.all_time.reduce((sum, p) => sum + p.value, 0);
  assert(allTimeTotal > 0, 'Expected all_time sales for Lahore event');
  assert(defaultPeriod === 'all_time', `Default period should be all_time, got ${defaultPeriod}`);
  console.log('✓ Default period picker — selects all_time when older sales exist');

  const periodTotals = (['today', 'yesterday', 'last_7_days', 'all_time'] as const).map((p) => ({
    period: p,
    total: hourly[p].reduce((sum, point) => sum + point.value, 0),
  }));
  console.log('  Period totals:', periodTotals.map((p) => `${p.period}=${p.total}`).join(', '));

  assert(dash.kpis.tickets_sold.value > 0, 'KPI tickets_sold missing');
  assert(dash.kpis.active_users.value > 0, 'KPI active_users should be > 0 after fix');
  assert(dash.currency === 'PKR', `Expected PKR currency for PK event, got ${dash.currency}`);
  console.log('✓ KPIs + currency — tickets:', dash.kpis.tickets_sold.value, 'users:', dash.kpis.active_users.value, 'currency:', dash.currency);

  if (lahore!.producer_name) {
    console.log('✓ Producer display name from event:', lahore!.producer_name);
  }

  console.log('\nAll dashboard header checks passed.');
}

main().catch((err) => {
  console.error('\nFAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
