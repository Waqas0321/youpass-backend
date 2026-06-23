import crypto from 'node:crypto';
import type { Prisma, TicketSlot, TicketOrder, Event, User, Invitation } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { parseAndValidatePhone, formatPhoneDisplay } from '../../common/utils/phone.js';
import {
  buildClaimUrl,
  buildGuestAssignWhatsAppUrl,
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
import { DEFAULT_SERVICE_FEE_RATE } from '../vip-venue/vip-venue.constants.js';
import { getActiveCountry } from '../../common/services/country-config.service.js';
import { defaultCancellationDeadline } from '../tickets/tickets.utils.js';
import {
  preparePayment,
  resolvePaymentGateway,
} from '../payments/payment-gateway.service.js';
import {
  mapsToCatalogType,
  mapsToTier,
  isQuantityAvailable,
  normalizeStatusAfterStockChange,
} from '../ticket-offerings/ticket-offering.types.js';
import { isEventPurchasable } from '../events/events.utils.js';
import {
  deleteInvitationRecord,
  releaseInvitationPreAuthHold,
} from '../invitations/invitation-lifecycle.service.js';
import { buildVenueTableRefFilter } from '../../common/utils/mongo-id.js';

type SlotInvitationMeta = Pick<Invitation, 'id' | 'status' | 'whatsappSentAt'>;

type SlotWithInvitation = TicketSlot & {
  invitation: SlotInvitationMeta | null;
};

const DEFAULT_UNIT_PRICES: Record<string, number> = {
  general: 25000,
  vip: 48000,
};

/** MongoDB transactions on serverless need extra time for multi-slot VIP table orders. */
const CHECKOUT_TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 } as const;

async function assertAndDecrementOfferingStock(
  tx: Prisma.TransactionClient,
  offeringId: string,
  quantity: number,
) {
  const offering = await tx.eventTicketOffering.findUnique({ where: { id: offeringId } });
  if (!offering) {
    throw new AppError(404, 'TICKET_OFFERING_NOT_FOUND', 'Ticket offering not found');
  }

  if (offering.stockRemaining == null) {
    return;
  }

  if (!isQuantityAvailable(offering, quantity)) {
    throw new AppError(
      409,
      'INSUFFICIENT_STOCK',
      'Not enough tickets available for this offering',
    );
  }

  const nextRemaining = Math.max(0, offering.stockRemaining - quantity);
  await tx.eventTicketOffering.update({
    where: { id: offeringId },
    data: {
      stockRemaining: nextRemaining,
      status: normalizeStatusAfterStockChange(offering.status, nextRemaining),
    },
  });
}

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
  const byId = new Map<string, SlotInvitationMeta>();

  if (invitationIds.length > 0) {
    const invitations = await prisma.invitation.findMany({
      where: { id: { in: invitationIds } },
      select: { id: true, status: true, whatsappSentAt: true },
    });

    for (const invitation of invitations) {
      byId.set(invitation.id, {
        id: invitation.id,
        status: invitation.status,
        whatsappSentAt: invitation.whatsappSentAt,
      });
    }
  }

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

  const ownerSlot = await prisma.ticketSlot.findFirst({
    where: {
      invitationId: refId,
      status: 'owner',
      order: { buyerUserId, status: 'paid' },
    },
    select: { orderId: true },
  });
  if (ownerSlot) return ownerSlot.orderId;

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

function formatSlotStatus(slot: SlotWithInvitation): string {
  if (slot.status === 'owner') return 'owner';
  if (slot.status === 'claimed') return 'claimed';
  if (slot.status === 'assigned') {
    if (slot.invitation?.status === 'sent' || slot.invitation?.status === 'viewed') return 'pending';
    if (slot.invitation?.status === 'accepted') return 'claimed';
    if (slot.invitation?.status === 'rejected') return 'available';
    // Assigned in DB but invitation missing or already closed — do not expose as sendable.
    return 'pending';
  }
  return 'available';
}

function formatGuestLookupUser(user: {
  id: string;
  fullName: string;
  phone: string;
  countryCode: string;
  profilePhotoUrl: string | null;
}) {
  return {
    user_id: user.id,
    full_name: user.fullName,
    phone: user.phone,
    phone_display: formatPhoneDisplay(user.phone, user.countryCode),
    country_code: user.countryCode,
    profile_photo_url: user.profilePhotoUrl,
    is_registered: true,
  };
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
    can_cancel: uiStatus === 'pending' || uiStatus === 'claimed',
    can_resend: uiStatus === 'pending',
  };
}

async function buyerOwnsEventTicket(
  tx: DbClient,
  buyerUserId: string,
  eventId: string,
  excludeOrderId?: string,
): Promise<boolean> {
  const existing = await tx.ticketSlot.findFirst({
    where: {
      status: 'owner',
      order: {
        buyerUserId,
        eventId,
        status: 'paid',
        ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
      },
    },
    select: { id: true },
  });

  // Buyer gets at most one auto-assigned owner ticket per event (first purchase only).
  // Repeat purchases — even after the ticket was scanned — are all assignable to guests.
  return existing != null;
}

async function getExistingBuyerTicket(
  tx: DbClient,
  buyerUserId: string,
  eventId: string,
): Promise<{ ticketId: string; unlockAt: Date | null } | null> {
  const ownerSlot = await tx.ticketSlot.findFirst({
    where: {
      status: 'owner',
      invitationId: { not: null },
      order: { buyerUserId, eventId, status: 'paid' },
    },
    select: { invitationId: true },
    orderBy: { order: { createdAt: 'asc' } },
  });

  if (!ownerSlot?.invitationId) {
    return null;
  }

  const ticket = await tx.invitationTicket.findFirst({
    where: { invitationId: ownerSlot.invitationId },
    select: { unlockAt: true },
  });

  return {
    ticketId: ownerSlot.invitationId,
    unlockAt: ticket?.unlockAt ?? null,
  };
}

function countAssignableSlots(slots: TicketSlot[]) {
  let available = 0;
  let pending = 0;
  let claimed = 0;

  for (const slot of slots) {
    if (slot.status === 'owner') {
      continue;
    }
    if (slot.status === 'available') {
      available += 1;
    } else if (slot.status === 'assigned') {
      pending += 1;
    } else if (slot.status === 'claimed') {
      claimed += 1;
    }
  }

  return { available, pending, claimed };
}

async function mergeEventAssignmentSlots(
  orders: Array<TicketOrder & { slots: TicketSlot[] }>,
): Promise<SlotWithInvitation[]> {
  const sortedOrders = [...orders].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const merged: TicketSlot[] = [];
  let ownerIncluded = false;

  for (const order of sortedOrders) {
    for (const slot of order.slots) {
      if (slot.status === 'owner') {
        if (!ownerIncluded) {
          merged.push(slot);
          ownerIncluded = true;
        }
        continue;
      }
      merged.push(slot);
    }
  }

  return attachInvitations(merged);
}

async function getBuyerSlotWithOrder(buyerUserId: string, slotId: string) {
  const raw = await prisma.ticketSlot.findFirst({
    where: {
      id: slotId,
      order: { buyerUserId, status: 'paid' },
    },
    include: { order: { include: { event: true } } },
  });

  if (!raw) {
    throw new AppError(404, 'TICKET_SLOT_NOT_FOUND', 'Ticket slot not found');
  }

  const [slot] = await attachInvitations([raw]);
  return { slot: slot!, order: raw.order };
}

async function getEventAssignmentsForBuyer(buyerUserId: string, refId: string) {
  const orderId = await resolveOrderIdForBuyer(buyerUserId, refId);
  const anchorOrder = await prisma.ticketOrder.findFirst({
    where: { id: orderId, buyerUserId, status: 'paid' },
    include: { event: true },
  });

  if (!anchorOrder) {
    throw new AppError(404, 'TICKET_ORDER_NOT_FOUND', 'Ticket order not found');
  }

  const orders = await prisma.ticketOrder.findMany({
    where: { buyerUserId, eventId: anchorOrder.eventId, status: 'paid' },
    include: { slots: { orderBy: { slotNumber: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });

  const slots = await mergeEventAssignmentSlots(orders);
  const slotCounts = countAssignableSlots(slots);
  const primaryOrder =
    orders.find((order) => order.slots.some((slot) => slot.status === 'owner')) ?? anchorOrder;

  return {
    event: anchorOrder.event,
    primaryOrder,
    orders,
    slots,
    ...slotCounts,
    totalQuantity: orders.reduce((sum, order) => sum + order.quantity, 0),
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
    const [event, buyer, paymentMethod] = await Promise.all([
      prisma.event.findUnique({ where: { id: eventId } }),
      prisma.user.findUniqueOrThrow({ where: { id: buyerUserId } }),
      input.payment_method_id
        ? prisma.userPaymentMethod.findFirst({
            where: { userId: buyerUserId, providerToken: input.payment_method_id },
          })
        : Promise.resolve(null),
    ]);

    if (!event || event.status !== 'published') {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    if (!isEventPurchasable(event)) {
      throw new AppError(409, 'EVENT_NOT_PURCHASABLE', 'This event has already started and tickets are no longer available');
    }

    if (input.payment_method_id && !paymentMethod) {
      throw new AppError(404, 'PAYMENT_METHOD_NOT_FOUND', 'Payment method not found');
    }
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
      const tableRecord = await prisma.venueTable.findFirst({
        where: {
          eventId,
          ...buildVenueTableRefFilter(input.table_id),
        },
        include: { zone: true },
      });

      if (!tableRecord) {
        throw new AppError(404, 'VENUE_TABLE_NOT_FOUND', 'Table not found');
      }

      const { zone, ...table } = tableRecord;

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
        if (!isQuantityAvailable(offering, item.quantity)) {
          throw new AppError(
            409,
            'INSUFFICIENT_STOCK',
            'Not enough tickets available for this offering',
          );
        }
        subtotal += offering.price * item.quantity;
        totalQty += item.quantity;
        tier = mapsToTier(offering.type);
        type = mapsToCatalogType(offering.type);
        ticketOfferingId = offering.id;
        unitPrice = offering.price;
      }
      quantity = totalQty;
    } else if (input.offering_id) {
      const offering = await vipVenueService.getOfferingById(eventId, input.offering_id);
      quantity = input.quantity ?? 1;
      if (!isQuantityAvailable(offering, quantity)) {
        throw new AppError(
          409,
          'INSUFFICIENT_STOCK',
          'Not enough tickets available for this offering',
        );
      }
      subtotal = offering.price * quantity;
      tier = mapsToTier(offering.type);
      type = mapsToCatalogType(offering.type);
      ticketOfferingId = offering.id;
      unitPrice = offering.price;
    } else {
      const catalogOfferings = await prisma.eventTicketOffering.count({ where: { eventId } });
      if (catalogOfferings > 0) {
        throw new AppError(
          400,
          'OFFERING_REQUIRED',
          'Select a ticket type to purchase',
        );
      }

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
    const useAsyncPayment =
      totalAmount > 0 && !env.CHECKOUT_MOCK_PAYMENT && !input.payment_method_id;

    const resolvedPaymentMethod =
      paymentMethod ??
      (totalAmount === 0
        ? await prisma.userPaymentMethod.findFirst({
            where: { userId: buyerUserId, isDefault: true },
            orderBy: { createdAt: 'desc' },
          })
        : null);

    if (totalAmount === 0 && !resolvedPaymentMethod) {
      throw new AppError(
        422,
        'PAYMENT_METHOD_REQUIRED',
        'Add a payment method to complete your free ticket registration',
      );
    }

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

        const buyerAlreadyOwns = await buyerOwnsEventTicket(
          tx,
          buyerUserId,
          eventId,
          created.id,
        );

        await tx.ticketSlot.createMany({
          data: Array.from({ length: quantity }, (_, index) => ({
            orderId: created.id,
            slotNumber: index + 1,
            status:
              buyerAlreadyOwns || index > 0
                ? 'available'
                : 'owner',
          })),
        });

        let ticketId: string | null = null;
        let unlockAt: Date | null = null;

        if (!buyerAlreadyOwns) {
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
          ticketId = ticketResult.ticketId;
          unlockAt = ticketResult.unlockAt;
        } else {
          const existingTicket = await getExistingBuyerTicket(tx, buyerUserId, eventId);
          ticketId = existingTicket?.ticketId ?? null;
          unlockAt = existingTicket?.unlockAt ?? null;
        }

        if (venueTableId) {
          const soldAt = new Date();
          await tx.venueTable.update({
            where: { id: venueTableId },
            data: {
              status: 'sold',
              soldAt,
              soldToUserId: buyerUserId,
              lockedByUserId: null,
              lockedUntil: null,
            },
          });
          await tx.tableLock.updateMany({
            where: { tableId: venueTableId, status: 'ACTIVE' },
            data: { status: 'CONSUMED' },
          });
        }

        if (ticketOfferingId) {
          await assertAndDecrementOfferingStock(tx, ticketOfferingId, quantity);
        }

        return {
          order: created,
          ticketId,
          unlockAt,
          buyerAlreadyOwns,
        };
      }, CHECKOUT_TX_OPTIONS);

      const {
        order,
        ticketId: buyerTicketId,
        unlockAt: qrUnlockAt,
        buyerAlreadyOwns,
      } = checkoutResult;
      const availableCount = buyerAlreadyOwns ? quantity : Math.max(0, quantity - 1);

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

      const buyerAlreadyOwns = await buyerOwnsEventTicket(
        tx,
        order.buyerUserId,
        order.eventId,
        order.id,
      );

      await tx.ticketSlot.createMany({
        data: Array.from({ length: order.quantity }, (_, index) => ({
          orderId: order.id,
          slotNumber: index + 1,
          status:
            buyerAlreadyOwns || index > 0
              ? 'available'
              : 'owner',
        })),
      });

      let ticketId: string | null = null;
      let unlockAt: Date | null = null;

      if (!buyerAlreadyOwns) {
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
        ticketId = ticketResult.ticketId;
        unlockAt = ticketResult.unlockAt;
      } else {
        const existingTicket = await getExistingBuyerTicket(
          tx,
          order.buyerUserId,
          order.eventId,
        );
        ticketId = existingTicket?.ticketId ?? null;
        unlockAt = existingTicket?.unlockAt ?? null;
      }

      if (order.venueTableId) {
        const soldAt = new Date();
        await tx.venueTable.update({
          where: { id: order.venueTableId },
          data: {
            status: 'sold',
            soldAt,
            soldToUserId: order.buyerUserId,
            lockedByUserId: null,
            lockedUntil: null,
          },
        });
        await tx.tableLock.updateMany({
          where: { tableId: order.venueTableId, status: 'ACTIVE' },
          data: { status: 'CONSUMED' },
        });
      }

      if (order.ticketOfferingId) {
        await assertAndDecrementOfferingStock(tx, order.ticketOfferingId, order.quantity);
      }

      return {
        order: updated,
        ticketId,
        unlockAt,
        buyerAlreadyOwns,
      };
    }, CHECKOUT_TX_OPTIONS);

    const availableCount = checkoutResult.buyerAlreadyOwns
      ? order.quantity
      : Math.max(0, order.quantity - 1);

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

  async lookupAssignGuests(buyerUserId: string, query: string) {
    const buyer = await prisma.user.findUniqueOrThrow({ where: { id: buyerUserId } });
    const normalized = query.trim();
    const digits = normalized.replace(/\D/g, '');
    const guestSelect = {
      id: true,
      fullName: true,
      phone: true,
      countryCode: true,
      profilePhotoUrl: true,
    } as const;

    if (digits.length >= 6) {
      try {
        const { e164 } = await parseAndValidatePhone(normalized, buyer.countryCode);
        const exactMatch = await prisma.user.findFirst({
          where: {
            phone: e164,
            accountStatus: 'active',
            id: { not: buyerUserId },
          },
          select: guestSelect,
        });
        if (exactMatch) {
          return { results: [formatGuestLookupUser(exactMatch)] };
        }
      } catch {
        // Fall through to partial phone search while the user is still typing.
      }

      const phoneMatches = await prisma.user.findMany({
        where: {
          phone: { contains: digits },
          accountStatus: 'active',
          id: { not: buyerUserId },
        },
        take: 10,
        orderBy: { fullName: 'asc' },
        select: guestSelect,
      });

      return { results: phoneMatches.map(formatGuestLookupUser) };
    }

    const nameMatches = await prisma.user.findMany({
      where: {
        fullName: { contains: normalized, mode: 'insensitive' },
        accountStatus: 'active',
        id: { not: buyerUserId },
      },
      take: 10,
      orderBy: { fullName: 'asc' },
      select: guestSelect,
    });

    return { results: nameMatches.map(formatGuestLookupUser) };
  },

  async listAssignments(buyerUserId: string, orderRef: string) {
    const context = await getEventAssignmentsForBuyer(buyerUserId, orderRef);
    const slots = context.slots.map(formatAssignmentSlot);

    return {
      order_id: context.primaryOrder.id,
      event_id: context.event.id,
      event_title: context.event.title,
      tier: context.primaryOrder.tier,
      quantity: context.totalQuantity,
      available_count: slots.filter((slot) => slot.status === 'available').length,
      pending_count: slots.filter((slot) => slot.status === 'pending').length,
      claimed_count: slots.filter((slot) => slot.status === 'claimed').length,
      can_assign_in_parts: true,
      slots,
    };
  },

  async assignSlot(
    buyerUserId: string,
    _orderId: string,
    slotId: string,
    input: AssignTicketSlotInput,
  ) {
    const { slot, order } = await getBuyerSlotWithOrder(buyerUserId, slotId);

    if (slot.status === 'owner') {
      throw new AppError(409, 'TICKET_SLOT_NOT_ASSIGNABLE', 'This ticket belongs to the buyer');
    }

    if (slot.status !== 'available') {
      throw new AppError(409, 'TICKET_SLOT_NOT_AVAILABLE', 'This ticket slot is not available');
    }

    const buyer = await prisma.user.findUniqueOrThrow({ where: { id: buyerUserId } });
    const { e164, countryCode } = await parseAndValidatePhone(
      input.guest_phone,
      input.country_code?.toUpperCase() ?? buyer.countryCode,
    );

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
    const whatsappParams = {
      guestPhone: e164,
      guestName: input.guest_name.trim(),
      inviterName: buyer.fullName,
      eventTitle: order.event.title,
      claimUrl,
    };
    const whatsappUrl = buildGuestAssignWhatsAppUrl(whatsappParams);

    return {
      slot: formatAssignmentSlot({
        ...slot,
        status: 'assigned',
        guestName: input.guest_name.trim(),
        guestPhone: e164,
        guestCountryCode: countryCode,
        invitationId: invitation.id,
        invitation: {
          id: invitation.id,
          status: invitation.status,
          whatsappSentAt: null,
        },
      }),
      claim_url: claimUrl,
      whatsapp_url: whatsappUrl,
      delivery_mode: 'deep_link',
      whatsapp_sent: false,
      message: 'Open WhatsApp and tap Send to deliver the invitation to your guest.',
    };
  },

  async cancelAssignment(buyerUserId: string, _orderId: string, slotId: string) {
    const { slot } = await getBuyerSlotWithOrder(buyerUserId, slotId);

    if (slot.status === 'owner' || !slot.invitationId) {
      throw new AppError(409, 'TICKET_SLOT_NOT_CANCELLABLE', 'This ticket cannot be cancelled');
    }

    const invitationStatus = slot.invitation?.status;
    const isPending =
      slot.status === 'assigned' &&
      invitationStatus != null &&
      ['sent', 'viewed'].includes(invitationStatus);
    const isClaimed =
      slot.status === 'claimed' ||
      invitationStatus === 'accepted' ||
      invitationStatus === 'validated';

    if (!isPending && !isClaimed) {
      throw new AppError(409, 'TICKET_SLOT_NOT_CANCELLABLE', 'This ticket cannot be cancelled');
    }

    if (isClaimed) {
      const invitation = await prisma.invitation.findUnique({
        where: { id: slot.invitationId },
        select: {
          id: true,
          source: true,
          eventId: true,
          producerId: true,
          assignedSlot: true,
        },
      });

      if (!invitation || invitation.source !== 'guest') {
        throw new AppError(409, 'TICKET_SLOT_NOT_CANCELLABLE', 'This ticket cannot be cancelled');
      }

      await releaseInvitationPreAuthHold(slot.invitationId);

      await prisma.$transaction(async (tx) => {
        await deleteInvitationRecord(tx, invitation);
      });
    } else {
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
    }

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

  async resendAssignment(buyerUserId: string, _orderId: string, slotId: string) {
    const { slot, order } = await getBuyerSlotWithOrder(buyerUserId, slotId);

    if (!slot.invitationId || slot.status !== 'assigned') {
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

    const whatsappUrl = buildGuestAssignWhatsAppUrl({
      guestPhone,
      guestName: slot.guestName ?? invitation.recipientName ?? 'Invitado',
      inviterName,
      eventTitle: order.event.title,
      claimUrl,
    });

    return {
      slot: formatAssignmentSlot({
        ...slot,
        guestPhone,
        invitation: {
          id: invitation.id,
          status: invitation.status,
          whatsappSentAt: invitation.whatsappSentAt,
        },
      }),
      claim_url: claimUrl,
      whatsapp_url: whatsappUrl,
      delivery_mode: 'deep_link',
      whatsapp_sent: false,
      message: 'Open WhatsApp and tap Send to resend the invitation to your guest.',
    };
  },

  async getAssignabilityByEvent(
    buyerUserId: string,
  ): Promise<Map<string, { orderId: string; available: number; pending: number; claimed: number }>> {
    const orders = await prisma.ticketOrder.findMany({
      where: { buyerUserId, status: 'paid' },
      include: { slots: true },
    });

    const map = new Map<string, { orderId: string; available: number; pending: number; claimed: number }>();
    for (const order of orders) {
      if (order.quantity <= 1) {
        continue;
      }
      const available = order.slots.filter((s) => s.status === 'available').length;
      const pending = order.slots.filter((s) => s.status === 'assigned').length;
      const claimed = order.slots.filter((s) => s.status === 'claimed').length;
      if (available > 0 || pending > 0 || claimed > 0) {
        map.set(order.eventId, { orderId: order.id, available, pending, claimed });
      }
    }
    return map;
  },

  async getAssignabilityByInvitationIds(
    buyerUserId: string,
    invitationIds: string[],
  ): Promise<Map<string, { orderId: string; available: number; pending: number; claimed: number; quantity: number }>> {
    if (invitationIds.length === 0) {
      return new Map();
    }

    const ownerSlots = await prisma.ticketSlot.findMany({
      where: {
        invitationId: { in: invitationIds },
        status: 'owner',
        order: { buyerUserId, status: 'paid' },
      },
      include: {
        order: true,
      },
    });

    const eventIds = [...new Set(ownerSlots.map((slot) => slot.order.eventId))];
    if (eventIds.length === 0) {
      return new Map();
    }

    const orders = await prisma.ticketOrder.findMany({
      where: {
        buyerUserId,
        eventId: { in: eventIds },
        status: 'paid',
      },
      include: { slots: true },
      orderBy: { createdAt: 'asc' },
    });

    const ordersByEvent = new Map<string, typeof orders>();
    for (const order of orders) {
      const current = ordersByEvent.get(order.eventId) ?? [];
      current.push(order);
      ordersByEvent.set(order.eventId, current);
    }

    const map = new Map<string, { orderId: string; available: number; pending: number; claimed: number; quantity: number }>();
    for (const slot of ownerSlots) {
      if (!slot.invitationId) {
        continue;
      }

      const eventOrders = ordersByEvent.get(slot.order.eventId) ?? [];
      const counts = countAssignableSlots(eventOrders.flatMap((order) => order.slots));
      if (counts.available === 0 && counts.pending === 0 && counts.claimed === 0) {
        continue;
      }

      const primaryOrder =
        eventOrders.find((order) => order.slots.some((entry) => entry.status === 'owner')) ??
        slot.order;

      map.set(slot.invitationId, {
        orderId: primaryOrder.id,
        available: counts.available,
        pending: counts.pending,
        claimed: counts.claimed,
        quantity: eventOrders.reduce((sum, order) => sum + order.quantity, 0),
      });
    }

    return map;
  },
};
