import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';

export const eventDrinkRedemptionService = {
  async validateQrPayload(qrPayload: string) {
    const redemption = await prisma.eventDrinkRedemption.findUnique({
      where: { qrPayload },
      include: {
        line: true,
        order: {
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startsAt: true,
              },
            },
            lines: {
              include: {
                redemption: true,
              },
            },
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!redemption) {
      throw new AppError(404, 'DRINK_QR_NOT_FOUND', 'Drink order QR not found');
    }

    if (redemption.validatedAt) {
      throw new AppError(409, 'DRINK_QR_ALREADY_REDEEMED', 'This drink order was already redeemed');
    }

    if (
      redemption.order.status === 'refunded' ||
      redemption.order.status === 'cancelled' ||
      redemption.order.status === 'expired'
    ) {
      throw new AppError(409, 'DRINK_ORDER_NOT_REDEEMABLE', 'This drink order cannot be redeemed');
    }

    const redeemedLine =
      redemption.line ??
      redemption.order.lines.find((line) => line.id === redemption.lineId) ??
      redemption.order.lines[0];

    if (!redeemedLine) {
      throw new AppError(500, 'DRINK_ORDER_LINE_MISSING', 'Drink order line not found');
    }

    const now = new Date();
    await prisma.eventDrinkRedemption.update({
      where: { id: redemption.id },
      data: { validatedAt: now },
    });

    const allRedeemed = redemption.order.lines.every((line) => {
      if (line.id === redemption.lineId) {
        return true;
      }
      return line.redemption?.validatedAt != null;
    });

    if (allRedeemed) {
      await prisma.eventDrinkOrder.update({
        where: { id: redemption.orderId },
        data: { status: 'redeemed' },
      });
    }

    return {
      order_id: redemption.order.id,
      event_id: redemption.order.eventId,
      event_title: redemption.order.event.title,
      guest_name: redemption.order.user.fullName,
      entry_code: redemption.manualEntryId,
      redeemed_at: now.toISOString(),
      line_items: [
        {
          product_name: redeemedLine.productName,
          quantity: redeemedLine.quantity,
          volume_ml: redeemedLine.volumeMl,
        },
      ],
    };
  },
};
