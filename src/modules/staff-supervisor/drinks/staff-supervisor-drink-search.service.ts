import { prisma } from '../../../config/database.js';
import type { Prisma } from '@prisma/client';
import { isMongoObjectId } from '../../../common/utils/mongo-id.js';
import { findDrinkRedemptionByScanInput } from '../../event-drinks/event-drink-redemption.service.js';
import {
  CANCELLED_DRINK_ORDER_STATUSES,
  DRINK_SEARCH_MAX_RESULTS,
  drinkRedemptionSearchInclude,
} from './staff-supervisor-drink-search.constants.js';
import type {
  DrinkRedemptionWithContext,
  StaffSupervisorDrinkSearchFilter,
  StaffSupervisorDrinkSearchStatus,
} from './staff-supervisor-drink-search.types.js';

export type StaffSupervisorSearchDrinksQuery = {
  q?: string;
  filter?: StaffSupervisorDrinkSearchFilter;
  event_id?: string;
};

function normalizeManualEntryCode(value: string) {
  return value.trim().toUpperCase();
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, '');
}

function activeEventWindow(): Prisma.EventWhereInput {
  const now = Date.now();
  return {
    startsAt: {
      gte: new Date(now - 24 * 60 * 60 * 1000),
      lte: new Date(now + 30 * 24 * 60 * 60 * 1000),
    },
  };
}

function buildOrderScope(
  query: StaffSupervisorSearchDrinksQuery,
  options?: { restrictToActiveEvents?: boolean },
): Prisma.EventDrinkOrderWhereInput {
  const orderWhere: Prisma.EventDrinkOrderWhereInput = {};

  if (query.event_id) {
    orderWhere.eventId = query.event_id;
  } else if (options?.restrictToActiveEvents !== false) {
    orderWhere.event = activeEventWindow();
  }

  if (query.filter === 'validated') {
    orderWhere.status = { in: ['confirmed', 'redeemed'] };
  } else if (query.filter === 'pending') {
    orderWhere.status = 'confirmed';
  } else if (query.filter === 'cancelled') {
    orderWhere.status = { in: [...CANCELLED_DRINK_ORDER_STATUSES] };
  }

  return orderWhere;
}

function buildRedemptionWhere(
  query: StaffSupervisorSearchDrinksQuery,
  options?: { restrictToActiveEvents?: boolean },
): Prisma.EventDrinkRedemptionWhereInput {
  const orderWhere = buildOrderScope(query, options);
  const redemptionWhere: Prisma.EventDrinkRedemptionWhereInput = {
    order: orderWhere,
  };

  if (query.filter === 'validated') {
    redemptionWhere.validatedAt = { not: null };
  } else if (query.filter === 'pending') {
    redemptionWhere.validatedAt = null;
  }

  return redemptionWhere;
}

function matchesQueryFilter(
  redemption: DrinkRedemptionWithContext,
  query: StaffSupervisorSearchDrinksQuery,
): boolean {
  if (query.filter === 'validated' && !redemption.validatedAt) {
    return false;
  }

  if (query.filter === 'pending' && redemption.validatedAt) {
    return false;
  }

  if (
    query.filter === 'cancelled' &&
    !CANCELLED_DRINK_ORDER_STATUSES.includes(
      redemption.order.status as (typeof CANCELLED_DRINK_ORDER_STATUSES)[number],
    )
  ) {
    return false;
  }

  if (query.event_id && redemption.order.eventId !== query.event_id) {
    return false;
  }

  return true;
}

function resolveDrinkStatus(redemption: DrinkRedemptionWithContext): StaffSupervisorDrinkSearchStatus {
  if (
    CANCELLED_DRINK_ORDER_STATUSES.includes(
      redemption.order.status as (typeof CANCELLED_DRINK_ORDER_STATUSES)[number],
    )
  ) {
    return 'cancelled';
  }

  if (redemption.validatedAt) {
    return 'validated';
  }

  if (redemption.order.status === 'confirmed') {
    return 'pending';
  }

  return 'error';
}

function mergeRedemptions(...groups: DrinkRedemptionWithContext[][]) {
  const merged = new Map<string, DrinkRedemptionWithContext>();
  for (const group of groups) {
    for (const redemption of group) {
      merged.set(redemption.id, redemption);
    }
  }
  return [...merged.values()];
}

function buildGuestSearchOr(term: string): Prisma.EventDrinkOrderWhereInput[] {
  const digits = phoneDigits(term);
  const guestOr: Prisma.EventDrinkOrderWhereInput[] = [
    { user: { is: { fullName: { contains: term, mode: 'insensitive' } } } },
    { user: { is: { email: { contains: term, mode: 'insensitive' } } } },
    { user: { is: { rutOrPassport: { contains: term, mode: 'insensitive' } } } },
    { event: { is: { title: { contains: term, mode: 'insensitive' } } } },
  ];

  if (digits.length >= 4) {
    guestOr.push({ user: { is: { phone: { contains: digits } } } });
  }

  return guestOr;
}

async function searchByGuestTerm(
  term: string,
  query: StaffSupervisorSearchDrinksQuery,
  restrictToActiveEvents = true,
): Promise<DrinkRedemptionWithContext[]> {
  return prisma.eventDrinkRedemption.findMany({
    where: {
      ...buildRedemptionWhere(query, { restrictToActiveEvents }),
      order: {
        ...buildOrderScope(query, { restrictToActiveEvents }),
        OR: buildGuestSearchOr(term),
      },
    },
    include: drinkRedemptionSearchInclude,
    take: DRINK_SEARCH_MAX_RESULTS,
    orderBy: { createdAt: 'desc' },
  });
}

async function searchByRedemptionIdentifiers(
  term: string,
  query: StaffSupervisorSearchDrinksQuery,
  restrictToActiveEvents = true,
): Promise<DrinkRedemptionWithContext[]> {
  const normalizedCode = normalizeManualEntryCode(term);
  const redemptionOr: Prisma.EventDrinkRedemptionWhereInput[] = [
    { manualEntryId: normalizedCode },
    { qrPayload: term },
    { manualEntryId: { contains: normalizedCode, mode: 'insensitive' } },
  ];

  if (isMongoObjectId(term)) {
    redemptionOr.push({ id: term });
  }

  return prisma.eventDrinkRedemption.findMany({
    where: {
      ...buildRedemptionWhere(query, { restrictToActiveEvents }),
      OR: redemptionOr,
    },
    include: drinkRedemptionSearchInclude,
    take: DRINK_SEARCH_MAX_RESULTS,
    orderBy: { createdAt: 'desc' },
  });
}

async function searchByProductName(
  term: string,
  query: StaffSupervisorSearchDrinksQuery,
  restrictToActiveEvents = true,
): Promise<DrinkRedemptionWithContext[]> {
  return prisma.eventDrinkRedemption.findMany({
    where: {
      ...buildRedemptionWhere(query, { restrictToActiveEvents }),
      OR: [
        { line: { is: { productName: { contains: term, mode: 'insensitive' } } } },
        {
          order: {
            is: {
              ...buildOrderScope(query, { restrictToActiveEvents }),
              lines: { some: { productName: { contains: term, mode: 'insensitive' } } },
            },
          },
        },
      ],
    },
    include: drinkRedemptionSearchInclude,
    take: DRINK_SEARCH_MAX_RESULTS,
    orderBy: { createdAt: 'desc' },
  });
}

async function searchByOrderReference(
  term: string,
  query: StaffSupervisorSearchDrinksQuery,
  restrictToActiveEvents = true,
): Promise<DrinkRedemptionWithContext[]> {
  if (isMongoObjectId(term)) {
    return prisma.eventDrinkRedemption.findMany({
      where: {
        ...buildRedemptionWhere(query, { restrictToActiveEvents }),
        orderId: term,
      },
      include: drinkRedemptionSearchInclude,
      take: DRINK_SEARCH_MAX_RESULTS,
      orderBy: { createdAt: 'desc' },
    });
  }

  const normalized = normalizeManualEntryCode(term);
  if (!normalized.startsWith('DRK-') || normalized.length < 8) {
    return [];
  }

  const suffix = normalized.slice(4).toLowerCase();
  const scopedRedemptions = await prisma.eventDrinkRedemption.findMany({
    where: buildRedemptionWhere(query, { restrictToActiveEvents }),
    include: drinkRedemptionSearchInclude,
    take: DRINK_SEARCH_MAX_RESULTS * 10,
    orderBy: { createdAt: 'desc' },
  });

  return scopedRedemptions
    .filter((redemption) => redemption.orderId.toLowerCase().endsWith(suffix))
    .slice(0, DRINK_SEARCH_MAX_RESULTS);
}

async function searchByFilterOnly(
  query: StaffSupervisorSearchDrinksQuery,
  restrictToActiveEvents = true,
): Promise<DrinkRedemptionWithContext[]> {
  return prisma.eventDrinkRedemption.findMany({
    where: buildRedemptionWhere(query, { restrictToActiveEvents }),
    include: drinkRedemptionSearchInclude,
    take: DRINK_SEARCH_MAX_RESULTS,
    orderBy: { createdAt: 'desc' },
  });
}

async function filterRedemptionsWithDuplicateAttempts(redemptions: DrinkRedemptionWithContext[]) {
  if (redemptions.length === 0) {
    return [];
  }

  const entryIds = redemptions.map((redemption) => redemption.manualEntryId);
  const duplicateLogs = await prisma.staffScanLog.findMany({
    where: {
      entryId: { in: entryIds },
      scanType: 'product',
      outcome: 'already_used',
    },
    select: { entryId: true },
    distinct: ['entryId'],
  });

  const duplicateEntryIds = new Set(
    duplicateLogs.map((log) => log.entryId).filter((entryId): entryId is string => Boolean(entryId)),
  );

  return redemptions.filter((redemption) => duplicateEntryIds.has(redemption.manualEntryId));
}

export async function searchSupervisorDrinks(query: StaffSupervisorSearchDrinksQuery) {
  const term = query.q?.trim() ?? '';
  const restrictToActiveEvents = term.length === 0 && !query.event_id;

  if (!term && query.filter) {
    let results = await searchByFilterOnly(query, restrictToActiveEvents);
    if (query.filter === 'duplicate') {
      results = await filterRedemptionsWithDuplicateAttempts(results);
    }
    return results.slice(0, DRINK_SEARCH_MAX_RESULTS);
  }

  const tasks: Promise<DrinkRedemptionWithContext[]>[] = [
    searchByGuestTerm(term, query, restrictToActiveEvents),
    searchByRedemptionIdentifiers(term, query, restrictToActiveEvents),
    searchByProductName(term, query, restrictToActiveEvents),
  ];

  if (term.length >= 4) {
    tasks.push(
      findDrinkRedemptionByScanInput(term).then((direct) => {
        if (!direct) {
          return [];
        }

        const redemption = direct as DrinkRedemptionWithContext;
        return matchesQueryFilter(redemption, query) ? [redemption] : [];
      }),
    );
  }

  if (term.length >= 3) {
    tasks.push(searchByOrderReference(term, query, restrictToActiveEvents));
  }

  const groups = await Promise.all(tasks);
  let results = mergeRedemptions(...groups);

  if (query.filter === 'duplicate') {
    results = await filterRedemptionsWithDuplicateAttempts(results);
  }

  return results.slice(0, DRINK_SEARCH_MAX_RESULTS);
}

export async function loadDrinkRedemptionById(redemptionId: string) {
  if (!isMongoObjectId(redemptionId)) {
    return null;
  }

  return prisma.eventDrinkRedemption.findUnique({
    where: { id: redemptionId },
    include: drinkRedemptionSearchInclude,
  });
}

export function resolveRedemptionLine(redemption: DrinkRedemptionWithContext) {
  return (
    redemption.line ??
    redemption.order.lines.find((line) => line.id === redemption.lineId) ??
    redemption.order.lines[0] ??
    null
  );
}

export function formatDrinkOrderCode(orderId: string) {
  return `DRK-${orderId.slice(-6).toUpperCase()}`;
}

export { resolveDrinkStatus, drinkRedemptionSearchInclude };
export type { DrinkRedemptionWithContext, StaffSupervisorDrinkSearchStatus };
