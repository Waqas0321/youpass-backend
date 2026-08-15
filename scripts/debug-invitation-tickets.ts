import 'dotenv/config';
import { prisma } from '../src/config/database.js';

async function main() {
  const count = await prisma.invitationTicket.count();
  const pending = await prisma.invitationTicket.count({ where: { validatedAt: null } });
  console.log('total tickets:', count, 'pending:', pending);

  const tickets = await prisma.invitationTicket.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      invitation: {
        select: {
          status: true,
          recipientName: true,
          event: { select: { title: true } },
          recipient: { select: { fullName: true } },
        },
      },
    },
  });

  for (const ticket of tickets) {
    console.log({
      manualEntryId: ticket.manualEntryId,
      validatedAt: ticket.validatedAt?.toISOString() ?? null,
      status: ticket.invitation.status,
      event: ticket.invitation.event.title,
      guest: ticket.invitation.recipient?.fullName ?? ticket.invitation.recipientName,
    });
  }
}

main().finally(() => prisma.$disconnect());
