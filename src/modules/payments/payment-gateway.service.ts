import crypto from 'node:crypto';
import type { PaymentGateway } from '@prisma/client';
import { env } from '../../config/env.js';
import { resolveGateway } from '../../common/services/country-config.service.js';
import { isKushkiConfigured } from './kushki.client.js';

export type PreparePaymentInput = {
  orderId: string;
  countryCode: string;
  amount: number;
  currency: string;
  buyerUserId: string;
  apiOrigin?: string;
};

export type KlapPaymentPayload = {
  payment_url: string;
  session_id: string;
};

export type KushkiPaymentPayload = {
  payment_url: string;
  session_id: string;
  public_merchant_id: string | null;
  environment: 'uat' | 'live';
};

export type StripePaymentPayload = {
  payment_intent_id: string;
  client_secret: string;
  customer_id: string;
};

export type PreparedPayment =
  | { gateway: 'klap'; klap: KlapPaymentPayload }
  | { gateway: 'kushki'; kushki: KushkiPaymentPayload }
  | { gateway: 'stripe'; stripe: StripePaymentPayload };

export function resolvePaymentGateway(countryCode: string): PaymentGateway {
  return resolveGateway(countryCode);
}

function resolveApiOrigin(apiOrigin?: string): string {
  if (apiOrigin?.trim()) {
    return apiOrigin.trim().replace(/\/$/, '');
  }
  if (env.KUSHKI_CHECKOUT_BASE_URL.trim()) {
    return '';
  }
  if (process.env.PUBLIC_API_ORIGIN?.trim()) {
    return process.env.PUBLIC_API_ORIGIN.trim().replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/$/, '')}`;
  }
  return 'https://youpass-backend-two.vercel.app';
}

function buildKushkiCheckoutUrl(input: PreparePaymentInput, sessionId: string): string {
  if (env.KUSHKI_CHECKOUT_BASE_URL.trim()) {
    const base = env.KUSHKI_CHECKOUT_BASE_URL.trim().replace(/\/$/, '');
    return `${base}/${input.orderId}?session=${sessionId}&amount=${input.amount}&currency=${input.currency}`;
  }

  const origin = resolveApiOrigin(input.apiOrigin);
  return `${origin}${env.API_PREFIX}/payments/kushki/checkout/${input.orderId}?session=${sessionId}&amount=${input.amount}&currency=${encodeURIComponent(input.currency)}`;
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

  if (gateway === 'kushki') {
    const sessionId = isKushkiConfigured()
      ? `kushki_${crypto.randomBytes(12).toString('hex')}`
      : `kushki_sess_${input.orderId}`;
    return {
      gateway: 'kushki',
      kushki: {
        session_id: sessionId,
        payment_url: buildKushkiCheckoutUrl(input, sessionId),
        public_merchant_id: env.KUSHKI_PUBLIC_MERCHANT_ID || null,
        environment: env.KUSHKI_USE_UAT ? 'uat' : 'live',
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
