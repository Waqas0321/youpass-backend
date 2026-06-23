import { prisma } from '../src/config/database.js';
import { eventDrinkOrdersService } from '../src/modules/event-drinks/event-drink-orders.service.js';

async function main() {
  const user = await prisma.user.findFirst({
    where: { phone: '+923205905162' },
    select: { id: true, fullName: true },
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log('User:', user.id, user.fullName);

  try {
    const orders = await prisma.eventDrinkOrder.findMany({
      where: { userId: user.id },
      include: {
        event: { select: { id: true, title: true, startsAt: true } },
        lines: { include: { redemption: true }, orderBy: { createdAt: 'asc' } },
        redemptions: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    console.log('Raw orders count:', orders.length);
    for (const order of orders) {
      console.log('Order', order.id, 'lines', order.lines.length, 'redemptions', order.redemptions?.length);
    }
  } catch (error) {
    console.error('Prisma query failed:', error);
  }

  try {
    const payload = await eventDrinkOrdersService.listForUser(user.id);
    console.log('Formatted orders:', payload.orders.length);
    const target = payload.orders.find((order) => order.order_id === '5f04962a67a8ebcb1637bf49');
    console.log('List target entry codes:', target?.line_items.map((line) => line.entry_code));
  } catch (error) {
    console.error('Service list failed:', error);
  }

  try {
    const order = await eventDrinkOrdersService.getForUser(user.id, '5f04962a67a8ebcb1637bf49');
    console.log('Get single OK:', order.order_id, order.line_items.map((line) => line.entry_code));
  } catch (error) {
    console.error('Service get failed:', error);
  }
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());
