import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { ticketsService } from '../src/modules/tickets/tickets.service.js';

async function main() {
  const phone = process.argv[2] ?? '+923205905161';
  const user = await prisma.user.findFirst({ where: { phone } });
  if (!user) {
    console.log('no user');
    return;
  }
  console.log('USER', user.fullName, user.phone);

  const orders = await prisma.ticketOrder.findMany({
    where: { buyerUserId: user.id, status: 'paid' },
    include: {
      event: { select: { title: true } },
      slots: { orderBy: { slotNumber: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  for (const o of orders) {
    console.log('\nORDER', o.id, o.event.title, 'qty', o.quantity);
    for (const s of o.slots) {
      console.log(' ', s.slotNumber, s.status, s.invitationId);
    }
  }

  const upcoming = await ticketsService.listUpcoming(user.id, { page: 1, limit: 20 });
  console.log('\nUPCOMING API:');
  for (const t of upcoming.tickets) {
    console.log({
      title: t.event_title,
      order_id: t.ticket_order_id,
      assignable: t.assignable_count,
      pending: t.pending_assign_count,
      claimed: t.claimed_assign_count,
      can_assign: t.can_assign_tickets,
      can_view_assigned: t.can_view_assigned_tickets,
      origin: t.origin,
      id: t.id,
    });
  }
}

main()
  .finally(() => prisma.$disconnect());
