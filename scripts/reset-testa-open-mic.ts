import { prisma } from '../src/config/database.js';

const PHONE = '+923205905162';
const EVENT_TITLE = 'Community Open Mic Night';

async function main() {
  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) {
    throw new Error(`User not found: ${PHONE}`);
  }

  const deletedCards = await prisma.userPaymentMethod.deleteMany({
    where: { userId: user.id },
  });

  const event = await prisma.event.findFirst({ where: { title: EVENT_TITLE } });
  if (!event) {
    throw new Error(`Event not found: ${EVENT_TITLE}`);
  }

  const invitation = await prisma.invitation.findFirst({
    where: {
      eventId: event.id,
      OR: [{ recipientUserId: user.id }, { recipientPhone: PHONE }],
    },
    orderBy: { updatedAt: 'desc' },
    include: { ticket: true, preAuth: true },
  });

  if (!invitation) {
    throw new Error(`No invitation found for ${PHONE} on ${EVENT_TITLE}`);
  }

  await prisma.$transaction(async (tx) => {
    if (invitation.preAuth) {
      await tx.invitationPreAuth.delete({ where: { invitationId: invitation.id } });
    }

    if (invitation.ticket) {
      await tx.invitationTicket.delete({ where: { invitationId: invitation.id } });
    }

    await tx.ticketSlot.updateMany({
      where: { invitationId: invitation.id },
      data: { invitationId: null, status: 'available' },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'sent',
        respondedAt: null,
        viewedAt: null,
        canceledAt: null,
        sentAt: new Date(),
      },
    });
  });

  const cardsLeft = await prisma.userPaymentMethod.count({ where: { userId: user.id } });
  const updated = await prisma.invitation.findUnique({
    where: { id: invitation.id },
    select: { id: true, status: true, entryValue: true, source: true, type: true },
  });

  console.log(
    JSON.stringify(
      {
        user: { id: user.id, phone: user.phone, fullName: user.fullName },
        deleted_cards: deletedCards.count,
        cards_remaining: cardsLeft,
        invitation: updated,
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
  .finally(async () => {
    await prisma.$disconnect();
  });
