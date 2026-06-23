import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  formatAdminDrinkOrderDetail,
  formatAdminDrinkOrderListItem,
  resolveAdminDrinkOrderQrStatus,
  type AdminDrinkOrderQrStatus,
} from './admin-event-drink-orders.formatter.js';
import { generateEntryCode, generateQrPayload } from '../invitations/invitations.utils.js';

const DEFAULT_PAGE_SIZE = 8;

type ListQuery = {
  q?: string;
  page?: number;
  limit?: number;
  product_id?: string;
  qr_status?: AdminDrinkOrderQrStatus;
  date_from?: string;
  date_to?: string;
};

function loadOrderInclude() {
  return {
    event: {
      select: {
        id: true,
        title: true,
        startsAt: true,
      },
    },
    user: {
      select: {
        id: true,
        fullName: true,
        phone: true,
        profilePhotoUrl: true,
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

function buildSearchWhere(eventId: string, q?: string): Prisma.EventDrinkOrderWhereInput {
  const where: Prisma.EventDrinkOrderWhereInput = { eventId };

  if (!q?.trim()) {
    return where;
  }

  const term = q.trim();
  where.OR = [
    { id: { contains: term, mode: 'insensitive' } },
    {
      user: {
        OR: [
          { fullName: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
        ],
      },
    },
    {
      lines: {
        some: {
          productName: { contains: term, mode: 'insensitive' },
        },
      },
    },
    {
      lines: {
        some: {
          redemption: {
            is: {
              manualEntryId: { contains: term, mode: 'insensitive' },
            },
          },
        },
      },
    },
  ];

  return where;
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

async function generateUniqueQrPayload(lineId: string, eventId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const payload = generateQrPayload(lineId, eventId);
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

async function loadOrderForEvent(eventId: string, orderId: string) {
  const order = await prisma.eventDrinkOrder.findFirst({
    where: { id: orderId, eventId },
    include: loadOrderInclude(),
  });

  if (!order) {
    throw new AppError(404, 'DRINK_ORDER_NOT_FOUND', 'Drink order not found');
  }

  return order;
}

export const adminEventDrinkOrdersService = {
  async listForEvent(eventId: string, query: ListQuery) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), 50);

    const where = buildSearchWhere(eventId, query.q);

    if (query.product_id) {
      where.lines = {
        some: {
          productId: query.product_id,
        },
      };
    }

    if (query.date_from || query.date_to) {
      where.createdAt = {};
      if (query.date_from) {
        where.createdAt.gte = new Date(query.date_from);
      }
      if (query.date_to) {
        const end = new Date(query.date_to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const allMatching = await prisma.eventDrinkOrder.findMany({
      where,
      include: loadOrderInclude(),
      orderBy: { createdAt: 'desc' },
    });

    const filtered = query.qr_status
      ? allMatching.filter((order) => resolveAdminDrinkOrderQrStatus(order) === query.qr_status)
      : allMatching;

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const pageItems = filtered.slice((page - 1) * limit, page * limit);

    return {
      orders: pageItems.map(formatAdminDrinkOrderListItem),
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        from: total === 0 ? 0 : (page - 1) * limit + 1,
        to: Math.min(page * limit, total),
      },
    };
  },

  async getForEvent(eventId: string, orderId: string) {
    const order = await loadOrderForEvent(eventId, orderId);
    return formatAdminDrinkOrderDetail(order);
  },

  async reissueQr(eventId: string, orderId: string) {
    const order = await loadOrderForEvent(eventId, orderId);

    if (order.status === 'refunded' || order.status === 'cancelled') {
      throw new AppError(409, 'DRINK_ORDER_NOT_REISSUABLE', 'This order cannot be reissued');
    }

    const linesToReissue = order.lines.filter(
      (line) => line.redemption && !line.redemption.validatedAt,
    );

    if (linesToReissue.length === 0) {
      throw new AppError(409, 'DRINK_ORDER_NO_REDEMPTION', 'This order has no QR to reissue');
    }

    const reissuePayloads = await Promise.all(
      linesToReissue.map(async (line) => ({
        lineId: line.id,
        manualEntryId: await generateUniqueEntryCode(),
        qrPayload: await generateUniqueQrPayload(line.id, eventId),
      })),
    );

    await prisma.$transaction([
      ...reissuePayloads.map((payload) =>
        prisma.eventDrinkRedemption.update({
          where: { lineId: payload.lineId },
          data: {
            manualEntryId: payload.manualEntryId,
            qrPayload: payload.qrPayload,
            validatedAt: null,
            unlockAt: new Date(),
          },
        }),
      ),
      prisma.eventDrinkOrder.update({
        where: { id: order.id },
        data: { status: 'confirmed' },
      }),
    ]);

    return this.getForEvent(eventId, orderId);
  },

  async refund(eventId: string, orderId: string) {
    const order = await loadOrderForEvent(eventId, orderId);

    if (order.status === 'refunded') {
      throw new AppError(409, 'DRINK_ORDER_ALREADY_REFUNDED', 'Order already refunded');
    }

    await prisma.eventDrinkOrder.update({
      where: { id: order.id },
      data: { status: 'refunded' },
    });

    return this.getForEvent(eventId, orderId);
  },

  async invalidate(eventId: string, orderId: string) {
    const order = await loadOrderForEvent(eventId, orderId);

    if (order.status === 'cancelled') {
      throw new AppError(409, 'DRINK_ORDER_ALREADY_INVALID', 'Order already invalid');
    }

    await prisma.eventDrinkOrder.update({
      where: { id: order.id },
      data: { status: 'cancelled' },
    });

    return this.getForEvent(eventId, orderId);
  },

  async exportCsv(eventId: string, query: ListQuery) {
    const payload = await this.listForEvent(eventId, {
      ...query,
      page: 1,
      limit: 5000,
    });

    const header = [
      'order_id',
      'display_order_id',
      'user_name',
      'user_phone',
      'product_summary',
      'payment_method',
      'created_at',
      'qr_status',
      'total_clp',
      'entry_code',
    ];

    const rows = payload.orders.map((order) => [
      order.order_id,
      order.display_order_id,
      order.user.full_name,
      order.user.phone,
      order.product_summary,
      order.payment_method.label,
      order.created_at,
      order.qr_status,
      String(order.total_clp),
      order.entry_code ?? '',
    ]);

    return [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  },
};
