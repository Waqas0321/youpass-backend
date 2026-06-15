import type { PrismaClient } from '@prisma/client';

type RawUpdateResult = { n?: number; nModified?: number };

async function repairCollectionTimestamps(
  prisma: PrismaClient,
  collection: string,
): Promise<number> {
  const result = (await prisma.$runCommandRaw({
    update: collection,
    updates: [
      {
        q: {
          $or: [{ updated_at: null }, { updated_at: { $exists: false } }],
        },
        u: [
          {
            $set: {
              updated_at: {
                $ifNull: ['$created_at', new Date()],
              },
            },
          },
        ],
        multi: true,
      },
    ],
  })) as RawUpdateResult;

  return result.nModified ?? result.n ?? 0;
}

/**
 * Legacy Mongo documents may lack `updated_at`. Prisma treats the field as
 * required, so invitation reads fail with P2032 when related producers are bad.
 */
export async function repairInvitationTimestamps(prisma: PrismaClient): Promise<number> {
  const producers = await repairCollectionTimestamps(prisma, 'producers');
  const invitations = await repairCollectionTimestamps(prisma, 'invitations');
  return producers + invitations;
}
