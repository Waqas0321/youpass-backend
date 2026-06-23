import crypto from 'node:crypto';
import type { EventDrinkProductStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { assertUserHasTicketForEvent } from './event-drink-access.js';
import { formatDrinkOrder } from './event-drink-orders.formatter.js';
import type { CreateDrinkOrderInput } from './event-drink-orders.validators.js';
import { generateEntryCode, generateQrPayload } from '../invitations/invitations.utils.js';

export const DRINK_ORDER_SERVICE_FEE_CLP = 1000;

function isProductAvailable(
  status: EventDrinkProductStatus,
  stockRemaining: number | null,
): boolean {
  if (status === 'hidden' || status === 'sold_out') {
    return false;
  }
  if (stockRemaining != null && stockRemaining <= 0) {
    return false;
  }
  return true;
}

async function generateUniqueEntryCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateEntryCode();
    const existing = await prisma.eventDrinkRedemption.findUnique({
      where: { manualEntryId: code },
      select: { id: true },
    });
    if (!existing) {
      return code;
    }
  }
  throw new AppError(500, 'DRINK_ORDER_CODE_FAILED', 'Could not generate entry code');
}

async function generateUniqueQrPayload(
  redemptionId: string,
  eventId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const payload = generateQrPayload(redemptionId, eventId);
    const existing = await prisma.eventDrinkRedemption.findUnique({
      where: { qrPayload: payload },
      select: { id: true },
    });
    if (!existing) {
      return payload;
    }
  }
  throw new AppError(500, 'DRINK_ORDER_QR_FAILED', 'Could not generate QR payload');
}

function loadOrderInclude() {
  return {
    event: {
      select: {
        id: true,
        title: true,
        startsAt: true,
      },
    },
    lines: {
      orderBy: { createdAt: 'asc' as const },
      include: {
        redemption: true,
      },
    },
    redemptions: true,
  };
}

export const eventDrinkOrdersService = {
  async createOrder(userId: string, eventId: string, input: CreateDrinkOrderInput) {
    await assertUserHasTicketForEvent(userId, eventId);

    const productIds = [...new Set(input.items.map((item) => item.product_id))];
    const products = await prisma.eventDrinkProduct.findMany({
      where: {
        eventId,
        id: { in: productIds },
        status: { not: 'hidden' },
      },
    });

    const productById = new Map(products.map((product) => [product.id, product]));
    const requestedLines = input.items.map((item) => {
      const product = productById.get(item.product_id);
      if (!product) {
        throw new AppError(404, 'DRINK_PRODUCT_NOT_FOUND', 'Drink product not found');
      }
      if (!isProductAvailable(product.status, product.stockRemaining)) {
        throw new AppError(409, 'DRINK_PRODUCT_UNAVAILABLE', `${product.name} is not available`);
      }
      if (
        product.stockRemaining != null &&
        product.stockRemaining < item.quantity
      ) {
        throw new AppError(409, 'DRINK_PRODUCT_OUT_OF_STOCK', `${product.name} is out of stock`);
      }

      return {
        lineId: crypto.randomBytes(12).toString('hex'),
        product,
        quantity: item.quantity,
      };
    });

    let subtotalClp = 0;
    let itemCount = 0;
    for (const line of requestedLines) {
      subtotalClp += line.product.priceClp * line.quantity;
      itemCount += line.quantity;
    }

    const isComplimentary = subtotalClp === 0;
    const serviceFeeClp =
      itemCount > 0 && !isComplimentary ? DRINK_ORDER_SERVICE_FEE_CLP : 0;
    const totalClp = subtotalClp + serviceFeeClp;

    const orderId = crypto.randomBytes(12).toString('hex');
    const unlockAt = new Date();

    const lineRedemptions = await Promise.all(
      requestedLines.map(async ({ lineId }) => ({
        lineId,
        manualEntryId: await generateUniqueEntryCode(),
        qrPayload: await generateUniqueQrPayload(lineId, eventId),
      })),
    );
    const redemptionByLineId = new Map(
      lineRedemptions.map((redemption) => [redemption.lineId, redemption]),
    );

    const order = await prisma.$transaction(async (tx) => {
      for (const line of requestedLines) {
        if (line.product.stockRemaining == null) {
          continue;
        }

        const nextRemaining = line.product.stockRemaining - line.quantity;
        const updated = await tx.eventDrinkProduct.updateMany({
          where: {
            id: line.product.id,
            stockRemaining: { gte: line.quantity },
          },
          data: {
            stockRemaining: { decrement: line.quantity },
            status: nextRemaining <= 0 ? 'sold_out' : line.product.status,
          },
        });

        if (updated.count === 0) {
          throw new AppError(
            409,
            'DRINK_PRODUCT_OUT_OF_STOCK',
            `${line.product.name} is out of stock`,
          );
        }
      }

      const createdOrder = await tx.eventDrinkOrder.create({
        data: {
          id: orderId,
          userId,
          eventId,
          subtotalClp,
          serviceFeeClp,
          totalClp,
          itemCount,
          status: 'confirmed',
          isComplimentary,
          lines: {
            create: requestedLines.map(({ lineId, product, quantity }) => {
              const redemption = redemptionByLineId.get(lineId);
              if (!redemption) {
                throw new AppError(500, 'DRINK_ORDER_QR_FAILED', 'Could not generate QR payload');
              }

              return {
                id: lineId,
                productId: product.id,
                productName: product.name,
                quantity,
                unitPriceClp: product.priceClp,
                lineTotalClp: product.priceClp * quantity,
                volumeMl: product.volumeMl,
                imageUrl: product.imageUrl,
                redemption: {
                  create: {
                    orderId,
                    manualEntryId: redemption.manualEntryId,
                    qrPayload: redemption.qrPayload,
                    unlockAt,
                  },
                },
              };
            }),
          },
        },
        include: loadOrderInclude(),
      });

      return createdOrder;
    });

    return formatDrinkOrder(order);
  },

  async listForUser(userId: string, options?: { complimentary?: boolean }) {
    const where: {
      userId: string;
      subtotalClp?: number | { gt: number };
    } = { userId };

    // Use subtotal as the source of truth so legacy orders without
    // is_complimentary in MongoDB still appear under the right tab.
    if (options?.complimentary === true) {
      where.subtotalClp = 0;
    } else if (options?.complimentary === false) {
      where.subtotalClp = { gt: 0 };
    }

    const orders = await prisma.eventDrinkOrder.findMany({
      where,
      include: loadOrderInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      orders: orders.map(formatDrinkOrder),
    };
  },

  async getForUser(userId: string, orderId: string) {
    const order = await prisma.eventDrinkOrder.findFirst({
      where: { id: orderId, userId },
      include: loadOrderInclude(),
    });

    if (!order) {
      throw new AppError(404, 'DRINK_ORDER_NOT_FOUND', 'Drink order not found');
    }

    return formatDrinkOrder(order);
  },
};
