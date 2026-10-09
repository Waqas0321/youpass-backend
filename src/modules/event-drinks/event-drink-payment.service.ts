import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  chargeKushkiSubscription,
  isKushkiConfigured,
  isKushkiSavedTokenChargeable,
  refundKushkiCharge,
} from '../payments/kushki.client.js';

export type DrinkPaymentResult = {
  paymentMethodId: string;
  paymentGateway: string;
  paymentReference: string;
  cardBrand: string;
  cardLastFour: string;
};

const MOCK_PREFIX = 'mock_';

/** The card to charge: the one the user picked, else their default saved card. */
async function resolvePaymentMethod(userId: string, paymentMethodId?: string) {
  const method = paymentMethodId
    ? await prisma.userPaymentMethod.findFirst({
        where: {
          userId,
          OR: [{ id: paymentMethodId }, { providerToken: paymentMethodId }],
        },
      })
    : await prisma.userPaymentMethod.findFirst({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

  if (!method) {
    throw new AppError(
      paymentMethodId ? 404 : 422,
      paymentMethodId ? 'PAYMENT_METHOD_NOT_FOUND' : 'PAYMENT_METHOD_REQUIRED',
      paymentMethodId ? 'Payment method not found' : 'Add a card to buy drinks',
    );
  }
  return method;
}

/**
 * Charges a paid drink order to the user's saved card (same path as ticket checkout:
 * Kushki one-click subscription charge; mock reference when CHECKOUT_MOCK_PAYMENT).
 */
export async function chargeDrinkOrder(input: {
  userId: string;
  paymentMethodId?: string;
  amount: number;
  currency: string;
  orderId: string;
}): Promise<DrinkPaymentResult> {
  const method = await resolvePaymentMethod(input.userId, input.paymentMethodId);
  const base = {
    paymentMethodId: method.id,
    cardBrand: method.brand,
    cardLastFour: method.lastFour,
  };

  if (env.CHECKOUT_MOCK_PAYMENT) {
    return {
      ...base,
      paymentGateway: method.gateway ?? 'mock',
      paymentReference: `${MOCK_PREFIX}${crypto.randomBytes(6).toString('hex')}`,
    };
  }

  if (
    isKushkiConfigured() &&
    method.gateway === 'kushki' &&
    isKushkiSavedTokenChargeable(method.providerToken)
  ) {
    const charge = await chargeKushkiSubscription({
      subscriptionId: method.providerToken,
      amount: input.amount,
      currency: input.currency,
      orderId: `drink_${input.orderId}`,
    });
    return { ...base, paymentGateway: 'kushki', paymentReference: charge.ticketNumber };
  }

  throw new AppError(
    422,
    'CARD_NOT_CHARGEABLE',
    'This saved card cannot be charged. Add a card with Kushki, then pay.',
  );
}

/** Returns money for a charged drink order. Mock charges get a mock refund reference. */
export async function refundDrinkPayment(order: {
  paymentGateway: string | null;
  paymentReference: string | null;
  totalClp: number;
  currency: string;
}): Promise<string | null> {
  if (!order.paymentReference) {
    // Courtesy or legacy order with no recorded charge: nothing to return.
    return null;
  }
  if (order.paymentReference.startsWith(MOCK_PREFIX)) {
    return `${MOCK_PREFIX}refund_${crypto.randomBytes(6).toString('hex')}`;
  }
  if (order.paymentGateway === 'kushki') {
    const refund = await refundKushkiCharge({ ticketNumber: order.paymentReference });
    return refund.refundTicketNumber;
  }
  throw new AppError(
    409,
    'DRINK_REFUND_UNSUPPORTED',
    `Automatic refunds are not supported for gateway ${order.paymentGateway ?? 'unknown'}`,
  );
}
