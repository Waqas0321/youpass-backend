/**
 * Repair: after a repurchase when the previous owner ticket was already scanned,
 * claim the first available slot on the latest paid order as a new personal ticket.
 *
 * Run: npx tsx scripts/repair-invite-guest-owner-ticket.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { prisma } from '../src/config/database.js';
import {
  generateEntryCode,
  generateQrPayload,
  hasPendingReentry,
} from '../src/modules/invitations/invitations.utils.js';
import { defaultCancellationDeadline } from '../src/modules/tickets/tickets.utils.js';

const PHONE = '+56988777123';

async function getSystemProducerId() {
  let producer = await prisma.producer.findFirst({ where: { name: 'YouPass' } });
  if (!producer) {
    producer = await prisma.producer.create({
      data: { name: 'YouPass', logoUrl: null },
    });
  }
  return producer.id;
}

async function hasActiveOwnerTicket(userId: string, eventId: string) {
  const ownerSlots = await prisma.ticketSlot.findMany({
    where: {
      status: 'owner',
      invitationId: { not: null },
      order: { buyerUserId: userId, eventId, status: 'paid' },
    },
    select: { invitationId: true },
  });
  const ids = ownerSlots
    .map((s) => s.invitationId)
    .filter((id): id is string => id != null);
  if (ids.length === 0) return false;

  const tickets = await prisma.invitationTicket.findMany({
    where: { invitationId: { in: ids } },
    select: {
      unlockAt: true,
      validatedAt: true,
      invitation: { select: { status: true } },
    },
  });

  return tickets.some((ticket) => {
    if (ticket.invitation.status === 'canceled') return false;
    if (!ticket.validatedAt) return ticket.invitation.status === 'accepted';
    return hasPendingReentry(ticket.unlockAt, ticket.validatedAt);
  });
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { phone: PHONE },
    select: { id: true, fullName: true, phone: true },
  });
  if (!user) {
    throw new Error(`User ${PHONE} not found`);
  }

  const orders = await prisma.ticketOrder.findMany({
    where: { buyerUserId: user.id, status: 'paid' },
    include: {
      event: true,
      slots: { orderBy: { slotNumber: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const repaired: string[] = [];

  for (const order of orders) {
    if (await hasActiveOwnerTicket(user.id, order.eventId)) {
      continue;
    }

    const slot = order.slots.find(
      (s) => s.status === 'available' && !s.invitationId,
    );
    if (!slot) {
      continue;
    }

    const producerId = await getSystemProducerId();
    const ticketId = crypto.randomBytes(12).toString('hex');
    const unlockAt = new Date();

    const invitation = await prisma.invitation.create({
      data: {
        eventId: order.eventId,
        producerId,
        recipientUserId: user.id,
        recipientPhone: user.phone,
        inviterUserId: user.id,
        source: 'guest',
        type: 'free',
        tier: order.tier,
        status: 'accepted',
        assignedSlot: `Entrada ${slot.slotNumber}`,
        entryValue: order.unitPrice ?? 0,
        amountToPay: 0,
        cancellationDeadline: defaultCancellationDeadline(order.event.startsAt),
        respondedAt: new Date(),
        sentAt: new Date(),
      },
    });

    await prisma.invitationTicket.create({
      data: {
        id: ticketId,
        invitationId: invitation.id,
        manualEntryId: generateEntryCode(),
        qrPayload: generateQrPayload(ticketId, order.eventId),
        unlockAt,
      },
    });

    await prisma.ticketSlot.update({
      where: { id: slot.id },
      data: { status: 'owner', invitationId: invitation.id },
    });

    repaired.push(
      `${order.event.title} order=${order.id} invitation=${invitation.id}`,
    );
  }

  console.log(
    repaired.length === 0
      ? 'No repairs needed (active owner tickets already exist or no free slots).'
      : `Repaired ${repaired.length} personal ticket(s):\n- ${repaired.join('\n- ')}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
