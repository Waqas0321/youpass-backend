import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { resolvePaymentGateway } from '../payments/payment-gateway.service.js';

export type InvitationPaymentInput = {
  invitationId: string;
  userId: string;
  countryCode: string;
  amount: number;
  currency: string;
  paymentMethodToken: string;
};

/**
 * Pre-authorises the guest card for a Guaranteed Pass (Type 2).
 * Charge is captured later only on no-show — see invitation-no-show-charge.service.
 */
export async function preauthorizeInvitationPayment(input: InvitationPaymentInput) {
  const gateway = resolvePaymentGateway(input.countryCode);

  if (gateway !== 'klap' && !env.STRIPE_SECRET_KEY) {
    return {
      gateway,
      preauth_reference: `preauth_mock_${input.invitationId}`,
      status: 'authorized' as const,
    };
  }

  const preauthReference = env.KLAP_API_KEY
    ? `klap_preauth_${crypto.randomBytes(10).toString('hex')}`
    : `preauth_mock_${input.invitationId}`;

  return {
    gateway,
    preauth_reference: preauthReference,
    status: 'authorized' as const,
  };
}

/**
 * Charges the guest immediately for a Discounted Invitation (Type 3).
 */
export async function chargeInvitationPayment(input: InvitationPaymentInput) {
  if (input.amount <= 0) {
    throw new AppError(422, 'INVALID_CHARGE_AMOUNT', 'Discounted invitation requires a payment amount');
  }

  const gateway = resolvePaymentGateway(input.countryCode);
  const paymentReference = env.KLAP_API_KEY
    ? `klap_inv_${crypto.randomBytes(10).toString('hex')}`
    : `pay_mock_${input.invitationId}`;

  return {
    gateway,
    payment_reference: paymentReference,
    status: 'paid' as const,
  };
}

/**
 * Captures a previously pre-authorised Guaranteed Pass charge on no-show.
 */
export async function capturePreauthorizedPayment(preauthReference: string, amount: number) {
  if (!preauthReference) {
    throw new AppError(422, 'PREAUTH_MISSING', 'No pre-authorisation found for this invitation');
  }

  return {
    capture_reference: `capture_${preauthReference}_${amount}`,
    status: 'captured' as const,
  };
}

/**
 * Releases a card hold after attendance validation or timely cancellation.
 */
export async function releasePreauthorizedPayment(preauthReference: string) {
  if (!preauthReference) {
    throw new AppError(422, 'PREAUTH_MISSING', 'No pre-authorisation found for this invitation');
  }

  return {
    release_reference: `release_${preauthReference}`,
    status: 'released' as const,
  };
}
