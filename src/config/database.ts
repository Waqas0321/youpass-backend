import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConnect: Promise<void> | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

globalForPrisma.prisma = prisma;

/** Connect once per serverless instance (Vercel reuses warm lambdas). */
export function connectDatabase(): Promise<void> {
  if (!globalForPrisma.prismaConnect) {
    globalForPrisma.prismaConnect = prisma.$connect().catch((err) => {
      globalForPrisma.prismaConnect = undefined;
      throw err;
    });
  }
  return globalForPrisma.prismaConnect;
}
