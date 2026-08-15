/**
 * Verify staff drink scan E2E: first scan redeems, second scan returns already_used,
 * consumer orders list moves line to redeemed.
 *
 * Run: PORT=3002 npx tsx scripts/test-staff-drink-scan-e2e.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { eventDrinkOrdersService } from '../src/modules/event-drinks/event-drink-orders.service.js';

const port = process.env.PORT ?? '3002';
const API = `http://localhost:${port}/api/v1`;
const STAFF_PHONE = '912345678';
const STAFF_COUNTRY = 'CL';

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function staffLogin() {
  const sendCode = await api('/staff-auth/send-code', {
    method: 'POST',
    body: JSON.stringify({
      phone: STAFF_PHONE,
      country_code: STAFF_COUNTRY,
    }),
  });

  const otp =
    sendCode.body?.data?.dev_otp_code ??
    sendCode.body?.data?.code ??
    process.env.DEV_OTP_CODE;

  if (!otp) {
    throw new Error(`No dev OTP from send-code: ${JSON.stringify(sendCode.body)}`);
  }

  const login = await api('/staff-auth/login', {
    method: 'POST',
    body: JSON.stringify({
      phone: STAFF_PHONE,
      country_code: STAFF_COUNTRY,
      code: String(otp),
    }),
  });

  if (login.status !== 200 || !login.body?.success) {
    throw new Error(`Staff login failed: ${JSON.stringify(login.body)}`);
  }

  return login.body.data.access_token as string;
}

function lineState(
  orders: Awaited<ReturnType<typeof eventDrinkOrdersService.listForUser>>,
  qrPayload: string,
) {
  for (const order of orders.orders) {
    for (const line of order.line_items) {
      if (line.qr_payload === qrPayload) {
        return {
          product: line.product_name,
          qr_status: line.qr_status,
          redeemed_at: line.redeemed_at,
        };
      }
    }
  }
  return null;
}

async function main() {
  const redemption = await prisma.eventDrinkRedemption.findFirst({
    where: { validatedAt: null },
    include: {
      line: { select: { productName: true } },
      order: {
        select: {
          userId: true,
          user: { select: { fullName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!redemption) {
    console.log('SKIP: No unredeemed drink QR in database.');
    return;
  }

  const userId = redemption.order.userId;
  const qrPayload = redemption.qrPayload;

  console.log('Testing QR for:', redemption.line?.productName ?? 'Product');
  console.log('Guest:', redemption.order.user.fullName);
  console.log('QR payload prefix:', qrPayload.slice(0, 48) + '...');

  const before = await eventDrinkOrdersService.listForUser(userId);
  const beforeLine = lineState(before, qrPayload);
  console.log('Consumer BEFORE:', beforeLine);

  const token = await staffLogin();

  const firstScan = await api('/staff/scan/product', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ qr_payload: qrPayload }),
  });

  console.log('First staff scan:', firstScan.status, firstScan.body?.data?.outcome);

  const secondScan = await api('/staff/scan/product', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ qr_payload: qrPayload }),
  });

  console.log('Second staff scan:', secondScan.status, secondScan.body?.data?.outcome);

  const after = await eventDrinkOrdersService.listForUser(userId);
  const afterLine = lineState(after, qrPayload);
  console.log('Consumer AFTER:', afterLine);

  const staff = await prisma.staffMember.findUnique({
    where: { phone: '+56912345678' },
    select: { id: true },
  });

  const logCount = staff
    ? await prisma.staffScanLog.count({
        where: { staffMemberId: staff.id, scanType: 'product' },
      })
    : 0;

  console.log('Recent scans (API):', recent.body?.data?.scans?.length ?? 0);
  console.log('Recent scans (DB logs for staff):', logCount);

  const ok =
    firstScan.body?.data?.outcome === 'valid' &&
    secondScan.body?.data?.outcome === 'already_used' &&
    afterLine?.qr_status === 'redeemed' &&
    Boolean(afterLine?.redeemed_at) &&
    logCount >= 2;

  console.log(ok ? 'PASS: Drink scan E2E works.' : 'FAIL: Unexpected scan/list state.');
  if (!ok) {
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
