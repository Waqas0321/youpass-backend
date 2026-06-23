import { prisma } from '../src/config/database.js';

const EVENT_TITLE = 'Community Open Mic Night';

async function main() {
  const event = await prisma.event.findFirst({
    where: { title: EVENT_TITLE },
    select: { id: true, title: true },
  });

  if (!event) {
    throw new Error(`Event not found: ${EVENT_TITLE}`);
  }

  const invitations = await prisma.invitation.findMany({
    where: { eventId: event.id },
    include: {
      ticket: true,
      preAuth: true,
    },
    orderBy: { sentAt: 'desc' },
  });

  if (invitations.length === 0) {
    throw new Error(`No invitations found for ${EVENT_TITLE}`);
  }

  if (invitations.length > 1) {
    console.warn(
      `Found ${invitations.length} invitations — resetting only the most recent one.`,
    );
  }

  const invitation = invitations[0]!;

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

  const updated = await prisma.invitation.findUnique({
    where: { id: invitation.id },
    include: {
      recipient: { select: { fullName: true, phone: true } },
      ticket: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        event,
        reset_invitation: {
          id: updated?.id,
          status: updated?.status,
          source: updated?.source,
          tier: updated?.tier,
          recipient: updated?.recipient?.fullName ?? updated?.recipientPhone,
          has_ticket: Boolean(updated?.ticket),
        },
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
