/**
 * Diagnose why Invite Test Guest app success may not appear in Kushki Payments.
 * Run: npx tsx scripts/check-invite-guest-kushki.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { env } from '../src/config/env.js';

const PHONE = '+56988777123';

function kushkiBase(): string {
  return env.KUSHKI_USE_UAT
    ? 'https://api-uat.kushkipagos.com'
    : 'https://api.kushkipagos.com';
}

async function kushkiGet(path: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${kushkiBase()}${path}`, {
    headers: {
      Accept: 'application/json',
      'Private-Merchant-Id': env.KUSHKI_PRIVATE_MERCHANT_ID,
    },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function summarizeTx(row: Record<string, unknown>) {
  return {
    ticket_number: row.ticket_number ?? row.ticketNumber ?? row.sale_ticket_number,
    amount:
      row.approved_transaction_amount ??
      row.request_amount ??
      row.approvedTransactionAmount,
    currency: row.currency_code ?? row.currencyCode,
    status: row.transaction_status ?? row.transactionStatus ?? row.response_text,
    last4: row.last_four_digits ?? row.lastFourDigits,
    created: row.created ?? row.created_at ?? row.transaction_date,
    type: row.transaction_type ?? row.sale_transaction_type,
    payment_method: row.payment_method,
  };
}

async function main() {
  console.log({
    kushki_uat: env.KUSHKI_USE_UAT,
    kushki_configured: Boolean(env.KUSHKI_PUBLIC_MERCHANT_ID && env.KUSHKI_PRIVATE_MERCHANT_ID),
    checkout_mock_payment: env.CHECKOUT_MOCK_PAYMENT,
    node_env: env.NODE_ENV,
    now: new Date().toISOString(),
  });

  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) throw new Error(`User ${PHONE} not found`);

  const orders = await prisma.ticketOrder.findMany({
    where: { buyerUserId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { event: { select: { title: true } } },
  });
  const cards = await prisma.userPaymentMethod.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  console.log(
    'orders',
    orders.map((order) => ({
      id: order.id,
      event: order.event.title,
      status: order.status,
      amount: order.totalAmount,
      currency: order.currency,
      paymentReference: order.paymentReference,
      createdAt: order.createdAt.toISOString(),
      looksMock: Boolean(
        order.paymentReference?.startsWith('mock_') ||
          order.paymentReference?.startsWith('kushki_mock_') ||
          order.paymentReference?.startsWith('kushki_tok_') ||
          order.paymentReference?.startsWith('pay_'),
      ),
    })),
  );

  console.log(
    'cards',
    cards.map((card) => ({
      brand: card.brand,
      lastFour: card.lastFour,
      gateway: card.gateway,
      tokenPrefix: card.providerToken.slice(0, 12),
      tokenLooksLive: !card.providerToken.startsWith('kushki_tok_'),
      createdAt: card.createdAt.toISOString(),
    })),
  );

  const ranges = [
    ['2026-08-12T00:00:00', '2026-08-20T23:59:59'],
    ['2025-08-12T00:00:00', '2025-08-20T23:59:59'],
  ] as const;

  for (const [from, to] of ranges) {
    const qs = new URLSearchParams({
      from,
      to,
      limit: '50',
      payment_method: 'card',
    });
    const v2 = await kushkiGet(`/analytics/v2/transactions-list?${qs.toString()}`);
    const v1 = await kushkiGet(`/analytics/v1/transactions-list?${qs.toString()}`);
    const v2Rows = Array.isArray((v2.body as { data?: unknown }).data)
      ? ((v2.body as { data: Record<string, unknown>[] }).data)
      : Array.isArray(v2.body)
        ? (v2.body as Record<string, unknown>[])
        : [];
    const v1Rows = Array.isArray((v1.body as { data?: unknown }).data)
      ? ((v1.body as { data: Record<string, unknown>[] }).data)
      : Array.isArray(v1.body)
        ? (v1.body as Record<string, unknown>[])
        : [];

    console.log(`kushki v2 ${from.slice(0, 10)}`, {
      http: v2.status,
      count: v2Rows.length,
      keys: v2.body && typeof v2.body === 'object' ? Object.keys(v2.body as object) : [],
      sample: v2Rows.slice(0, 8).map(summarizeTx),
      error:
        v2.status >= 400
          ? (v2.body as { message?: string; code?: string })
          : undefined,
    });
    console.log(`kushki v1 ${from.slice(0, 10)}`, {
      http: v1.status,
      count: v1Rows.length,
      keys: v1.body && typeof v1.body === 'object' ? Object.keys(v1.body as object) : [],
      sample: v1Rows.slice(0, 8).map(summarizeTx),
      error:
        v1.status >= 400
          ? (v1.body as { message?: string; code?: string })
          : undefined,
    });
  }

  const ticketNumbers = orders
    .map((order) => order.paymentReference)
    .filter((ref): ref is string => Boolean(ref && /^\d{10,}$/.test(ref)));

  for (const ticket of ticketNumbers) {
    const charge = await kushkiGet(`/card/v1/${ticket}`);
    console.log(`kushki charge lookup ${ticket}`, {
      http: charge.status,
      body: charge.body,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
