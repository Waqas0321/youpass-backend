import { prisma } from '../src/config/database.js';

async function main() {
  const ticketByEvent = await prisma.ticketOrder.groupBy({
    by: ['eventId', 'status'],
    _count: { _all: true },
    _sum: { quantity: true },
  });

  const drinkByEvent = await prisma.eventDrinkOrder.groupBy({
    by: ['eventId', 'status'],
    _count: { _all: true },
    _sum: { itemCount: true },
  });

  const eventIds = [...new Set([...ticketByEvent.map((r) => r.eventId), ...drinkByEvent.map((r) => r.eventId)])];
  const events = await prisma.event.findMany({
    where: { id: { in: eventIds } },
    select: { id: true, title: true, city: true },
  });
  const eventMap = new Map(events.map((e) => [e.id, e]));

  console.log('=== Ticket orders by event ===');
  for (const row of ticketByEvent) {
    const event = eventMap.get(row.eventId);
    console.log(`${event?.title ?? row.eventId} | ${row.status} | count=${row._count._all} qty=${row._sum.quantity ?? 0}`);
  }

  console.log('\n=== Drink orders by event ===');
  for (const row of drinkByEvent) {
    const event = eventMap.get(row.eventId);
    console.log(`${event?.title ?? row.eventId} | ${row.status} | count=${row._count._all} items=${row._sum.itemCount ?? 0}`);
  }

  const redemptions = await prisma.eventDrinkRedemption.findMany({
    where: { validatedAt: { not: null } },
    select: {
      id: true,
      validatedAt: true,
      order: { select: { eventId: true, event: { select: { title: true } } } },
    },
    orderBy: { validatedAt: 'desc' },
    take: 10,
  });
  console.log('\n=== Recent drink redemptions ===');
  for (const r of redemptions) {
    console.log(`${r.order.event.title} | ${r.validatedAt?.toISOString()}`);
  }

  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { phone: { contains: '912345678' } },
        { phone: { contains: '923205905162' } },
        { phone: { contains: '3205905162' } },
      ],
    },
    select: { id: true, fullName: true, phone: true },
  });
  console.log('\n=== Test users ===');
  for (const u of testUsers) console.log(u);

  for (const user of testUsers) {
    const tickets = await prisma.ticketOrder.findMany({
      where: { buyerUserId: user.id },
      select: { event: { select: { title: true } }, status: true, quantity: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const drinks = await prisma.eventDrinkOrder.findMany({
      where: { userId: user.id },
      select: { event: { select: { title: true } }, status: true, itemCount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    console.log(`\nUser ${user.fullName} (${user.phone})`);
    console.log('  Tickets:', tickets);
    console.log('  Drinks:', drinks);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
