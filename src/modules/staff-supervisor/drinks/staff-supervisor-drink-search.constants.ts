import type { Prisma } from '@prisma/client';

export const DRINK_SEARCH_MAX_RESULTS = 20;

export const CANCELLED_DRINK_ORDER_STATUSES = ['cancelled', 'refunded', 'expired'] as const;

export const drinkRedemptionSearchInclude = {
  line: true,
  order: {
    include: {
      event: {
        select: {
          id: true,
          title: true,
          countryCode: true,
          startsAt: true,
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          rutOrPassport: true,
        },
      },
      lines: {
        include: {
          redemption: true,
        },
      },
    },
  },
} as const satisfies Prisma.EventDrinkRedemptionInclude;
