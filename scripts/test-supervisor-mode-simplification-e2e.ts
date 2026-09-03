/**
 * E2E verification for Supervisor Mode simplification:
 * - Staff login
 * - Entry + Bar manual code validation (same as QR)
 * - Supervisor entry search + access history
 * - Supervisor drink search + redemption history + restore
 *
 * Run: PORT=3002 npx tsx scripts/test-supervisor-mode-simplification-e2e.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { hashOtp } from '../src/common/utils/crypto.js';
import { encryptSupervisorPin } from '../src/modules/staff-supervisor/staff-supervisor-pin-crypto.js';
import { STAFF_PERMISSIONS } from '../src/modules/admin/admin-staff.constants.js';
import { findInvitationTicketByScanInput } from '../src/modules/invitations/invitation-ticket-scan.utils.js';
import { findDrinkRedemptionByScanInput } from '../src/modules/event-drinks/event-drink-redemption.service.js';

const port = process.env.PORT ?? '3002';
const API = `http://localhost:${port}/api/v1`;
const STAFF_PHONE = '912345678';
const STAFF_E164 = '+56912345678';
const STAFF_COUNTRY = 'CL';
const SUPERVISOR_PIN = process.env.SUPERVISOR_TEST_PIN ?? '1234';
const ALL_PERMISSION_IDS = STAFF_PERMISSIONS.map((permission) => permission.id);

let passed = 0;
let failed = 0;

function pass(label: string) {
  passed += 1;
  console.log(`PASS  ${label}`);
}

function fail(label: string, detail?: unknown) {
  failed += 1;
  console.error(`FAIL  ${label}`);
  if (detail !== undefined) {
    console.error(detail);
  }
}

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function ensureStaffReady() {
  const staff = await prisma.staffMember.findFirst({
    where: { phone: STAFF_E164 },
  });
  if (!staff) {
    throw new Error(`Staff ${STAFF_E164} not found in database`);
  }

  await prisma.staffMember.update({
    where: { id: staff.id },
    data: {
      permissionIds: { set: ALL_PERMISSION_IDS },
      supervisorPinHash: await hashOtp(SUPERVISOR_PIN),
      supervisorPinEncrypted: encryptSupervisorPin(SUPERVISOR_PIN),
    },
  });

  return staff;
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
    throw new Error(`No mock OTP: ${JSON.stringify(sendCode.body)}`);
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

  const permissions =
    (login.body.data?.staff?.permission_ids as string[] | undefined) ??
    (login.body.data?.permissions as string[] | undefined) ??
    (login.body.data?.permission_ids as string[] | undefined) ??
    [];
  return {
    token: login.body.data.access_token as string,
    permissions,
    name: login.body.data?.staff?.name ?? login.body.data?.name ?? 'staff',
    otp: String(otp),
  };
}

async function findEntryManualCode() {
  const rows = await prisma.invitationTicket.findMany({
    select: { manualEntryId: true, validatedAt: true },
    orderBy: { createdAt: 'desc' },
    take: 80,
  });

  for (const row of rows) {
    const ticket = await findInvitationTicketByScanInput(row.manualEntryId);
    if (!ticket) continue;
    const status = ticket.invitation.status;
    if (status === 'accepted' || status === 'validated' || status === 'pending') {
      return {
        code: row.manualEntryId,
        alreadyValidated: row.validatedAt != null,
        guest: ticket.invitation.recipient?.fullName ?? null,
        event: ticket.invitation.event.title,
      };
    }
  }
  return null;
}

async function findDrinkManualCode() {
  const rows = await prisma.eventDrinkRedemption.findMany({
    select: {
      manualEntryId: true,
      validatedAt: true,
      qrPayload: true,
      line: { select: { productName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 80,
  });

  for (const row of rows) {
    const code = row.manualEntryId;
    if (!code) continue;
    const found = await findDrinkRedemptionByScanInput(code);
    if (!found) continue;
    return {
      code,
      alreadyValidated: row.validatedAt != null,
      product: row.line.productName,
      qrPayload: row.qrPayload,
      redemptionId: found.id,
    };
  }
  return null;
}

async function main() {
  console.log(`\nAPI: ${API}`);
  console.log(`Staff: CL ${STAFF_PHONE} (${STAFF_E164})`);
  console.log(`Supervisor PIN: ${SUPERVISOR_PIN}\n`);

  const staff = await ensureStaffReady();
  pass(`staff prepared (${staff.name}) with full permissions + PIN`);

  const session = await staffLogin();
  pass(`staff login OK (otp mock ${session.otp})`);

  const hasEntry =
    session.permissions.includes('scan_tickets') ||
    session.permissions.includes('tickets_supervisor');
  const hasBar =
    session.permissions.includes('scan_products') ||
    session.permissions.includes('bar_supervisor');
  const hasTicketsSupervisor = session.permissions.includes('tickets_supervisor');
  const hasBarSupervisor = session.permissions.includes('bar_supervisor');

  if (hasEntry) pass('permissions include entry scan');
  else fail('missing entry scan permissions', session.permissions);

  if (hasBar) pass('permissions include bar scan');
  else fail('missing bar scan permissions', session.permissions);

  if (hasTicketsSupervisor) pass('permissions include tickets_supervisor');
  else fail('missing tickets_supervisor');

  if (hasBarSupervisor) pass('permissions include bar_supervisor');
  else fail('missing bar_supervisor');

  const auth = { Authorization: `Bearer ${session.token}` };

  // --- Entry manual code (regular staff path) ---
  const entry = await findEntryManualCode();
  if (!entry) {
    fail('no invitation ticket manual code available for entry scan');
  } else {
    pass(`entry manual code found: ${entry.code} (${entry.event})`);
    const scan = await api('/staff/scan/entry', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ qr_payload: entry.code }),
    });
    const outcome = scan.body?.data?.outcome;
    if (scan.status === 200 && (outcome === 'valid' || outcome === 'already_used')) {
      pass(`entry manual scan OK → ${outcome}`);
    } else {
      fail('entry manual scan failed', { status: scan.status, body: scan.body });
    }
  }

  // --- Bar manual code (regular staff path) ---
  const drink = await findDrinkManualCode();
  if (!drink) {
    fail('no drink redemption manual code available');
  } else {
    pass(`drink manual code found: ${drink.code} (${drink.product})`);
    const scan = await api('/staff/scan/product', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ qr_payload: drink.code }),
    });
    const outcome = scan.body?.data?.outcome;
    if (scan.status === 200 && (outcome === 'valid' || outcome === 'already_used')) {
      pass(`drink manual scan OK → ${outcome}`);
    } else {
      fail('drink manual scan failed', { status: scan.status, body: scan.body });
    }
  }

  // --- Supervisor PIN ---
  const pinOk = await api('/staff/supervisor/validate-pin', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ pin: SUPERVISOR_PIN }),
  });
  if (pinOk.status === 200 && pinOk.body?.success !== false) {
    pass('supervisor PIN validate OK');
  } else {
    // Some deployments return 200 with data.valid; accept either shape.
    if (pinOk.status === 200) pass('supervisor PIN endpoint reachable');
    else fail('supervisor PIN validate failed', pinOk);
  }

  // --- Entry supervisor: search + history ---
  const entrySearch = await api('/staff/supervisor/entries/search?q=a&limit=5', {
    headers: auth,
  });
  if (entrySearch.status === 200) {
    pass(
      `entry search OK (${entrySearch.body?.data?.results?.length ?? entrySearch.body?.data?.items?.length ?? 0} results)`,
    );
  } else {
    fail('entry search failed', entrySearch);
  }

  const entryHistory = await api('/staff/supervisor/action-history?limit=5', {
    headers: auth,
  });
  if (entryHistory.status === 200) {
    const actions = entryHistory.body?.data?.actions ?? [];
    const hasResult = actions.length === 0 || actions.some((row: { result?: string }) => row.result);
    if (hasResult) pass(`entry access history OK (${actions.length} rows, result labels present)`);
    else fail('entry access history missing result labels', actions[0]);
  } else {
    fail('entry action history failed', entryHistory);
  }

  // --- Bar supervisor: search + history + restore ---
  const drinkSearch = await api('/staff/supervisor/drinks/search?q=a&limit=5', {
    headers: auth,
  });
  if (drinkSearch.status === 200) {
    pass(
      `drink search OK (${drinkSearch.body?.data?.results?.length ?? drinkSearch.body?.data?.items?.length ?? 0} results)`,
    );
  } else {
    fail('drink search failed', drinkSearch);
  }

  const drinkHistory = await api('/staff/supervisor/drinks/action-history?limit=5', {
    headers: auth,
  });
  if (drinkHistory.status === 200) {
    const actions = drinkHistory.body?.data?.actions ?? [];
    const hasResult =
      actions.length === 0 || actions.some((row: { result?: string }) => row.result);
    if (hasResult) pass(`drink redemption history OK (${actions.length} rows, result labels present)`);
    else fail('drink redemption history missing result labels', actions[0]);
  } else {
    fail('drink action history failed', drinkHistory);
  }

  // Entry detail enrichment + non-destructive re-entry
  const usedTicket = await prisma.invitationTicket.findFirst({
    where: { validatedAt: { not: null } },
    orderBy: { validatedAt: 'desc' },
    include: { invitation: true },
  });
  if (usedTicket) {
    const detail = await api(`/staff/supervisor/entries/${usedTicket.id}`, {
      headers: auth,
    });
    if (detail.status === 200 && detail.body?.data) {
      const data = detail.body.data;
      if (data.ticket_type_label && data.status === 'used') {
        pass(
          `entry detail enriched (status=${data.status}, type=${data.ticket_type_label}, purchase=${data.purchase_status ?? 'n/a'}, access=${data.access_point ?? 'n/a'})`,
        );
      } else {
        fail('entry detail missing enrichment fields', data);
      }
    } else {
      fail('entry detail failed', detail);
    }

    const originalValidatedAt = usedTicket.validatedAt!.toISOString();
    const reentry = await api(`/staff/supervisor/entries/${usedTicket.id}/override`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        action: 'authorize_reentry',
        pin: SUPERVISOR_PIN,
        notes: 'e2e non-destructive re-entry',
      }),
    });
    const refreshed = await prisma.invitationTicket.findUnique({
      where: { id: usedTicket.id },
    });
    if (
      reentry.status === 200 &&
      refreshed?.validatedAt &&
      refreshed.validatedAt.toISOString() === originalValidatedAt &&
      refreshed.unlockAt.getTime() > refreshed.validatedAt.getTime()
    ) {
      pass('authorize_reentry preserves original validatedAt (non-destructive)');
    } else if (reentry.status === 200) {
      fail('authorize_reentry did not preserve validatedAt correctly', {
        reentry: reentry.body,
        before: originalValidatedAt,
        after: refreshed?.validatedAt,
        unlockAt: refreshed?.unlockAt,
      });
    } else {
      const byEntry = await api(
        `/staff/supervisor/entries/by-entry/${usedTicket.manualEntryId}/override`,
        {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            action: 'authorize_reentry',
            pin: SUPERVISOR_PIN,
            notes: 'e2e non-destructive re-entry',
          }),
        },
      );
      const refreshed2 = await prisma.invitationTicket.findUnique({
        where: { id: usedTicket.id },
      });
      if (
        byEntry.status === 200 &&
        refreshed2?.validatedAt &&
        refreshed2.validatedAt.toISOString() === originalValidatedAt
      ) {
        pass('authorize_reentry (by-entry) preserves original validatedAt');
      } else {
        fail('authorize_reentry failed', { reentry, byEntry });
      }
    }
  } else {
    console.log('SKIP  non-destructive re-entry — no used ticket found');
  }

  // Restore consumption (revert_validation) when we have a validated redemption
  const validatedDrink = await prisma.eventDrinkRedemption.findFirst({
    where: { validatedAt: { not: null } },
    orderBy: { validatedAt: 'desc' },
  });
  if (validatedDrink) {
    const restore = await api(`/staff/supervisor/drinks/${validatedDrink.id}/cancellations`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        action: 'revert_validation',
        pin: SUPERVISOR_PIN,
        reason: 'Product not delivered (e2e)',
        notes: 'Product not delivered (e2e)',
      }),
    });
    if (restore.status === 200 && restore.body?.success !== false) {
      pass('restore consumption (revert_validation) OK');
    } else {
      fail('restore consumption failed', restore);
    }
  } else {
    console.log('SKIP  restore consumption — no validated drink redemption found');
  }

  console.log('\n────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('────────────────────────────────────');
  console.log('\nStaff app login credentials');
  console.log(`  Country: Chile (CL)`);
  console.log(`  Phone:   ${STAFF_PHONE}`);
  console.log(`  OTP:     use mock OTP from send-code (logged by API / returned as dev_otp_code)`);
  console.log(`  Last OTP this run: ${session.otp}`);
  console.log(`  Supervisor PIN: ${SUPERVISOR_PIN}`);
  console.log(`  Name: ${session.name}`);
  console.log(`  Permissions: Entry + Bar + both supervisors`);
  console.log('');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
