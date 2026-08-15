import type { Prisma } from '@prisma/client';
import { drinkRedemptionSearchInclude } from './staff-supervisor-drink-search.constants.js';

export type DrinkRedemptionWithContext = Prisma.EventDrinkRedemptionGetPayload<{
  include: typeof drinkRedemptionSearchInclude;
}>;

export type StaffSupervisorDrinkSearchStatus =
  | 'validated'
  | 'pending'
  | 'cancelled'
  | 'blocked'
  | 'error';

export type StaffSupervisorDrinkSearchFilter =
  | 'validated'
  | 'pending'
  | 'cancelled'
  | 'duplicate';
