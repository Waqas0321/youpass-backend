import crypto from 'node:crypto';
import type { Prisma, TicketSlot, TicketOrder, Event, User, Invitation } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { parseAndValidatePhone } from '../../common/utils/phone.js';
import {
  buildClaimUrl,
  invitationDeliveryMeta,
  invitationDeliveryService,
} from '../messaging/invitation-delivery.service.js';
import {
  eventDayStart,
  generateEntryCode,
  generateQrPayload,
} from '../invitations/invitations.utils.js';
import { getTimezone } from '../invitations/invitations.formatter.js';
import type { AssignTicketSlotInput, CheckoutInput } from './ticket-orders.validators.js';

type SlotWithInvitation = TicketSlot & {
  invitation: (Invitation & { ticket: { id: string } | null }) | null;
};

type OrderWithRelations = TicketOrder & {
  event: Event;
  slots: SlotWithInvitation[];
};

const DEFAULT_UNIT_PRICES: Record<string, number> = {
  general: 25000,
  vip: 48000,
};

async function getSystemProducerId(): Promise<string> {
  let producer = await prisma.producer.findFirst({ where: { name: 'YouPass' } });
  if (!producer) {
    producer = await prisma.producer.create({ data: { name: 'YouPass', logoUrl: null } });
  }
  return producer.id;
}

async function attachInvitations(slots: TicketSlot[]): Promise<SlotWithInvitation[]> {
  const invitationIds = slots.map((s) => s.invitationId).filter((id): id is string => id != null);
  const invitations = invitationIds.length
    ? await prisma.invitation.findMany({
        where: { id: { in: invitationIds } },
        include: { ticket: true },
      })
    : [];
  const byId = new Map(invitations.map((inv) => [inv.id, inv]));

  return slots.map((slot) => ({
    ...slot,
    invitation: slot.invitationId ? (byId.get(slot.invitationId) ?? null) : null,
  }));
}

/**
 * Accepts ticket order id, ticket/invitation id, or event id (Flutter may pass any of these).
 */
async function resolveOrderIdForBuyer(buyerUserId: string, refId: string): Promise<string> {
  const direct = await prisma.ticketOrder.findFirst({
    where: { id: refId, buyerUserId, status: 'paid' },
    select: { id: true },
  });
  if (direct) return direct.id;

  const invitation = await prisma.invitation.findFirst({
    where: {
      id: refId,
      recipientUserId: buyerUserId,
      status: { in: ['confirmed', 'validated'] },
    },
    select: { eventId: true },
  });

  const eventId = invitation?.eventId
    ?? (await prisma.event.findFirst({ where: { id: refId }, select: { id: true } }))?.id;

  if (eventId) {
    const byEvent = await prisma.ticketOrder.findFirst({
      where: { buyerUserId, eventId, status: 'paid' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (byEvent) return byEvent.id;
  }

  throw new AppError(
    404,
    'TICKET_ORDER_NOT_FOUND',
    'No assignable ticket order for this event. Purchase multiple tickets first, or use ticket_order_id from My Tickets.',
  );
}

async function getOrderForBuyer(refId: string, buyerUserId: string): Promise<OrderWithRelations> {
  const orderId = await resolveOrderIdForBuyer(buyerUserId, refId);
  const order = await prisma.ticketOrder.findFirst({
    where: { id: orderId, buyerUserId, status: 'paid' },
    include: {
      event: true,
      slots: { orderBy: { slotNumber: 'asc' } },
    },
  });

  if (!order) {
    throw new AppError(404, 'TICKET_ORDER_NOT_FOUND', 'Ticket order not found');
  }

  const slots = await attachInvitations(order.slots);

  return { ...order, slots };
}

function formatSlotStatus(slot: SlotWithInvitation): string {
  if (slot.status === 'owner') return 'owner';
  if (slot.status === 'claimed') return 'claimed';
  if (slot.status === 'assigned') {
    if (slot.invitation?.status === 'pending') return 'pending';
    if (slot.invitation?.status === 'confirmed') return 'claimed';
    if (slot.invitation?.status === 'rejected') return 'available';
  }
  return 'available';
}

function formatAssignmentSlot(slot: SlotWithInvitation) {
  const uiStatus = formatSlotStatus(slot);
  return {
    id: slot.id,
    slot_number: slot.slotNumber,
    label: `Entrada ${slot.slotNumber}`,
    status: uiStatus,
    guest_name: slot.guestName,
    guest_phone: slot.guestPhone,
    guest_country_code: slot.guestCountryCode,
    invitation_id: slot.invitationId,
    whatsapp_sent_at: slot.invitation?.whatsappSentAt?.toISOString() ?? null,
    can_send: uiStatus === 'available',
    can_cancel: uiStatus === 'pending',
    can_resend: uiStatus === 'pending',
  };
}

async function createBuyerTicket(
  tx: Prisma.TransactionClient,
  buyer: User,
  event: Event,
  order: TicketOrder,
  slot: TicketSlot,
) {
  const producerId = await getSystemProducerId();
  const timezone = getTimezone(event.countryCode);
  const unlockAt = eventDayStart(event.startsAt, timezone);
  const ticketId = crypto.randomBytes(12).toString('hex');
  const entryCode = generateEntryCode();
  const qrPayload = generateQrPayload(ticketId, event.id);

  const invitation = await tx.invitation.create({
    data: {
      eventId: event.id,
      producerId,
      recipientUserId: buyer.id,
      inviterUserId: buyer.id,
      source: 'guest',
      type: order.type,
      tier: order.tier,
      status: 'confirmed',
      assignedSlot: `Entrada ${slot.slotNumber}`,
      respondedAt: new Date(),
      sentAt: new Date(),
    },
  });

  await tx.invitationTicket.create({
    data: {
      id: ticketId,
      invitationId: invitation.id,
      manualEntryId: entryCode,
      qrPayload,
      unlockAt,
    },
  });

  await tx.ticketSlot.update({
    where: { id: slot.id },
    data: { status: 'owner', invitationId: invitation.id },
  });
}

export const ticketOrdersService = {
  async checkout(buyerUserId: string, eventId: string, input: CheckoutInput) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.status !== 'published') {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    if (!env.CHECKOUT_MOCK_PAYMENT && !input.payment_method_id) {
      throw new AppError(
        422,
        'PAYMENT_METHOD_REQUIRED',
        'A payment method is required to complete checkout',
      );
    }

    if (input.payment_method_id) {
      const method = await prisma.userPaymentMethod.findFirst({
        where: { userId: buyerUserId, providerToken: input.payment_method_id },
      });
      if (!method) {
        throw new AppError(404, 'PAYMENT_METHOD_NOT_FOUND', 'Payment method not found');
      }
    }

    const buyer = await prisma.user.findUniqueOrThrow({ where: { id: buyerUserId } });
    const unitPrice = DEFAULT_UNIT_PRICES[input.tier] ?? DEFAULT_UNIT_PRICES.general;
    const totalAmount = unitPrice * input.quantity;
    const paymentReference = env.CHECKOUT_MOCK_PAYMENT
      ? `mock_${crypto.randomBytes(6).toString('hex')}`
      : `pay_${crypto.randomBytes(8).toString('hex')}`;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.ticketOrder.create({
        data: {
          buyerUserId,
          eventId,
          quantity: input.quantity,
          tier: input.tier,
          type: input.type,
          unitPrice,
          totalAmount,
          currency: 'CLP',
          status: 'paid',
          paymentReference,
        },
      });

      const slots: TicketSlot[] = [];
      for (let i = 1; i <= input.quantity; i += 1) {
        const slot = await tx.ticketSlot.create({
          data: {
            orderId: created.id,
            slotNumber: i,
            status: i === 1 ? 'owner' : 'available',
          },
        });
        slots.push(slot);
      }

      await createBuyerTicket(tx, buyer, event, created, slots[0]!);

      return created;
    });

    const availableCount = Math.max(0, input.quantity - 1);

    return {
      order_id: order.id,
      event_id: event.id,
      event_title: event.title,
      quantity: order.quantity,
      total_amount: order.totalAmount,
      currency: order.currency,
      status: order.status,
      available_to_assign: availableCount,
      payment_reference: order.paymentReference,
    };
  },

  async listAssignments(buyerUserId: string, orderRef: string) {
    const order = await getOrderForBuyer(orderRef, buyerUserId);
    const slots = order.slots.map(formatAssignmentSlot);
    const availableCount = slots.filter((s) => s.status === 'available').length;
    const pendingCount = slots.filter((s) => s.status === 'pending').length;

    return {
      order_id: order.id,
      event_id: order.eventId,
      event_title: order.event.title,
      quantity: order.quantity,
      available_count: availableCount,
      pending_count: pendingCount,
      can_assign_in_parts: true,
      slots,
    };
  },

  async assignSlot(
    buyerUserId: string,
    orderId: string,
    slotId: string,
    input: AssignTicketSlotInput,
  ) {
    const order = await getOrderForBuyer(orderId, buyerUserId);
    const slot = order.slots.find((s) => s.id === slotId);

    if (!slot) {
      throw new AppError(404, 'TICKET_SLOT_NOT_FOUND', 'Ticket slot not found');
    }

    if (slot.status === 'owner') {
      throw new AppError(409, 'TICKET_SLOT_NOT_ASSIGNABLE', 'This ticket belongs to the buyer');
    }

    if (slot.status !== 'available') {
      throw new AppError(409, 'TICKET_SLOT_NOT_AVAILABLE', 'This ticket slot is not available');
    }

    const { e164, countryCode } = await parseAndValidatePhone(input.guest_phone, input.country_code);
    const buyer = await prisma.user.findUniqueOrThrow({ where: { id: buyerUserId } });

    if (e164 === buyer.phone) {
      throw new AppError(422, 'CANNOT_ASSIGN_TO_SELF', 'Assign tickets to guests, not yourself');
    }

    const existingGuest = await prisma.user.findUnique({ where: { phone: e164 } });
    const producerId = await getSystemProducerId();
    const claimToken = crypto.randomBytes(16).toString('hex');

    const invitation = await prisma.$transaction(async (tx) => {
      const created = await tx.invitation.create({
        data: {
          eventId: order.eventId,
          producerId,
          recipientUserId: existingGuest?.id ?? null,
          inviterUserId: buyerUserId,
          source: 'guest',
          recipientPhone: e164,
          recipientName: input.guest_name.trim(),
          claimToken,
          type: order.type,
          tier: order.tier,
          status: 'pending',
          assignedSlot: `Entrada ${slot.slotNumber}`,
          requiresPaymentMethod: false,
          termsAcceptedRequired: false,
          sentAt: new Date(),
        },
      });

      await tx.ticketSlot.update({
        where: { id: slot.id },
        data: {
          status: 'assigned',
          guestName: input.guest_name.trim(),
          guestPhone: e164,
          guestCountryCode: countryCode,
          invitationId: created.id,
        },
      });

      return created;
    });

    const claimUrl = buildClaimUrl(claimToken);

    try {
      await invitationDeliveryService.sendGuestInvitation({
        guestPhone: e164,
        guestName: input.guest_name.trim(),
        inviterName: buyer.fullName,
        eventTitle: order.event.title,
        claimUrl,
      });

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { whatsappSentAt: new Date() },
      });
    } catch (err) {
      await prisma.$transaction(async (tx) => {
        await tx.ticketSlot.update({
          where: { id: slot.id },
          data: {
            status: 'available',
            guestName: null,
            guestPhone: null,
            guestCountryCode: null,
            invitationId: null,
          },
        });
        await tx.invitation.delete({ where: { id: invitation.id } });
      });
      throw new AppError(
        502,
        'WHATSAPP_SEND_FAILED',
        'Could not send the invitation via WhatsApp. Please try again.',
        { reason: err instanceof Error ? err.message : 'unknown' },
      );
    }

    return {
      slot: formatAssignmentSlot({
        ...slot,
        status: 'assigned',
        guestName: input.guest_name.trim(),
        guestPhone: e164,
        guestCountryCode: countryCode,
        invitationId: invitation.id,
        invitation: {
          ...invitation,
          whatsappSentAt: new Date(),
          ticket: null,
        },
      }),
      claim_url: claimUrl,
      ...invitationDeliveryMeta(),
      message: invitationDeliveryMeta().delivery_mode === 'mock'
        ? 'Invitation saved (WhatsApp mock mode — no real message sent). Configure Twilio on the server for live delivery.'
        : 'Invitation sent via WhatsApp from YouPass',
    };
  },

  async cancelAssignment(buyerUserId: string, orderId: string, slotId: string) {
    const order = await getOrderForBuyer(orderId, buyerUserId);
    const slot = order.slots.find((s) => s.id === slotId);

    if (!slot) {
      throw new AppError(404, 'TICKET_SLOT_NOT_FOUND', 'Ticket slot not found');
    }

    if (slot.status !== 'assigned' || !slot.invitationId) {
      throw new AppError(409, 'TICKET_SLOT_NOT_CANCELLABLE', 'Only pending assigned tickets can be cancelled');
    }

    if (slot.invitation?.status === 'confirmed') {
      throw new AppError(409, 'TICKET_ALREADY_CLAIMED', 'Guest already accepted this ticket');
    }

    await prisma.$transaction(async (tx) => {
      await tx.invitation.update({
        where: { id: slot.invitationId! },
        data: { status: 'canceled', respondedAt: new Date() },
      });
      await tx.ticketSlot.update({
        where: { id: slot.id },
        data: {
          status: 'available',
          guestName: null,
          guestPhone: null,
          guestCountryCode: null,
          invitationId: null,
        },
      });
    });

    return {
      slot: formatAssignmentSlot({
        ...slot,
        status: 'available',
        guestName: null,
        guestPhone: null,
        guestCountryCode: null,
        invitationId: null,
        invitation: null,
      }),
    };
  },

  async resendAssignment(buyerUserId: string, orderId: string, slotId: string) {
    const order = await getOrderForBuyer(orderId, buyerUserId);
    const slot = order.slots.find((s) => s.id === slotId);

    if (!slot?.invitationId || slot.status !== 'assigned') {
      throw new AppError(409, 'TICKET_SLOT_NOT_RESENDABLE', 'Only pending assigned tickets can be resent');
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: slot.invitationId },
      include: { inviter: true },
    });

    if (!invitation || invitation.status !== 'pending' || !invitation.claimToken) {
      throw new AppError(409, 'TICKET_SLOT_NOT_RESENDABLE', 'Invitation is no longer pending');
    }

    const claimUrl = buildClaimUrl(invitation.claimToken);
    const inviterName = invitation.inviter?.fullName ?? 'Un amigo';

    await invitationDeliveryService.sendGuestInvitation({
      guestPhone: slot.guestPhone!,
      guestName: slot.guestName ?? invitation.recipientName ?? 'Invitado',
      inviterName,
      eventTitle: order.event.title,
      claimUrl,
    });

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { whatsappSentAt: new Date() },
    });

    return {
      slot: formatAssignmentSlot(slot),
      claim_url: claimUrl,
      ...invitationDeliveryMeta(),
      message: invitationDeliveryMeta().delivery_mode === 'mock'
        ? 'Invitation saved (WhatsApp mock mode — no real message sent). Configure Twilio on the server for live delivery.'
        : 'Invitation resent via WhatsApp from YouPass',
    };
  },

  async getAssignabilityByEvent(buyerUserId: string): Promise<Map<string, { orderId: string; available: number }>> {
    const orders = await prisma.ticketOrder.findMany({
      where: { buyerUserId, status: 'paid' },
      include: { slots: true },
    });

    const map = new Map<string, { orderId: string; available: number }>();
    for (const order of orders) {
      const available = order.slots.filter((s) => s.status === 'available').length;
      if (available > 0) {
        map.set(order.eventId, { orderId: order.id, available });
      }
    }
    return map;
  },
};
