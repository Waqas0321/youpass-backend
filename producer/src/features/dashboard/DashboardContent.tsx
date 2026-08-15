import { useMemo } from 'react';
import { producerDashboardDemo } from './dashboardDemo';
import { DashboardActiveEventsPanel } from './DashboardActiveEventsPanel';
import { DashboardDemographicsPanel } from './DashboardDemographicsPanel';
import { DashboardEventCalendarPanel } from './DashboardEventCalendarPanel';
import { DashboardFeaturedEventPanel } from './DashboardFeaturedEventPanel';
import { DashboardHeader } from './DashboardHeader';
import { DashboardRegisteredUsersPanel } from './DashboardRegisteredUsersPanel';
import { DashboardTicketSalesPanel } from './DashboardTicketSalesPanel';
import { formatDateRangeLabel } from '../calendar/formatCalendarDates';
import { useI18n } from '../../i18n/useI18n';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function DashboardContent() {
  const { dateLocale } = useI18n();
  const data = producerDashboardDemo;
  const dateRangeLabel = useMemo(
    () => formatDateRangeLabel(data.dateRangeStart, data.dateRangeEnd, dateLocale),
    [data.dateRangeEnd, data.dateRangeStart, dateLocale],
  );

  useDocumentTitle('dashboard');

  return (
    <section className="prod-dash">
      <DashboardHeader dateRangeLabel={dateRangeLabel} />

      <div className="prod-dash-grid">
        <div className="prod-dash-grid__col prod-dash-grid__col--left">
          <DashboardActiveEventsPanel items={data.activeEventsByProducer} />
          <DashboardRegisteredUsersPanel data={data.registeredUsers} />
        </div>

        <div className="prod-dash-grid__col prod-dash-grid__col--center">
          <DashboardEventCalendarPanel events={data.calendarEvents} />
          <DashboardDemographicsPanel
            genderSlices={data.genderSlices}
            ageGroups={data.ageGroups}
            countries={data.countries}
            cities={data.cities}
          />
        </div>

        <div className="prod-dash-grid__col prod-dash-grid__col--right">
          <DashboardTicketSalesPanel events={data.ticketSales} />
          <DashboardFeaturedEventPanel events={data.featuredEvents} />
        </div>
      </div>
    </section>
  );
}
