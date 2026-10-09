import type { Prisma, User } from '@prisma/client';
import { activeSessionWhere } from '../../common/utils/session-query.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { parseAndValidatePhone } from '../../common/utils/phone.js';
import { accountDeletionService } from '../users/account-deletion.service.js';
import type { AdminUserUpdateInput, AdminUsersListQuery } from './admin-users.validators.js';

type UserStats = {
  tickets_bought: number;
  orders_count: number;
  total_spent: number;
  drink_orders_count: number;
  drinks_spent: number;
  last_active_at: string | null;
};

function emptyStats(): UserStats {
  return {
    tickets_bought: 0,
    orders_count: 0,
    total_spent: 0,
    drink_orders_count: 0,
    drinks_spent: 0,
    last_active_at: null,
  };
}

function formatUserRow(user: User, stats: UserStats) {
  return {
    id: user.id,
    full_name: user.fullName,
    phone: user.phone,
    email: user.email,
    country_code: user.countryCode,
    rut_or_passport: user.rutOrPassport,
    birthdate: user.birthdate.toISOString().slice(0, 10),
    gender: user.gender,
    instagram_username: user.instagramUsername,
    profile_photo_url: user.profilePhotoUrl,
    preferred_language: user.preferredLanguage,
    category: user.category,
    account_status: user.accountStatus,
    blocked_at: user.blockedAt?.toISOString() ?? null,
    blocked_reason: user.blockedReason,
    deletion_scheduled_at: user.deletionScheduledAt?.toISOString() ?? null,
    created_at: user.createdAt.toISOString(),
    ...stats,
  };
}

/** Per-user purchase / activity stats for a page of users (3 grouped queries). */
async function loadStats(userIds: string[]): Promise<Map<string, UserStats>> {
  const stats = new Map<string, UserStats>(userIds.map((id) => [id, emptyStats()]));
  if (userIds.length === 0) return stats;

  const [orders, drinks, sessions] = await Promise.all([
    prisma.ticketOrder.groupBy({
      by: ['buyerUserId'],
      where: { buyerUserId: { in: userIds }, status: 'paid' },
      _sum: { quantity: true, totalAmount: true },
      _count: { _all: true },
    }),
    prisma.eventDrinkOrder.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, status: { in: ['confirmed', 'redeemed'] } },
      _sum: { totalClp: true },
      _count: { _all: true },
    }),
    prisma.userSession.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _max: { lastActivityAt: true },
    }),
  ]);

  for (const row of orders) {
    const entry = stats.get(row.buyerUserId);
    if (!entry) continue;
    entry.tickets_bought = row._sum.quantity ?? 0;
    entry.total_spent = row._sum.totalAmount ?? 0;
    entry.orders_count = row._count._all;
  }
  for (const row of drinks) {
    const entry = stats.get(row.userId);
    if (!entry) continue;
    entry.drinks_spent = row._sum.totalClp ?? 0;
    entry.drink_orders_count = row._count._all;
  }
  for (const row of sessions) {
    const entry = stats.get(row.userId);
    if (!entry) continue;
    entry.last_active_at = row._max.lastActivityAt?.toISOString() ?? null;
  }
  return stats;
}

async function requireUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  return user;
}

async function revokeAllSessions(userId: string) {
  await prisma.userSession.updateMany({
    where: { userId, ...activeSessionWhere },
    data: { revokedAt: new Date() },
  });
}

export const adminUsersService = {
  async list(query: AdminUsersListQuery) {
    const where: Prisma.UserWhereInput = {};
    if (query.status !== 'all') {
      where.accountStatus = query.status;
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.q) {
      const contains = { contains: query.q, mode: 'insensitive' as const };
      const digits = query.q.replace(/\D/g, '');
      where.OR = [
        { fullName: contains },
        { email: contains },
        { rutOrPassport: contains },
        ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
      ];
    }

    const orderBy: Prisma.UserOrderByWithRelationInput =
      query.sort === 'oldest'
        ? { createdAt: 'asc' }
        : query.sort === 'name'
          ? { fullName: 'asc' }
          : { createdAt: 'desc' };

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [total, users, statusCounts, newThisMonth] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
      prisma.user.groupBy({ by: ['accountStatus'], _count: { _all: true } }),
      prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    ]);

    const stats = await loadStats(users.map((user) => user.id));
    let rows = users.map((user) => formatUserRow(user, stats.get(user.id) ?? emptyStats()));
    if (query.sort === 'last_active') {
      rows = rows.sort((a, b) => (b.last_active_at ?? '').localeCompare(a.last_active_at ?? ''));
    }

    const byStatus = Object.fromEntries(
      statusCounts.map((row) => [row.accountStatus, row._count._all]),
    ) as Partial<Record<User['accountStatus'], number>>;

    return {
      users: rows,
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total,
        total_pages: Math.max(1, Math.ceil(total / query.page_size)),
      },
      summary: {
        total_users: Object.values(byStatus).reduce((sum, value) => sum + (value ?? 0), 0),
        active: byStatus.active ?? 0,
        blocked: byStatus.blocked ?? 0,
        pending_deletion: byStatus.pending_deletion ?? 0,
        deleted: byStatus.deleted ?? 0,
        new_this_month: newThisMonth,
      },
    };
  },

  async detail(userId: string) {
    const user = await requireUser(userId);
    const [stats, orders, invitations, drinkOrders, paymentMethods, favoritesCount, activeSessions] =
      await Promise.all([
        loadStats([user.id]),
        prisma.ticketOrder.findMany({
          where: { buyerUserId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { event: { select: { id: true, title: true, startsAt: true } } },
        }),
        prisma.invitation.findMany({
          where: { recipientUserId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { event: { select: { id: true, title: true, startsAt: true } } },
        }),
        prisma.eventDrinkOrder.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { event: { select: { id: true, title: true } } },
        }),
        prisma.userPaymentMethod.findMany({
          where: { userId: user.id },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.eventFavorite.count({ where: { userId: user.id } }),
        prisma.userSession.count({ where: { userId: user.id, ...activeSessionWhere } }),
      ]);

    return {
      user: formatUserRow(user, stats.get(user.id) ?? emptyStats()),
      active_sessions: activeSessions,
      favorites_count: favoritesCount,
      ticket_orders: orders.map((order) => ({
        id: order.id,
        event_id: order.event.id,
        event_title: order.event.title,
        event_starts_at: order.event.startsAt.toISOString(),
        quantity: order.quantity,
        type: order.type,
        total_amount: order.totalAmount,
        currency: order.currency,
        status: order.status,
        created_at: order.createdAt.toISOString(),
      })),
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        event_id: invitation.event.id,
        event_title: invitation.event.title,
        event_starts_at: invitation.event.startsAt.toISOString(),
        type: invitation.type,
        tier: invitation.tier,
        source: invitation.source,
        status: invitation.status,
        created_at: invitation.createdAt.toISOString(),
      })),
      drink_orders: drinkOrders.map((order) => ({
        id: order.id,
        event_id: order.event.id,
        event_title: order.event.title,
        total_clp: order.totalClp,
        status: order.status,
        created_at: order.createdAt.toISOString(),
      })),
      payment_methods: paymentMethods.map((method) => ({
        id: method.id,
        brand: method.brand,
        last_four: method.lastFour,
        is_default: method.isDefault,
        gateway: method.gateway,
      })),
    };
  },

  async update(userId: string, input: AdminUserUpdateInput) {
    const user = await requireUser(userId);
    if (user.accountStatus === 'deleted') {
      throw new AppError(409, 'USER_DELETED', 'Deleted users cannot be edited');
    }

    const data: Prisma.UserUpdateInput = {};
    if (input.full_name !== undefined) data.fullName = input.full_name;
    if (input.email !== undefined) data.email = input.email.toLowerCase();
    if (input.rut_or_passport !== undefined) data.rutOrPassport = input.rut_or_passport;
    if (input.birthdate !== undefined) data.birthdate = new Date(`${input.birthdate}T00:00:00.000Z`);
    if (input.gender !== undefined) data.gender = input.gender;
    if (input.instagram_username !== undefined) {
      data.instagramUsername = input.instagram_username?.replace(/^@/, '') || null;
    }
    if (input.category !== undefined) data.category = input.category;
    if (input.preferred_language !== undefined) data.preferredLanguage = input.preferred_language;

    if (input.phone !== undefined || input.country_code !== undefined) {
      const parsed = await parseAndValidatePhone(
        input.phone ?? user.phone,
        input.country_code ?? user.countryCode,
      );
      if (parsed.e164 !== user.phone) {
        const taken = await prisma.user.findUnique({ where: { phone: parsed.e164 } });
        if (taken && taken.id !== user.id) {
          throw new AppError(409, 'PHONE_IN_USE', 'Another account already uses this phone number');
        }
      }
      data.phone = parsed.e164;
      data.countryCode = parsed.countryCode;
    }

    const updated = await prisma.user.update({ where: { id: user.id }, data });
    const stats = await loadStats([updated.id]);
    return formatUserRow(updated, stats.get(updated.id) ?? emptyStats());
  },

  async block(userId: string, reason?: string) {
    const user = await requireUser(userId);
    if (user.accountStatus === 'deleted') {
      throw new AppError(409, 'USER_DELETED', 'Deleted users cannot be blocked');
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        accountStatus: 'blocked',
        blockedAt: new Date(),
        blockedReason: reason || null,
        // A pending self-deletion is superseded by the block.
        deletionRequestedAt: null,
        deletionScheduledAt: null,
      },
    });
    // Signs the user out of the app immediately.
    await revokeAllSessions(user.id);
    const stats = await loadStats([updated.id]);
    return formatUserRow(updated, stats.get(updated.id) ?? emptyStats());
  },

  async unblock(userId: string) {
    const user = await requireUser(userId);
    if (user.accountStatus !== 'blocked') {
      throw new AppError(409, 'USER_NOT_BLOCKED', 'This user is not blocked');
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { accountStatus: 'active', blockedAt: null, blockedReason: null },
    });
    const stats = await loadStats([updated.id]);
    return formatUserRow(updated, stats.get(updated.id) ?? emptyStats());
  },

  async remove(userId: string) {
    const user = await requireUser(userId);
    if (user.accountStatus === 'deleted') {
      throw new AppError(409, 'USER_DELETED', 'This user is already deleted');
    }
    return accountDeletionService.deleteNowByAdmin(user.id);
  },
};
