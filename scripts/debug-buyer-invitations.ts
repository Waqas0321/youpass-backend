import 'dotenv/config';
import { prisma } from '../src/config/database.js';

async function main() {
  const phone = process.argv[2] ?? '+923205905161';
  const user = await prisma.user.findFirst({ where: { phone } });
  if (!user) {
    console.log('no user');
    return;
  }

  const invs = await prisma.invitation.findMany({
    where: {
      recipientUserId: user.id,
      status: { in: ['accepted', 'validated'] },
      ticket: { isNot: null },
    },
    include: {
      event: { select: { title: true, startsAt: true } },
    },
    orderBy: { event: { startsAt: 'asc' } },
  });

  for (const inv of invs) {
    const slot = await prisma.ticketSlot.findFirst({
      where: { invitationId: inv.id },
      include: { order: { select: { id: true, quantity: true, buyerUserId: true } } },
    });
    console.log({
      invitationId: inv.id,
      event: inv.event.title,
      source: inv.source,
      assignedSlot: inv.assignedSlot,
      slotStatus: slot?.status ?? 'no-slot',
      orderId: slot?.orderId ?? null,
      orderQty: slot?.order?.quantity ?? null,
      isOwnerSlot: slot?.status === 'owner',
    });
  }
}

main().finally(() => prisma.$disconnect());
