import { prisma } from '../src/config/database.js';
import { adminEventDashboardService } from '../src/modules/admin/admin-event-dashboard.service.js';

async function main() {
  const event = await prisma.event.findFirst({
    where: { title: { contains: 'New Year Gala Islamabad', mode: 'insensitive' } },
    select: { id: true, title: true, startsAt: true, city: true },
  });

  if (!event) {
    const events = await prisma.event.findMany({
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
    console.log('Event not found. Recent events:');
    for (const row of events) console.log(`- ${row.id} | ${row.title}`);
    return;
  }

  console.log('Event:', event.id, event.title, event.city, event.startsAt.toISOString());

  const ticketOrders = await prisma.ticketOrder.groupBy({
    by: ['status'],
    where: { eventId: event.id },
    _count: { _all: true },
    _sum: { quantity: true },
  });
  console.log('\nTicket orders by status:', ticketOrders);

  const drinkOrders = await prisma.eventDrinkOrder.groupBy({
    by: ['status'],
    where: { eventId: event.id },
    _count: { _all: true },
    _sum: { itemCount: true },
  });
  console.log('\nDrink orders by status:', drinkOrders);

  const redemptions = await prisma.eventDrinkRedemption.count({
    where: { order: { eventId: event.id }, validatedAt: { not: null } },
  });
  console.log('\nDrink redemptions (validated):', redemptions);

  const sampleTickets = await prisma.ticketOrder.findMany({
    where: { eventId: event.id },
    select: { id: true, status: true, quantity: true, createdAt: true, buyer: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('\nSample ticket orders:', sampleTickets);

  const sampleDrinks = await prisma.eventDrinkOrder.findMany({
    where: { eventId: event.id },
    select: {
      id: true,
      status: true,
      itemCount: true,
      createdAt: true,
      user: { select: { fullName: true } },
      lines: { select: { productName: true, quantity: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('\nSample drink orders:', JSON.stringify(sampleDrinks, null, 2));

  const dashboard = await adminEventDashboardService.getEventDashboard(event.id);
  console.log('\nDashboard KPIs:', dashboard.kpis);
  console.log('Top bar items:', dashboard.top_bar_items);
  console.log('Tickets by category:', dashboard.tickets_by_category);
  console.log('Recent activity count:', dashboard.recent_activity.length);
  const lahore = await prisma.event.findFirst({ where: { title: 'Lahore Beats Festival' } });
  if (lahore) {
    const lahoreDash = await adminEventDashboardService.getEventDashboard(lahore.id);
    console.log('\n=== Lahore Beats Festival dashboard (has test data) ===');
    console.log('tickets sold:', lahoreDash.kpis.tickets_sold.value);
    console.log('bar consumption:', lahoreDash.kpis.bar_consumption.value);
    console.log('top bar:', lahoreDash.top_bar_items);
    console.log('activity:', lahoreDash.recent_activity.length);
    console.log('categories:', lahoreDash.tickets_by_category);
  }

  const invCount = await prisma.invitation.count({ where: { eventId: event.id } });
  console.log('\nInvitations for Islamabad:', invCount);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
