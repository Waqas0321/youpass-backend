import { prisma } from '../src/config/database.js';

async function main() {
  const orders = await prisma.ticketOrder.findMany({
    where: { status: 'paid' },
    include: { buyer: true, slots: true, event: true },
    take: 10,
  });
  for (const o of orders) {
    const avail = o.slots.filter((s) => s.status === 'available').length;
    const assigned = o.slots.filter((s) => s.status === 'assigned').length;
    console.log(
      o.id,
      '|',
      o.event.title,
      '|',
      o.buyer.fullName,
      '| avail',
      avail,
      '| assigned',
      assigned,
      '| total',
      o.slots.length,
    );
  }
  await prisma.$disconnect();
}

main();
