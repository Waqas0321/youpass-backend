/**
 * Wipe commerce data for Invite Test Guest so payment testing starts clean.
 * Keeps the user account, profile, and login sessions.
 *
 * Run: npx tsx scripts/reset-invite-test-guest.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { normalizeStatusAfterStockChange } from '../src/modules/ticket-offerings/ticket-offering.types.js';

const PHONE = '+56988777123';

async function restoreOfferingStock(offeringId: string, quantity: number) {
  const offering = await prisma.eventTicketOffering.findUnique({
    where: { id: offeringId },
  });
  if (!offering || offering.stockRemaining == null) {
    return;
  }

  const nextRemaining =
    offering.stockTotal == null
      ? offering.stockRemaining + quantity
      : Math.min(offering.stockTotal, offering.stockRemaining + quantity);

  await prisma.eventTicketOffering.update({
    where: { id: offeringId },
    data: {
      stockRemaining: nextRemaining,
      status: normalizeStatusAfterStockChange(offering.status, nextRemaining),
    },
  });
}

async function restoreDrinkStock(orderIds: string[]) {
  if (orderIds.length === 0) return;

  const lines = await prisma.eventDrinkOrderLine.findMany({
    where: { orderId: { in: orderIds }, productId: { not: null } },
    select: { productId: true, quantity: true },
  });

  const qtyByProduct = new Map<string, number>();
  for (const line of lines) {
    if (!line.productId) continue;
    qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.quantity);
  }

  for (const [productId, quantity] of qtyByProduct) {
    const product = await prisma.eventDrinkProduct.findUnique({ where: { id: productId } });
    if (!product || product.stockRemaining == null) continue;

    const nextRemaining =
      product.stockTotal == null
        ? product.stockRemaining + quantity
        : Math.min(product.stockTotal, product.stockRemaining + quantity);

    await prisma.eventDrinkProduct.update({
      where: { id: productId },
      data: {
        stockRemaining: nextRemaining,
        status:
          nextRemaining > 0 && product.status === 'sold_out' ? 'available' : product.status,
      },
    });
  }
}

async function main() {
  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) {
    throw new Error(`User ${PHONE} not found.`);
  }

  const orders = await prisma.ticketOrder.findMany({
    where: { buyerUserId: user.id },
    include: { slots: { select: { id: true, invitationId: true } } },
  });
  const orderIds = orders.map((order) => order.id);
  const slotInvitationIds = orders.flatMap((order) =>
    order.slots.map((slot) => slot.invitationId).filter((id): id is string => id != null),
  );

  const invitations = await prisma.invitation.findMany({
    where: {
      OR: [
        { recipientUserId: user.id },
        { inviterUserId: user.id },
        { recipientPhone: PHONE },
        { id: { in: slotInvitationIds } },
      ],
    },
    select: { id: true },
  });
  const invitationIds = [...new Set(invitations.map((row) => row.id))];

  const drinkOrders = await prisma.eventDrinkOrder.findMany({
    where: { userId: user.id },
    select: { id: true, status: true },
  });
  const drinkOrderIds = drinkOrders.map((row) => row.id);

  const waitlistEntries = await prisma.waitlistEntry.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const waitlistEntryIds = waitlistEntries.map((row) => row.id);

  const cards = await prisma.userPaymentMethod.findMany({
    where: { userId: user.id },
    select: { id: true, brand: true, lastFour: true, providerToken: true },
  });

  console.log(`Resetting Invite Test Guest ${user.fullName} (${user.phone})`);
  console.log(
    JSON.stringify(
      {
        ticketOrders: orders.length,
        invitations: invitationIds.length,
        cards: cards.map((card) => `${card.brand} ••••${card.lastFour}`),
        drinkOrders: drinkOrderIds.length,
        waitlistEntries: waitlistEntryIds.length,
      },
      null,
      2,
    ),
  );

  for (const order of orders) {
    if (!order.ticketOfferingId) continue;
    if (order.status !== 'paid' && order.status !== 'pending_payment') continue;
    await restoreOfferingStock(order.ticketOfferingId, order.quantity);
  }

  await restoreDrinkStock(
    drinkOrders
      .filter((order) => order.status === 'confirmed' || order.status === 'redeemed')
      .map((order) => order.id),
  );

  await prisma.invitationPreAuth.deleteMany({
    where: {
      OR: [{ userId: user.id }, { invitationId: { in: invitationIds } }],
    },
  });
  if (invitationIds.length > 0) {
    await prisma.invitationReminder.deleteMany({ where: { invitationId: { in: invitationIds } } });
    await prisma.invitationTicket.deleteMany({ where: { invitationId: { in: invitationIds } } });
    await prisma.invitationAuditLog.deleteMany({
      where: { invitationId: { in: invitationIds } },
    });
    await prisma.freedInvitationSlot.deleteMany({
      where: { invitationId: { in: invitationIds } },
    });
    await prisma.waitlistOffer.deleteMany({
      where: { invitationId: { in: invitationIds } },
    });
  }

  await prisma.waitlistOffer.deleteMany({ where: { userId: user.id } });
  if (waitlistEntryIds.length > 0) {
    await prisma.waitlistOffer.deleteMany({
      where: { waitlistEntryId: { in: waitlistEntryIds } },
    });
    await prisma.waitlistEntry.deleteMany({ where: { id: { in: waitlistEntryIds } } });
  }

  if (drinkOrderIds.length > 0) {
    await prisma.eventDrinkRedemption.deleteMany({ where: { orderId: { in: drinkOrderIds } } });
    await prisma.eventDrinkOrderLine.deleteMany({ where: { orderId: { in: drinkOrderIds } } });
    await prisma.eventDrinkOrder.deleteMany({ where: { id: { in: drinkOrderIds } } });
  }

  await prisma.tableLock.deleteMany({ where: { userId: user.id } });
  await prisma.venueTable.updateMany({
    where: { OR: [{ lockedByUserId: user.id }, { soldToUserId: user.id }] },
    data: {
      status: 'available',
      lockedByUserId: null,
      lockedUntil: null,
      soldToUserId: null,
      soldAt: null,
    },
  });

  if (orderIds.length > 0) {
    await prisma.ticketSlot.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.ticketOrder.deleteMany({ where: { id: { in: orderIds } } });
  }

  if (invitationIds.length > 0) {
    await prisma.invitation.deleteMany({ where: { id: { in: invitationIds } } });
  }

  await prisma.userPaymentMethod.deleteMany({ where: { userId: user.id } });
  await prisma.eventFavorite.deleteMany({ where: { userId: user.id } });
  await prisma.producerFollow.deleteMany({ where: { userId: user.id } });
  await prisma.analyticsEvent.deleteMany({ where: { userId: user.id } });

  const remaining = {
    ticketOrders: await prisma.ticketOrder.count({ where: { buyerUserId: user.id } }),
    cards: await prisma.userPaymentMethod.count({ where: { userId: user.id } }),
    invitations: await prisma.invitation.count({
      where: {
        OR: [{ recipientUserId: user.id }, { inviterUserId: user.id }, { recipientPhone: PHONE }],
      },
    }),
    drinkOrders: await prisma.eventDrinkOrder.count({ where: { userId: user.id } }),
  };

  console.log('Done. Remaining related rows:', remaining);
  console.log(`Account kept: ${user.fullName} ${user.phone}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
