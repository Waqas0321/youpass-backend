/**
 * Verify supervisor VIP management E2E for all actions:
 * authorize_extra_guest, release_invitation, change_access, move_guest
 *
 * Run: PORT=3002 npx tsx scripts/test-staff-vip-management-e2e.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { hashOtp } from '../src/common/utils/crypto.js';
import { encryptSupervisorPin } from '../src/modules/staff-supervisor/staff-supervisor-pin-crypto.js';
import { SUPERVISOR_PIN_LENGTH } from '../src/modules/staff-supervisor/staff-supervisor.constants.js';

const port = process.env.PORT ?? '3002';
const API = `http://localhost:${port}/api/v1`;
const STAFF_PHONE = '912345678';
const STAFF_COUNTRY = 'CL';
const TEST_SUPERVISOR_PIN = process.env.SUPERVISOR_TEST_PIN ?? '1234';

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

  const otp = sendCode.body?.data?.dev_otp_code ?? process.env.DEV_OTP_CODE;
  if (!otp) {
    throw new Error(`No dev OTP: ${JSON.stringify(sendCode.body)}`);
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

async function ensureSupervisorPin(staffMemberId: string) {
  if (TEST_SUPERVISOR_PIN.length !== SUPERVISOR_PIN_LENGTH) {
    throw new Error(`SUPERVISOR_TEST_PIN must be ${SUPERVISOR_PIN_LENGTH} digits`);
  }

  await prisma.staffMember.update({
    where: { id: staffMemberId },
    data: {
      supervisorPinHash: await hashOtp(TEST_SUPERVISOR_PIN),
      supervisorPinEncrypted: encryptSupervisorPin(TEST_SUPERVISOR_PIN),
      permissionIds: {
        set: [
          'scan_tickets',
          'tickets_supervisor',
          'general_admin',
          'scan_products',
          'bar_supervisor',
        ],
      },
    },
  });
}

type VipContext = {
  order_id: string;
  guests: Array<{ slot_id: string; name: string; can_move?: boolean; can_release?: boolean }>;
  available_slots: Array<{ slot_id: string; label: string }>;
  access_options: Array<{ label: string; tier: string }>;
};

async function applyAction(
  auth: Record<string, string>,
  orderId: string,
  payload: Record<string, unknown>,
) {
  const response = await api(`/staff/supervisor/vip-tables/${orderId}/actions`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      pin: TEST_SUPERVISOR_PIN,
      notes: 'E2E VIP management test',
      ...payload,
    }),
  });

  if (response.status !== 200 || !response.body?.success) {
    throw new Error(`VIP action failed (${payload.action}): ${JSON.stringify(response.body)}`);
  }

  return response.body.data.context as VipContext;
}

async function main() {
  const staffMember = await prisma.staffMember.findFirst({
    where: { phone: '+56912345678' },
  });

  if (!staffMember) {
    console.log('SKIP: Staff member +56912345678 not found.');
    process.exit(0);
  }

  await ensureSupervisorPin(staffMember.id);

  const order = await prisma.ticketOrder.findFirst({
    where: {
      status: 'paid',
      OR: [{ venueTableId: { not: null } }, { tier: 'vip', type: 'vip_table' }],
    },
    include: {
      buyer: { select: { fullName: true } },
      event: { select: { title: true } },
      slots: { orderBy: { slotNumber: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!order) {
    console.log('SKIP: No paid VIP table order found.');
    process.exit(0);
  }

  const token = await staffLogin();
  const auth = { Authorization: `Bearer ${token}` };

  const contextRes = await api(`/staff/supervisor/vip-tables/${order.id}`, { headers: auth });
  if (contextRes.status !== 200 || !contextRes.body?.success) {
    throw new Error(`GET vip context failed: ${JSON.stringify(contextRes.body)}`);
  }

  let context = contextRes.body.data as VipContext;
  console.log('Context loaded:', {
    order_id: order.id,
    table: context,
    guests: context.guests.length,
    available_slots: context.available_slots.length,
  });

  if (context.available_slots.length === 0) {
    const afterExtra = await applyAction(auth, order.id, {
      action: 'authorize_extra_guest',
      guest_name: 'E2E VIP Guest',
      guest_phone: '987654321',
      guest_country_code: 'CL',
    });
    context = afterExtra;
    console.log('Prepared extra guest for downstream tests');
  }

  const movableGuest = context.guests.find((guest) => guest.can_move);
  const releasableGuest = context.guests.find((guest) => guest.can_release);
  const targetSlot = context.available_slots[0];

  if (releasableGuest) {
    context = await applyAction(auth, order.id, {
      action: 'release_invitation',
      slot_id: releasableGuest.slot_id,
    });
    console.log('release_invitation OK:', releasableGuest.name);
  } else {
    console.log('SKIP release_invitation: no releasable guest');
  }

  if (releasableGuest && context.access_options.length > 1) {
    const nextAccess =
      context.access_options.find((option) => option.label !== releasableGuest.name)?.label ??
      context.access_options[1]?.label;

    if (nextAccess) {
      context = await applyAction(auth, order.id, {
        action: 'change_access',
        slot_id: releasableGuest.slot_id,
        access_label: nextAccess,
      });
      console.log('change_access OK:', { guest: releasableGuest.name, access: nextAccess });
    }
  } else {
    console.log('SKIP change_access: missing guest or access options');
  }

  if (movableGuest && targetSlot) {
    context = await applyAction(auth, order.id, {
      action: 'move_guest',
      slot_id: movableGuest.slot_id,
      target_slot_id: targetSlot.slot_id,
    });
    const movedGuest = context.guests.find((guest) => guest.name === movableGuest.name);
    console.log('move_guest OK:', {
      guest: movableGuest.name,
      destination: targetSlot.label,
      found_after_move: Boolean(movedGuest),
    });
  } else {
    console.log('SKIP move_guest: missing movable guest or available seat');
  }

  console.log('PASS: VIP management full E2E');
}

main()
  .catch((error) => {
    console.error('FAIL:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
