import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { partyModeService } from '../src/modules/party-mode/party-mode.service.js';

const PHONE = '+923205905162';

async function main() {
  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) {
    throw new Error(`User not found: ${PHONE}`);
  }

  const invitations = await prisma.invitation.findMany({
    where: { recipientUserId: user.id },
    include: {
      ticket: true,
      event: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          latitude: true,
          longitude: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const slots = await prisma.ticketSlot.findMany({
    where: { invitationId: { in: invitations.map((row) => row.id) } },
    include: { order: { select: { id: true, status: true, eventId: true, totalAmount: true } } },
  });

  console.log(
    JSON.stringify(
      {
        user: { id: user.id, phone: user.phone, fullName: user.fullName },
        invitations: invitations.map((row) => ({
          id: row.id,
          status: row.status,
          source: row.source,
          event: row.event.title,
          validatedAt: row.ticket?.validatedAt,
        })),
        paidSlots: slots
          .filter((slot) => slot.order.status === 'paid')
          .map((slot) => ({
            invitationId: slot.invitationId,
            orderId: slot.order.id,
            eventId: slot.order.eventId,
          })),
      },
      null,
      2,
    ),
  );

  const partyMode = await partyModeService.resolveForUser(user.id, {
    lat: 31.5204,
    lng: 74.3587,
  });
  console.log('\nparty_mode (Lahore coords):', JSON.stringify(partyMode, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
