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
import { getTimezone, getEventCurrencyMeta } from '../../common/services/country-config.service.js';
import { invitationConfigService } from '../../common/services/invitation-config.service.js';
import type { AssignTicketSlotInput, CheckoutInput } from './ticket-orders.validators.js';
import { vipVenueService } from '../vip-venue/vip-venue.service.js';
import { producersService } from '../producers/producers.service.js';
import { DEFAULT_SERVICE_FEE_RATE } from '../vip-venue/vip-venue.constants.js';
import { getActiveCountry } from '../../common/services/country-config.service.js';
import { defaultCancellationDeadline } from '../tickets/tickets.utils.js';
import {
  preparePayment,
  resolvePaymentGateway,
} from '../payments/payment-gateway.service.js';

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

/** MongoDB transactions on serverless need extra time for multi-slot VIP table orders. */
const CHECKOUT_TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 } as const;

type DbClient = Prisma.TransactionClient | typeof prisma;

async function getSystemProducerId(tx: DbClient = prisma): Promise<string> {
  let producer = await tx.producer.findFirst({ where: { name: 'YouPass' } });
  if (!producer) {
    producer = await tx.producer.create({ data: { name: 'YouPass', logoUrl: null } });
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
      status: { in: ['accepted', 'validated'] },
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
    if (slot.invitation?.status === 'sent' || slot.invitation?.status === 'viewed') return 'pending';
    if (slot.invitation?.status === 'accepted') return 'claimed';
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
  assignedSlotLabel?: string,
) {
  const producerId = await getSystemProducerId(tx);
  const timezone = getTimezone(event.countryCode);
  const unlockAt = eventDayStart(event.startsAt, timezone);
  const ticketId = crypto.randomBytes(12).toString('hex');
  const entryCode = generateEntryCode();
  const qrPayload = generateQrPayload(ticketId, event.id);
  const slotLabel = assignedSlotLabel ?? `Entrada ${slot.slotNumber}`;

  const invitation = await tx.invitation.create({
    data: {
      eventId: event.id,
      producerId,
      recipientUserId: buyer.id,
      recipientPhone: buyer.phone,
      inviterUserId: buyer.id,
      source: 'guest',
      type: 'free',
      tier: order.tier,
      status: 'accepted',
      assignedSlot: slotLabel,
      entryValue: order.unitPrice ?? 0,
      amountToPay: 0,
      cancellationDeadline: defaultCancellationDeadline(event.startsAt),
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

  return { ticketId: invitation.id, invitationTicketId: ticketId, unlockAt };
}

export const ticketOrdersService = {
  async checkout(buyerUserId: string, eventId: string, input: CheckoutInput) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.status !== 'published') {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    await producersService.assertFollowerPresaleAccess(buyerUserId, eventId);

    if (input.payment_method_id) {
      const method = await prisma.userPaymentMethod.findFirst({
        where: { userId: buyerUserId, providerToken: input.payment_method_id },
      });
      if (!method) {
        throw new AppError(404, 'PAYMENT_METHOD_NOT_FOUND', 'Payment method not found');
      }
    }

    const buyer = await prisma.user.findUniqueOrThrow({ where: { id: buyerUserId } });
    const serviceFeeRate = DEFAULT_SERVICE_FEE_RATE;
    let subtotal = 0;
    let quantity = input.quantity ?? 1;
    let tier = input.tier;
    let type = input.type;
    let venueTableId: string | undefined;
    let venueZoneId: string | undefined;
    let ticketOfferingId: string | undefined;
    let assignedSlotLabel: string | undefined;
    let unitPrice = DEFAULT_UNIT_PRICES[tier] ?? DEFAULT_UNIT_PRICES.general;

    if (input.table_id) {
      const { zone, table } = await (async () => {
        const layout = await prisma.eventVenueLayout.findUnique({ where: { eventId } });
        if (!layout) {
          throw new AppError(404, 'VENUE_LAYOUT_NOT_FOUND', 'Venue layout not configured');
        }
        for (const z of await prisma.venueZone.findMany({
          where: { layoutId: layout.id },
          include: { tables: true },
        })) {
          const table = z.tables.find(
            (t) => t.id === input.table_id || t.externalId === input.table_id,
          );
          if (table) return { zone: z, table };
        }
        throw new AppError(404, 'VENUE_TABLE_NOT_FOUND', 'Table not found');
      })();

      if (input.zone_id && input.zone_id !== zone.id && input.zone_id !== zone.externalId) {
        throw new AppError(400, 'INVALID_ZONE', 'Table does not belong to the specified zone');
      }

      if (table.status === 'sold') {
        throw new AppError(409, 'TABLE_NOT_AVAILABLE', 'This table is no longer available');
      }

      await vipVenueService.assertUserTableLock(eventId, table.id, buyerUserId);

      subtotal = table.price;
      quantity = table.capacity;
      tier = 'vip';
      type = 'vip_table';
      venueTableId = table.id;
      venueZoneId = zone.id;
      unitPrice = table.price;
      assignedSlotLabel = `VIP ${table.label}`;
    } else if (input.items?.length) {
      let totalQty = 0;
      for (const item of input.items) {
        const offering = await vipVenueService.getOfferingById(eventId, item.offering_id);
        subtotal += offering.price * item.quantity;
        totalQty += item.quantity;
        tier = offering.mapsToTier;
        type = offering.mapsToType;
        ticketOfferingId = offering.id;
        unitPrice = offering.price;
      }
      quantity = totalQty;
    } else if (input.offering_id) {
      const offering = await vipVenueService.getOfferingById(eventId, input.offering_id);
      quantity = input.quantity ?? 1;
      subtotal = offering.price * quantity;
      tier = offering.mapsToTier;
      type = offering.mapsToType;
      ticketOfferingId = offering.id;
      unitPrice = offering.price;
    } else {
      quantity = input.quantity ?? 1;
      unitPrice = DEFAULT_UNIT_PRICES[tier] ?? DEFAULT_UNIT_PRICES.general;
      subtotal = unitPrice * quantity;
    }

    const serviceFeeAmount = Math.round(subtotal * serviceFeeRate);
    const totalAmount = subtotal + serviceFeeAmount;
    const country = await getActiveCountry(event.countryCode);
    const currencyMeta = getEventCurrencyMeta(event.countryCode);
    const currency = country.currencyCode;
    const gateway = resolvePaymentGateway(event.countryCode);
    const useAsyncPayment = !env.CHECKOUT_MOCK_PAYMENT && !input.payment_method_id;

    if (useAsyncPayment) {
      const order = await prisma.ticketOrder.create({
        data: {
          buyerUserId,
          eventId,
          quantity,
          tier,
          type,
          unitPrice,
          subtotalAmount: subtotal,
          serviceFeeRate,
          serviceFeeAmount,
          totalAmount,
          currency,
          status: 'pending_payment',
          venueTableId,
          venueZoneId,
          ticketOfferingId,
        },
      });

      const payment = await preparePayment({
        orderId: order.id,
        countryCode: event.countryCode,
        amount: totalAmount,
        currency,
        buyerUserId,
      });

      return {
        order_id: order.id,
        event_id: event.id,
        event_title: event.title,
        status: 'payment_pending',
        gateway: payment.gateway,
        payment_gateway: payment.gateway,
        country_code: event.countryCode,
        currency,
        currency_decimals: currencyMeta.currency_decimals,
        currency_symbol: currencyMeta.currency_symbol,
        subtotal_amount: subtotal,
        service_fee_rate: serviceFeeRate,
        service_fee_amount: serviceFeeAmount,
        total_amount: totalAmount,
        quantity,
        table_id: venueTableId ?? null,
        zone_id: venueZoneId ?? null,
        offering_id: ticketOfferingId ?? null,
        payment_url: payment.gateway === 'klap' ? payment.klap.payment_url : null,
        ...(payment.gateway === 'klap' ? { klap: payment.klap } : { stripe: payment.stripe }),
      };
    }

    const paymentReference = env.CHECKOUT_MOCK_PAYMENT
      ? `mock_${crypto.randomBytes(6).toString('hex')}`
      : `pay_${crypto.randomBytes(8).toString('hex')}`;

    try {
      const checkoutResult = await prisma.$transaction(async (tx) => {
        const created = await tx.ticketOrder.create({
          data: {
            buyerUserId,
            eventId,
            quantity,
            tier,
            type,
            unitPrice,
            subtotalAmount: subtotal,
            serviceFeeRate,
            serviceFeeAmount,
            totalAmount,
            currency,
            status: 'paid',
            paymentReference,
            venueTableId,
            venueZoneId,
            ticketOfferingId,
          },
        });

        await tx.ticketSlot.createMany({
          data: Array.from({ length: quantity }, (_, index) => ({
            orderId: created.id,
            slotNumber: index + 1,
            status: index === 0 ? 'owner' : 'available',
          })),
        });

        const slots = await tx.ticketSlot.findMany({
          where: { orderId: created.id },
          orderBy: { slotNumber: 'asc' },
        });

        const ticketResult = await createBuyerTicket(
          tx,
          buyer,
          event,
          created,
          slots[0]!,
          assignedSlotLabel,
        );

        if (venueTableId) {
          await tx.venueTable.update({
            where: { id: venueTableId },
            data: { status: 'sold' },
          });
          await tx.tableLock.deleteMany({ where: { tableId: venueTableId } });
        }

        if (ticketOfferingId) {
          await tx.eventTicketOffering.update({
            where: { id: ticketOfferingId },
            data: { soldQuantity: { increment: quantity } },
          });
        }

        return {
          order: created,
          ticketId: ticketResult.ticketId,
          unlockAt: ticketResult.unlockAt,
        };
      }, CHECKOUT_TX_OPTIONS);

      const { order, ticketId: buyerTicketId, unlockAt: qrUnlockAt } = checkoutResult;
      const availableCount = Math.max(0, quantity - 1);

      return {
        order_id: order.id,
        event_id: event.id,
        event_title: event.title,
        quantity: order.quantity,
        subtotal_amount: order.subtotalAmount,
        service_fee_rate: order.serviceFeeRate,
        service_fee_amount: order.serviceFeeAmount,
        total_amount: order.totalAmount,
        currency: order.currency,
        status: order.status,
        gateway,
        payment_gateway: gateway,
        currency_decimals: currencyMeta.currency_decimals,
        currency_symbol: currencyMeta.currency_symbol,
        country_code: event.countryCode,
        tier: order.tier,
        type: order.type,
        table_id: venueTableId ?? null,
        zone_id: venueZoneId ?? null,
        offering_id: ticketOfferingId ?? null,
        ticket_id: buyerTicketId,
        qr_unlock_at: qrUnlockAt?.toISOString() ?? null,
        seat_label: assignedSlotLabel ?? 'Entrada 1',
        available_to_assign: availableCount,
        payment_reference: order.paymentReference,
      };
    } catch (err) {
      console.error('[checkout] failed', err);
      if (err instanceof AppError) throw err;
      const message = err instanceof Error ? err.message : 'unknown';
      throw new AppError(
        502,
        'CHECKOUT_FAILED',
        'Could not complete checkout. Please try again.',
        { reason: message },
      );
    }
  },

  async fulfillPendingOrder(orderId: string, buyerUserId?: string) {
    const order = await prisma.ticketOrder.findUnique({
      where: { id: orderId },
      include: { event: true, buyer: true, slots: true },
    });

    if (!order) {
      throw new AppError(404, 'TICKET_ORDER_NOT_FOUND', 'Ticket order not found');
    }

    if (buyerUserId && order.buyerUserId !== buyerUserId) {
      throw new AppError(403, 'FORBIDDEN', 'You cannot confirm this order');
    }

    if (order.status === 'paid') {
      const firstSlot = order.slots[0];
      return {
        order_id: order.id,
        status: 'paid',
        gateway: resolvePaymentGateway(order.event.countryCode),
        currency: order.currency,
        total_amount: order.totalAmount,
        ticket_id: firstSlot?.invitationId ?? null,
      };
    }

    if (order.status !== 'pending_payment') {
      throw new AppError(409, 'ORDER_NOT_PAYABLE', 'This order cannot be confirmed');
    }

    let assignedSlotLabel: string | undefined;
    if (order.venueTableId) {
      const table = await prisma.venueTable.findUnique({ where: { id: order.venueTableId } });
      assignedSlotLabel = table ? `VIP ${table.label}` : undefined;
    }

    const gateway = resolvePaymentGateway(order.event.countryCode);
    const paymentReference = `pay_${crypto.randomBytes(8).toString('hex')}`;

    const checkoutResult = await prisma.$transaction(async (tx) => {
      const updated = await tx.ticketOrder.update({
        where: { id: orderId },
        data: { status: 'paid', paymentReference },
      });

      await tx.ticketSlot.createMany({
        data: Array.from({ length: order.quantity }, (_, index) => ({
          orderId: order.id,
          slotNumber: index + 1,
          status: index === 0 ? 'owner' : 'available',
        })),
      });

      const slots = await tx.ticketSlot.findMany({
        where: { orderId: order.id },
        orderBy: { slotNumber: 'asc' },
      });

      const ticketResult = await createBuyerTicket(
        tx,
        order.buyer,
        order.event,
        updated,
        slots[0]!,
        assignedSlotLabel,
      );

      if (order.venueTableId) {
        await tx.venueTable.update({
          where: { id: order.venueTableId },
          data: { status: 'sold' },
        });
        await tx.tableLock.deleteMany({ where: { tableId: order.venueTableId } });
      }

      if (order.ticketOfferingId) {
        await tx.eventTicketOffering.update({
          where: { id: order.ticketOfferingId },
          data: { soldQuantity: { increment: order.quantity } },
        });
      }

      return {
        order: updated,
        ticketId: ticketResult.ticketId,
        unlockAt: ticketResult.unlockAt,
      };
    }, CHECKOUT_TX_OPTIONS);

    const availableCount = Math.max(0, order.quantity - 1);

    return {
      order_id: order.id,
      event_id: order.eventId,
      event_title: order.event.title,
      quantity: order.quantity,
      subtotal_amount: order.subtotalAmount,
      service_fee_rate: order.serviceFeeRate,
      service_fee_amount: order.serviceFeeAmount,
      total_amount: order.totalAmount,
      currency: order.currency,
      status: 'paid',
      gateway,
      tier: order.tier,
      type: order.type,
      table_id: order.venueTableId ?? null,
      zone_id: order.venueZoneId ?? null,
      offering_id: order.ticketOfferingId ?? null,
      ticket_id: checkoutResult.ticketId,
      qr_unlock_at: checkoutResult.unlockAt?.toISOString() ?? null,
      seat_label: assignedSlotLabel ?? 'Entrada 1',
      available_to_assign: availableCount,
      payment_reference: paymentReference,
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
    const claimToken = crypto.randomBytes(16).toString('hex');
    const sentAt = new Date();
    const expiresAt = await invitationConfigService.computeExpiresAt(sentAt);

    const invitation = await prisma.$transaction(async (tx) => {
      const producerId = await getSystemProducerId(tx);
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
          type: 'free',
          tier: order.tier,
          status: 'sent',
          assignedSlot: `Entrada ${slot.slotNumber}`,
          entryValue: order.unitPrice ?? 0,
          amountToPay: 0,
          cancellationDeadline: defaultCancellationDeadline(order.event.startsAt),
          sentAt,
          expiresAt,
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

    let deliveryResult;
    try {
      deliveryResult = await invitationDeliveryService.sendGuestInvitation({
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
      ...invitationDeliveryMeta(deliveryResult),
      message: deliveryResult.delivery_mode === 'mock'
        ? 'Invitation saved (WhatsApp mock mode — set TWILIO_MOCK=false on server for live delivery).'
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

    if (slot.invitation?.status === 'accepted') {
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

    if (!invitation || !['sent', 'viewed'].includes(invitation.status) || !invitation.claimToken) {
      throw new AppError(409, 'TICKET_SLOT_NOT_RESENDABLE', 'Invitation is no longer pending');
    }

    const claimUrl = buildClaimUrl(invitation.claimToken);
    const inviterName = invitation.inviter?.fullName ?? 'Un amigo';
    const guestPhone = slot.guestPhone ?? invitation.recipientPhone;

    if (!guestPhone) {
      throw new AppError(422, 'GUEST_PHONE_MISSING', 'Guest phone number is missing for this ticket slot.');
    }

    let deliveryResult;
    try {
      deliveryResult = await invitationDeliveryService.sendGuestInvitation({
        guestPhone,
        guestName: slot.guestName ?? invitation.recipientName ?? 'Invitado',
        inviterName,
        eventTitle: order.event.title,
        claimUrl,
      });

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { whatsappSentAt: new Date() },
      });
    } catch (err) {
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
        guestPhone,
        invitation: {
          ...invitation,
          whatsappSentAt: new Date(),
          ticket: null,
        },
      }),
      claim_url: claimUrl,
      ...invitationDeliveryMeta(deliveryResult),
      message: deliveryResult.delivery_mode === 'mock'
        ? 'Invitation saved (WhatsApp mock mode — set TWILIO_MOCK=false on server for live delivery).'
        : deliveryResult.delivery_via === 'sandbox'
          ? 'Invitation resent via WhatsApp (sandbox). Guest must join Twilio sandbox if they have not already.'
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
