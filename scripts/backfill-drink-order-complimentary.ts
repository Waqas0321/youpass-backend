import 'dotenv/config';
import { prisma } from '../src/config/database.js';

async function main() {
  const orders = await prisma.eventDrinkOrder.findMany({
    select: { id: true, subtotalClp: true, isComplimentary: true },
  });

  let updated = 0;
  for (const order of orders) {
    const expected = order.subtotalClp === 0;
    if (order.isComplimentary !== expected) {
      await prisma.eventDrinkOrder.update({
        where: { id: order.id },
        data: { isComplimentary: expected },
      });
      updated += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        scanned: orders.length,
        updated,
        courtesy: orders.filter((order) => order.subtotalClp === 0).length,
        paid: orders.filter((order) => order.subtotalClp > 0).length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());
