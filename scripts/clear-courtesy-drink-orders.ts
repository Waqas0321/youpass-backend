import 'dotenv/config';
import { prisma } from '../src/config/database.js';

const PHONE = process.argv[2] ?? '+923205905162';

async function main() {
  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) {
    throw new Error(`User not found: ${PHONE}`);
  }

  const courtesyOrders = await prisma.eventDrinkOrder.findMany({
    where: { userId: user.id, subtotalClp: 0 },
    select: { id: true, lines: { select: { productName: true } } },
  });

  if (courtesyOrders.length === 0) {
    console.log(JSON.stringify({ user: user.phone, deleted: 0, message: 'No courtesy orders found' }, null, 2));
    return;
  }

  const orderIds = courtesyOrders.map((order) => order.id);

  await prisma.eventDrinkRedemption.deleteMany({
    where: { orderId: { in: orderIds } },
  });

  await prisma.eventDrinkOrderLine.deleteMany({
    where: { orderId: { in: orderIds } },
  });

  const result = await prisma.eventDrinkOrder.deleteMany({
    where: { id: { in: orderIds } },
  });

  console.log(
    JSON.stringify(
      {
        user: { phone: user.phone, fullName: user.fullName },
        deleted: result.count,
        removedOrders: courtesyOrders.map((order) => ({
          id: order.id.slice(-5),
          products: order.lines.map((line) => line.productName),
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
