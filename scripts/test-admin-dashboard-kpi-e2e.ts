/**
 * E2E: verify dashboard KPI cards increase after new ticket + drink orders.
 *
 * Uses GET /admin/events/:id/dashboard (same API as the admin UI).
 * Inserts paid orders via DB (simulates completed purchases), then cleans up.
 *
 * Run:
 *   PORT=3002 npx tsx scripts/test-admin-dashboard-kpi-e2e.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';

const port = process.env.PORT ?? '3002';
const API = `http://localhost:${port}/api/v1`;
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key';
const TEST_PREFIX = 'E2E_KPI_';

type Kpis = {
  tickets_sold: { value: number };
  total_revenue: { value: number };
  bar_consumption: { value: number };
  active_users: { value: number };
};

const cleanupIds: {
  userId?: string;
  ticketOrderId?: string;
  drinkOrderId?: string;
} = {};

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchDashboardKpis(eventId: string): Promise<Kpis> {
  const response = await fetch(`${API}/admin/events/${eventId}/dashboard`, {
    headers: {
      'x-admin-api-key': ADMIN_KEY,
      'Content-Type': 'application/json',
    },
  });
  const body = (await response.json()) as {
    success?: boolean;
    data?: { kpis: Kpis; currency: string };
    error?: string;
  };
  assert(response.ok && body.success === true, `Dashboard API failed: ${response.status} ${JSON.stringify(body)}`);
  return body.data!.kpis;
}

function catalogTypeFromOffering(
  offeringType: string,
): 'general' | 'vip' | 'discounted' | 'courtesy' | 'free' | 'vip_table' {
  if (offeringType === 'vip_general') return 'vip';
  if (offeringType.startsWith('preventa') || offeringType === 'early_bird') return 'discounted';
  return 'general';
}

async function main(): Promise<void> {
  console.log('=== Dashboard KPI E2E (API) ===\n');

  const event = await prisma.event.findFirst({
    where: { title: { contains: 'Lahore', mode: 'insensitive' } },
    select: { id: true, title: true, currencyCode: true, countryCode: true },
  });
  assert(Boolean(event), 'Lahore Beats Festival event not found');
  const eventId = event!.id;
  console.log(`Event: ${event!.title} (${eventId})\n`);

  const offering = await prisma.eventTicketOffering.findFirst({
    where: { eventId, status: 'active' },
    orderBy: { displayOrder: 'asc' },
    select: { id: true, name: true, price: true, type: true },
  });
  assert(Boolean(offering), 'No active ticket offering for event');

  const drinkProduct = await prisma.eventDrinkProduct.findFirst({
    where: { eventId, status: 'available' },
    select: { id: true, name: true, priceClp: true },
  });
  assert(Boolean(drinkProduct), 'No active drink product for event');

  const before = await fetchDashboardKpis(eventId);
  console.log('BEFORE (dashboard API):');
  console.log(`  Tickets sold:     ${before.tickets_sold.value}`);
  console.log(`  Total revenue:    ${before.total_revenue.value}`);
  console.log(`  Bar consumption: ${before.bar_consumption.value}`);
  console.log(`  Active users:     ${before.active_users.value}\n`);

  const ticketQty = 2;
  const ticketUnitPrice = offering!.price;
  const ticketSubtotal = ticketUnitPrice * ticketQty;
  const ticketServiceFee = Math.round(ticketSubtotal * 0.05);
  const ticketTotal = ticketSubtotal + ticketServiceFee;

  const drinkQty = 3;
  const drinkLineTotal = drinkProduct!.priceClp * drinkQty;
  const drinkServiceFee = 0;
  const drinkTotal = drinkLineTotal + drinkServiceFee;

  const uniqueSuffix = Date.now();
  const testUser = await prisma.user.create({
    data: {
      phone: `+9230099${String(uniqueSuffix).slice(-5)}`,
      countryCode: 'PK',
      fullName: `${TEST_PREFIX}Buyer`,
      email: `${TEST_PREFIX}${uniqueSuffix}@youpass.test`,
      rutOrPassport: `${TEST_PREFIX}${uniqueSuffix}`,
      birthdate: new Date('1995-01-15'),
      gender: 'other',
      accountStatus: 'active',
      termsAcceptedAt: new Date(),
    },
  });
  cleanupIds.userId = testUser.id;

  const ticketOrder = await prisma.ticketOrder.create({
    data: {
      buyerUserId: testUser.id,
      eventId,
      quantity: ticketQty,
      tier: 'general',
      type: catalogTypeFromOffering(offering!.type),
      unitPrice: ticketUnitPrice,
      subtotalAmount: ticketSubtotal,
      serviceFeeRate: 0.05,
      serviceFeeAmount: ticketServiceFee,
      totalAmount: ticketTotal,
      currency: event!.currencyCode ?? 'PKR',
      status: 'paid',
      ticketOfferingId: offering!.id,
      paymentReference: `${TEST_PREFIX}ticket_${uniqueSuffix}`,
      createdAt: new Date(),
    },
  });
  cleanupIds.ticketOrderId = ticketOrder.id;

  const drinkOrder = await prisma.eventDrinkOrder.create({
    data: {
      userId: testUser.id,
      eventId,
      subtotalClp: drinkLineTotal,
      serviceFeeClp: drinkServiceFee,
      totalClp: drinkTotal,
      currency: event!.currencyCode ?? 'PKR',
      itemCount: drinkQty,
      status: 'confirmed',
      createdAt: new Date(),
      lines: {
        create: [
          {
            productId: drinkProduct!.id,
            productName: drinkProduct!.name,
            quantity: drinkQty,
            unitPriceClp: drinkProduct!.priceClp,
            lineTotalClp: drinkLineTotal,
          },
        ],
      },
    },
  });
  cleanupIds.drinkOrderId = drinkOrder.id;

  console.log('INSERTED test orders:');
  console.log(`  + Ticket: ${ticketQty} x ${offering!.name} = ${ticketTotal} ${event!.currencyCode}`);
  console.log(`  + Drinks: ${drinkQty} x ${drinkProduct!.name} = ${drinkTotal} ${event!.currencyCode}`);
  console.log(`  + New user: ${testUser.fullName}\n`);

  const after = await fetchDashboardKpis(eventId);
  console.log('AFTER (dashboard API):');
  console.log(`  Tickets sold:     ${after.tickets_sold.value}`);
  console.log(`  Total revenue:    ${after.total_revenue.value}`);
  console.log(`  Bar consumption: ${after.bar_consumption.value}`);
  console.log(`  Active users:     ${after.active_users.value}\n`);

  const expectedTicketDelta = ticketQty;
  const expectedRevenueDelta = Math.round(ticketTotal + drinkTotal);
  const expectedBarDelta = drinkQty;
  const expectedUsersDelta = 1;

  const ticketDelta = after.tickets_sold.value - before.tickets_sold.value;
  const revenueDelta = after.total_revenue.value - before.total_revenue.value;
  const barDelta = after.bar_consumption.value - before.bar_consumption.value;
  const usersDelta = after.active_users.value - before.active_users.value;

  console.log('DELTAS:');
  console.log(`  Tickets sold:     +${ticketDelta} (expected +${expectedTicketDelta})`);
  console.log(`  Total revenue:    +${revenueDelta} (expected +${expectedRevenueDelta})`);
  console.log(`  Bar consumption: +${barDelta} (expected +${expectedBarDelta})`);
  console.log(`  Active users:     +${usersDelta} (expected +${expectedUsersDelta})\n`);

  assert(ticketDelta === expectedTicketDelta, `Tickets sold did not increase by ${expectedTicketDelta}`);
  assert(revenueDelta === expectedRevenueDelta, `Revenue did not increase by ${expectedRevenueDelta}`);
  assert(barDelta === expectedBarDelta, `Bar consumption did not increase by ${expectedBarDelta}`);
  assert(usersDelta === expectedUsersDelta, `Active users did not increase by ${expectedUsersDelta}`);

  console.log('✓ All 4 KPI cards increased correctly via dashboard API.\n');
}

async function cleanup(): Promise<void> {
  if (cleanupIds.drinkOrderId) {
    await prisma.eventDrinkOrderLine.deleteMany({ where: { orderId: cleanupIds.drinkOrderId } });
    await prisma.eventDrinkOrder.deleteMany({ where: { id: cleanupIds.drinkOrderId } });
  }
  if (cleanupIds.ticketOrderId) {
    await prisma.ticketOrder.deleteMany({ where: { id: cleanupIds.ticketOrderId } });
  }
  if (cleanupIds.userId) {
    await prisma.user.deleteMany({ where: { id: cleanupIds.userId } });
  }
}

main()
  .catch((err) => {
    console.error('FAILED:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (cleanupIds.ticketOrderId || cleanupIds.drinkOrderId || cleanupIds.userId) {
        await cleanup();
        console.log('Cleaned up test data (orders + user). Dashboard KPIs restored.');
      }
    } catch (err) {
      console.error('Cleanup failed:', err);
    } finally {
      await prisma.$disconnect();
    }
  });
