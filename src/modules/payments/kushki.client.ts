import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';

export type KushkiAmount = {
  subtotalIva: number;
  subtotalIva0: number;
  iva: number;
  ice?: number;
  currency: string;
};

export type KushkiChargeResult = {
  ticketNumber: string;
  transactionReference: string;
  details?: Record<string, unknown>;
};

export type KushkiSubscriptionResult = {
  subscriptionId: string;
  details?: Record<string, unknown>;
};

function kushkiBaseUrl(): string {
  return env.KUSHKI_USE_UAT
    ? 'https://api-uat.kushkipagos.com'
    : 'https://api.kushkipagos.com';
}

export function isKushkiConfigured(): boolean {
  return Boolean(env.KUSHKI_PUBLIC_MERCHANT_ID && env.KUSHKI_PRIVATE_MERCHANT_ID);
}

export function isKushkiPublicConfigured(): boolean {
  return Boolean(env.KUSHKI_PUBLIC_MERCHANT_ID);
}

/** Seed/mock wallet tokens cannot be charged; live Kushki subscription ids can. */
export function isKushkiSavedTokenChargeable(token: string | null | undefined): boolean {
  const value = token?.trim() ?? '';
  return value.length > 0 && !value.startsWith('kushki_tok_');
}

export function buildKushkiAmount(total: number, currency: string): KushkiAmount {
  const normalized = currency.toUpperCase() === 'CLP' ? Math.round(total) : total;
  return {
    subtotalIva: 0,
    subtotalIva0: normalized,
    iva: 0,
    ice: 0,
    currency: currency.toUpperCase(),
  };
}

async function kushkiRequest<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  if (!env.KUSHKI_PRIVATE_MERCHANT_ID) {
    throw new AppError(
      503,
      'KUSHKI_NOT_CONFIGURED',
      'Kushki private merchant id is not configured',
    );
  }

  const response = await fetch(`${kushkiBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Private-Merchant-Id': env.KUSHKI_PRIVATE_MERCHANT_ID,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : typeof payload.code === 'string'
          ? payload.code
          : 'Kushki request failed';
    throw new AppError(502, 'KUSHKI_REQUEST_FAILED', message);
  }

  return payload as T;
}

function kushkiNested(result: Record<string, unknown>): Record<string, unknown> {
  return result.details && typeof result.details === 'object'
    ? (result.details as Record<string, unknown>)
    : {};
}

function kushkiRef(result: Record<string, unknown>): string {
  const nested = kushkiNested(result);
  const value =
    result.ticketNumber ??
    result.transactionReference ??
    result.transactionId ??
    nested.ticketNumber ??
    nested.transactionReference ??
    nested.transactionId ??
    '';
  return String(value);
}

function assertKushkiApproved(result: Record<string, unknown>): void {
  const nested = kushkiNested(result);
  const status = String(result.transactionStatus ?? nested.transactionStatus ?? '').toUpperCase();
  const code = String(result.responseCode ?? nested.responseCode ?? '');
  if ((status && status !== 'APPROVAL' && status !== 'APPROVED') || (code && code !== '000')) {
    const message =
      (typeof result.responseText === 'string' && result.responseText) ||
      (typeof nested.responseText === 'string' && nested.responseText) ||
      (typeof result.message === 'string' && result.message) ||
      'Kushki payment was not approved';
    throw new AppError(402, 'KUSHKI_DECLINED', message);
  }
}

/** One-step card charge using a short-lived card token from Kushki.js. */
export async function chargeKushkiCardToken(input: {
  token: string;
  amount: number;
  currency: string;
  orderId: string;
  email?: string;
  fullName?: string;
}): Promise<KushkiChargeResult> {
  const amount = buildKushkiAmount(input.amount, input.currency);
  const result = await kushkiRequest<Record<string, unknown>>('/card/v1/charges', {
    token: input.token,
    amount,
    metadata: { order_id: input.orderId },
    contactDetails: {
      email: input.email ?? 'payments@youpass.app',
      firstName: input.fullName?.split(/\s+/)[0] ?? 'YouPass',
      lastName: input.fullName?.split(/\s+/).slice(1).join(' ') || 'Customer',
    },
    fullResponse: true,
  });

  assertKushkiApproved(result);
  const ticketNumber = kushkiRef(result);
  if (!ticketNumber) {
    throw new AppError(502, 'KUSHKI_CHARGE_INVALID', 'Kushki charge returned no ticket number');
  }

  return {
    ticketNumber,
    transactionReference: String(result.transactionReference ?? ticketNumber),
    details: result,
  };
}

/** Persist a card for recurring / one-click charges (stores subscription id). */
export async function createKushkiSubscription(input: {
  token: string;
  amount?: number;
  currency: string;
  email?: string;
  fullName?: string;
  planName?: string;
}): Promise<KushkiSubscriptionResult> {
  const amount = buildKushkiAmount(input.amount ?? 0, input.currency);
  const result = await kushkiRequest<Record<string, unknown>>('/subscriptions/v1/card', {
    token: input.token,
    amount,
    planName: input.planName ?? 'YouPass wallet card',
    periodicity: 'custom',
    contactDetails: {
      email: input.email ?? 'payments@youpass.app',
      firstName: input.fullName?.split(/\s+/)[0] ?? 'YouPass',
      lastName: input.fullName?.split(/\s+/).slice(1).join(' ') || 'Customer',
      phoneNumber: '+56000000000',
    },
    startDate: new Date().toISOString().slice(0, 10),
    metadata: { source: 'youpass_wallet' },
  });

  const subscriptionId = String(
    result.subscriptionId ?? result.id ?? result.transactionReference ?? '',
  );
  if (!subscriptionId) {
    throw new AppError(
      502,
      'KUSHKI_SUBSCRIPTION_INVALID',
      'Kushki subscription returned no subscription id',
    );
  }

  return { subscriptionId, details: result };
}

/** Charge a previously saved Kushki subscription (one-click). */
export async function chargeKushkiSubscription(input: {
  subscriptionId: string;
  amount: number;
  currency: string;
  orderId: string;
}): Promise<KushkiChargeResult> {
  const amount = buildKushkiAmount(input.amount, input.currency);
  const result = await kushkiRequest<Record<string, unknown>>(
    `/subscriptions/v1/card/${encodeURIComponent(input.subscriptionId)}`,
    {
      amount,
      metadata: { order_id: input.orderId },
      fullResponse: true,
    },
  );

  assertKushkiApproved(result);
  const ticketNumber = kushkiRef(result);
  if (!ticketNumber) {
    throw new AppError(
      502,
      'KUSHKI_SUBSCRIPTION_CHARGE_INVALID',
      'Kushki subscription charge returned no ticket number',
    );
  }

  return {
    ticketNumber,
    transactionReference: String(result.transactionReference ?? ticketNumber),
    details: result,
  };
}
