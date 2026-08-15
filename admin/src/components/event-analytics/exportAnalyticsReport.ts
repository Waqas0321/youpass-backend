import type { DashboardSalesPeriod } from '../../api/client';
import type { AnalyticsExportFormat, AnalyticsExportReportId } from './EventAnalyticsExportModal';
import type { EventAnalyticsView } from './buildEventAnalyticsView';

function escapeCsv(value: string | number) {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvRow(cells: Array<string | number>) {
  return `${cells.map(escapeCsv).join(',')}\n`;
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob(['\uFEFF', content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function periodSlug(period: DashboardSalesPeriod) {
  return period.replace(/_/g, '-');
}

function buildFullReport(view: EventAnalyticsView, period: DashboardSalesPeriod) {
  let csv = csvRow(['YouPass Analytics Report']);
  csv += csvRow(['Period', period]);
  csv += csvRow(['Date range', view.dateRangeLabel]);
  csv += csvRow([]);
  csv += csvRow(['KPI', 'Value']);
  csv += csvRow(['Total sales', view.kpis.totalSales.value]);
  csv += csvRow(['Unique users', view.kpis.uniqueUsers.value]);
  csv += csvRow(['Sell-through %', view.kpis.sellThroughPct ?? '']);
  csv += csvRow(['Average ticket', view.kpis.avgTicket]);
  csv += csvRow([]);
  csv += csvRow(['Hour', 'Sales']);
  for (const point of view.hourlyRevenue) {
    csv += csvRow([`${String(point.hour).padStart(2, '0')}:00`, point.value]);
  }
  csv += csvRow([]);
  csv += csvRow(['Ticket type', 'Count']);
  for (const slice of view.ticketsByType) {
    csv += csvRow([slice.label, slice.value]);
  }
  csv += csvRow([]);
  csv += csvRow(['Category', 'Quantity']);
  for (const slice of view.consumptionByCategory) {
    csv += csvRow([slice.label, slice.value]);
  }
  csv += csvRow([]);
  csv += csvRow(['Zone', 'Revenue']);
  for (const slice of view.revenueByZone) {
    csv += csvRow([slice.label, slice.value]);
  }
  csv += csvRow([]);
  csv += csvRow(['Product', 'Count']);
  for (const item of view.topProducts) {
    csv += csvRow([item.name, item.count]);
  }
  return csv;
}

function buildSliceReport(title: string, headers: [string, string], rows: Array<{ label: string; value: number }>) {
  let csv = csvRow([title]);
  csv += csvRow(headers);
  for (const row of rows) {
    csv += csvRow([row.label, row.value]);
  }
  return csv;
}

function buildRankReport(title: string, rows: Array<{ name: string; count: number }>) {
  let csv = csvRow([title]);
  csv += csvRow(['Name', 'Count']);
  for (const row of rows) {
    csv += csvRow([row.name, row.count]);
  }
  return csv;
}

function buildHourlyReport(view: EventAnalyticsView) {
  let csv = csvRow(['Sales per hour']);
  csv += csvRow(['Hour', 'Revenue']);
  for (const point of view.hourlyRevenue) {
    csv += csvRow([`${String(point.hour).padStart(2, '0')}:00`, point.value]);
  }
  return csv;
}

function buildBehaviorReport(view: EventAnalyticsView) {
  let csv = csvRow(['User behavior']);
  csv += csvRow(['Peak entry hour', view.behavior.peakEntryHour ?? '']);
  csv += csvRow(['Peak consumption hour', view.behavior.peakConsumptionHour ?? '']);
  csv += csvRow(['Recurring users', view.behavior.recurringUsers]);
  csv += csvRow(['Recurring share %', view.behavior.recurringSharePct]);
  csv += csvRow(['Social conversion %', view.behavior.socialConversionPct ?? '']);
  return csv;
}

function reportCsv(view: EventAnalyticsView, reportId: AnalyticsExportReportId, period: DashboardSalesPeriod) {
  switch (reportId) {
    case 'full':
      return buildFullReport(view, period);
    case 'sales':
      return buildHourlyReport(view);
    case 'tickets':
      return buildSliceReport('Tickets by type', ['Type', 'Count'], view.ticketsByType);
    case 'consumption':
      return buildSliceReport('Consumption by category', ['Category', 'Quantity'], view.consumptionByCategory);
    case 'zones':
      return buildSliceReport('Revenue by zone', ['Zone', 'Revenue'], view.revenueByZone);
    case 'payments':
      return buildSliceReport('Payment methods', ['Method', 'Share %'], view.paymentMethods);
    case 'products':
      return buildRankReport('Product ranking', view.topProducts);
    case 'topTickets':
      return buildRankReport('Top selling tickets', view.topTickets);
    case 'vip':
      return buildRankReport('Top buyers', view.vipUsers);
    case 'peakEntry':
    case 'peakConsumption':
    case 'recurring':
    case 'social':
      return buildBehaviorReport(view);
    default:
      return buildFullReport(view, period);
  }
}

export function downloadAnalyticsReport(
  view: EventAnalyticsView,
  reportId: AnalyticsExportReportId,
  format: AnalyticsExportFormat,
  period: DashboardSalesPeriod = 'all_time',
) {
  const csv = reportCsv(view, reportId, period);
  const baseName = `analytics-${periodSlug(period)}-${reportId}`;

  if (format === 'excel') {
    downloadBlob(`${baseName}.csv`, csv, 'text/csv;charset=utf-8');
    return;
  }

  downloadBlob(`${baseName}.csv`, csv, 'text/csv;charset=utf-8');
}
