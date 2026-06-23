import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { ticketOrdersService } from '../src/modules/ticket-orders/ticket-orders.service.js';

async function main() {
  const phone = process.argv[2] ?? '+923205905161';
  const user = await prisma.user.findFirst({ where: { phone } });
  if (!user) {
    console.log('USER NOT FOUND for', phone);
    return;
  }
  console.log('USER', user.id, user.fullName, user.phone);

  const orders = await prisma.ticketOrder.findMany({
    where: { buyerUserId: user.id, status: 'paid' },
    include: {
      event: { select: { title: true } },
      slots: { orderBy: { slotNumber: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  for (const order of orders) {
    console.log('\nORDER', order.id, order.event.title, 'qty', order.quantity);
    for (const slot of order.slots) {
      let inv = null;
      if (slot.invitationId) {
        inv = await prisma.invitation.findUnique({
          where: { id: slot.invitationId },
          select: {
            id: true,
            status: true,
            recipientPhone: true,
            recipientName: true,
          },
        });
      }
      console.log(
        '  SLOT',
        slot.slotNumber,
        slot.id,
        'db_status=',
        slot.status,
        'invitationId=',
        slot.invitationId,
        inv,
      );
    }

    const listed = await ticketOrdersService.listAssignments(user.id, order.id);
    console.log(
      '  API available=',
      listed.available_count,
      'pending=',
      listed.pending_count,
      'claimed=',
      listed.claimed_count,
    );
    for (const s of listed.slots) {
      console.log('    UI', s.slot_number, s.id, 'status=', s.status, 'can_send=', s.can_send);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
