import type { Prisma } from '@prisma/client';

/** Prisma MongoDB: `revokedAt: null` does not match unset fields — use isSet. */
export const activeSessionWhere: Pick<Prisma.UserSessionWhereInput, 'OR'> = {
  OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }],
};

export function isSessionActive(revokedAt: Date | null | undefined): boolean {
  return revokedAt == null;
}

export function isSessionExpired(expiresAt: Date | null | undefined): boolean {
  return expiresAt != null && expiresAt <= new Date();
}
