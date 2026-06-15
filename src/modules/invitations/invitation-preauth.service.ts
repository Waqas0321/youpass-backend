import type { PaymentGateway } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';

const PREAUTH_HOLD_DAYS = 7;

function defaultPreauthExpiry(): Date {
  return new Date(Date.now() + PREAUTH_HOLD_DAYS * 24 * 60 * 60 * 1000);
}

export type CreatePreAuthInput = {
  invitationId: string;
  userId: string;
  cardId: string;
  amount: number;
  gateway: PaymentGateway;
  gatewayTransactionId: string;
  expiresAt?: Date;
};

export async function createInvitationPreAuth(input: CreatePreAuthInput) {
  const existing = await prisma.invitationPreAuth.findUnique({
    where: { invitationId: input.invitationId },
  });
  if (existing) {
    throw new AppError(409, 'PREAUTH_EXISTS', 'Pre-authorisation already exists for this invitation');
  }

  return prisma.invitationPreAuth.create({
    data: {
      invitationId: input.invitationId,
      userId: input.userId,
      cardId: input.cardId,
      amount: input.amount,
      gateway: input.gateway,
      gatewayTransactionId: input.gatewayTransactionId,
      status: 'pre_authorized',
      expiresAt: input.expiresAt ?? defaultPreauthExpiry(),
    },
  });
}

export async function releaseInvitationPreAuth(invitationId: string) {
  const preAuth = await prisma.invitationPreAuth.findUnique({ where: { invitationId } });
  if (!preAuth || preAuth.status !== 'pre_authorized') {
    return null;
  }

  return prisma.invitationPreAuth.update({
    where: { invitationId },
    data: {
      status: 'released',
      releasedAt: new Date(),
    },
  });
}

export async function captureInvitationPreAuth(invitationId: string) {
  const preAuth = await prisma.invitationPreAuth.findUnique({ where: { invitationId } });
  if (!preAuth) {
    throw new AppError(422, 'PREAUTH_MISSING', 'No pre-authorisation found for this invitation');
  }
  if (preAuth.status !== 'pre_authorized') {
    throw new AppError(422, 'PREAUTH_NOT_ACTIVE', 'Pre-authorisation is not active');
  }
  if (preAuth.expiresAt <= new Date()) {
    await prisma.invitationPreAuth.update({
      where: { invitationId },
      data: { status: 'failed' },
    });
    throw new AppError(422, 'PREAUTH_EXPIRED', 'Pre-authorisation expired before capture');
  }

  return prisma.invitationPreAuth.update({
    where: { invitationId },
    data: {
      status: 'captured',
      capturedAt: new Date(),
    },
  });
}

export async function failInvitationPreAuth(invitationId: string) {
  const preAuth = await prisma.invitationPreAuth.findUnique({ where: { invitationId } });
  if (!preAuth) {
    return null;
  }
  return prisma.invitationPreAuth.update({
    where: { invitationId },
    data: { status: 'failed' },
  });
}

export async function getActivePreAuth(invitationId: string) {
  return prisma.invitationPreAuth.findFirst({
    where: {
      invitationId,
      status: 'pre_authorized',
      expiresAt: { gt: new Date() },
    },
  });
}

export const invitationPreAuthService = {
  createInvitationPreAuth,
  releaseInvitationPreAuth,
  captureInvitationPreAuth,
  failInvitationPreAuth,
  getActivePreAuth,
};
