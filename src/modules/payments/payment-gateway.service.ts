import crypto from 'node:crypto';
import type { PaymentGateway } from '@prisma/client';
import { env } from '../../config/env.js';
import { resolveGateway } from '../../common/services/country-config.service.js';

export type PreparePaymentInput = {
  orderId: string;
  countryCode: string;
  amount: number;
  currency: string;
  buyerUserId: string;
};

export type KlapPaymentPayload = {
  payment_url: string;
  session_id: string;
};

export type StripePaymentPayload = {
  payment_intent_id: string;
  client_secret: string;
  customer_id: string;
};

export type PreparedPayment =
  | { gateway: 'klap'; klap: KlapPaymentPayload }
  | { gateway: 'stripe'; stripe: StripePaymentPayload };

export function resolvePaymentGateway(countryCode: string): PaymentGateway {
  return resolveGateway(countryCode);
}

export async function preparePayment(input: PreparePaymentInput): Promise<PreparedPayment> {
  const gateway = resolvePaymentGateway(input.countryCode);

  if (gateway === 'klap') {
    const sessionId = env.KLAP_API_KEY
      ? `klap_${crypto.randomBytes(12).toString('hex')}`
      : `klap_sess_${input.orderId}`;
    const baseUrl = env.KLAP_CHECKOUT_BASE_URL || `${env.APP_CLAIM_BASE_URL}/pay/klap`;
    return {
      gateway: 'klap',
      klap: {
        session_id: sessionId,
        payment_url: `${baseUrl}/${input.orderId}?session=${sessionId}`,
      },
    };
  }

  const intentId = env.STRIPE_SECRET_KEY
    ? `pi_${crypto.randomBytes(12).toString('hex')}`
    : `pi_mock_${input.orderId}`;

  return {
    gateway: 'stripe',
    stripe: {
      payment_intent_id: intentId,
      client_secret: `${intentId}_secret_${crypto.randomBytes(8).toString('hex')}`,
      customer_id: `cus_${input.buyerUserId}`,
    },
  };
}
