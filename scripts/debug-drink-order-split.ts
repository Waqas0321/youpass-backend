import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { eventDrinkOrdersService } from '../src/modules/event-drinks/event-drink-orders.service.js';

async function main() {
  const user = await prisma.user.findFirst({ where: { phone: '+923205905162' } });
  if (!user) {
    throw new Error('User not found');
  }

  const all = await prisma.eventDrinkOrder.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      subtotalClp: true,
      totalClp: true,
      isComplimentary: true,
      createdAt: true,
      lines: { select: { productName: true, unitPriceClp: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const courtesy = await eventDrinkOrdersService.listForUser(user.id, { complimentary: true });
  const purchases = await eventDrinkOrdersService.listForUser(user.id, { complimentary: false });

  console.log(
    JSON.stringify(
      {
        rawOrders: all.map((o) => ({
          id: o.id.slice(-5),
          subtotal: o.subtotalClp,
          total: o.totalClp,
          isComplimentary: o.isComplimentary,
          lines: o.lines.map((l) => `${l.productName}@${l.unitPriceClp}`),
        })),
        courtesyCount: courtesy.orders.length,
        purchasesCount: purchases.orders.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());
