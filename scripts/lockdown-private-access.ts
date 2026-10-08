/**
 * Revoke all app sessions, retire public Play Review phones, and provision
 * private-access customer + staff accounts from current env.
 *
 * Run: npx tsx scripts/lockdown-private-access.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { hashOtp } from '../src/common/utils/crypto.js';
import { encryptSupervisorPin } from '../src/modules/staff-supervisor/staff-supervisor-pin-crypto.js';
import {
  STAFF_PERMISSIONS,
  DEFAULT_STAFF_ROLES,
  DEFAULT_STAFF_ZONES,
} from '../src/modules/admin/admin-staff.constants.js';
import {
  generateStaffQrToken,
  generateStaffQrPayload,
} from '../src/modules/staff/staff.utils.js';

const RETIRED_PHONES = ['+56911112222', '+56922223333'];

async function revokeAllSessions() {
  const now = new Date();
  const users = await prisma.userSession.updateMany({
    where: { revokedAt: null },
    data: { revokedAt: now },
  });
  const staff = await prisma.staffSession.updateMany({
    where: { revokedAt: null },
    data: { revokedAt: now },
  });
  return { users: users.count, staff: staff.count };
}

async function retirePublicReviewAccounts() {
  const users = await prisma.user.updateMany({
    where: { phone: { in: RETIRED_PHONES } },
    data: {
      accountStatus: 'deleted',
      deletionRequestedAt: new Date(),
      deletionScheduledAt: new Date(),
      fullName: 'REVOKED ACCESS',
    },
  });

  // StaffStatus has no inactive — burn credentials and move phones off the public numbers.
  const retiredStaff = await prisma.staffMember.findMany({
    where: { phone: { in: RETIRED_PHONES } },
    select: { id: true, phone: true },
  });
  for (const member of retiredStaff) {
    await prisma.staffMember.update({
      where: { id: member.id },
      data: {
        status: 'paused',
        name: 'REVOKED ACCESS',
        phone: `+5690000${member.id.slice(-6)}`,
        supervisorPinHash: null,
        supervisorPinEncrypted: null,
      },
    });
  }

  // Invalidate leftover OTP rows for retired review phones.
  const burned = await prisma.authCode.updateMany({
    where: { phone: { in: RETIRED_PHONES }, usedAt: null },
    data: { usedAt: new Date(), expiresAt: new Date(0) },
  });

  return { users: users.count, staff: retiredStaff.length, authCodes: burned.count };
}

async function ensureRolesAndZones() {
  for (const role of DEFAULT_STAFF_ROLES) {
    await prisma.staffRole.upsert({
      where: { slug: role.slug },
      create: { ...role, isSystem: true },
      update: {
        label: role.label,
        color: role.color,
        displayOrder: role.displayOrder,
      },
    });
  }
  for (const zone of DEFAULT_STAFF_ZONES) {
    await prisma.staffZone.upsert({
      where: { slug: zone.slug },
      create: zone,
      update: { label: zone.label, displayOrder: zone.displayOrder },
    });
  }
}

async function ensurePrivateCustomer(phone: string) {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        accountStatus: 'active',
        deletionRequestedAt: null,
        deletionScheduledAt: null,
        fullName: existing.fullName || 'Private Access',
      },
    });
  }

  return prisma.user.create({
    data: {
      phone,
      countryCode: 'CL',
      preferredLanguage: 'en',
      fullName: 'Private Access',
      rutOrPassport: 'PRIVATE-ACCESS-01',
      email: 'private.access@youpass.local',
      birthdate: new Date('1990-01-15'),
      gender: 'prefer_not_to_say',
      termsAcceptedAt: new Date(),
      category: 'bronze',
      accountStatus: 'active',
      profileCompletion: {
        create: {
          hasPhoto: false,
          hasInstagram: false,
          completionPercentage: 70,
        },
      },
    },
  });
}

async function ensurePrivateStaff(phone: string, pin: string) {
  await ensureRolesAndZones();
  const permissionIds = STAFF_PERMISSIONS.map((permission) => permission.id);
  const role = await prisma.staffRole.findUniqueOrThrow({ where: { slug: 'tickets' } });
  const zone = await prisma.staffZone.findUniqueOrThrow({
    where: { slug: 'acceso_general' },
  });
  const pinHash = await hashOtp(pin);
  const pinEncrypted = encryptSupervisorPin(pin);

  let staff = await prisma.staffMember.findFirst({ where: { phone } });
  if (!staff) {
    staff = await prisma.staffMember.create({
      data: {
        name: 'Private Staff Access',
        phone,
        countryCode: 'CL',
        roleId: role.id,
        zoneId: zone.id,
        permissionIds,
        status: 'online',
        lastActivityAt: new Date(),
        supervisorPinHash: pinHash,
        supervisorPinEncrypted: pinEncrypted,
      },
    });
    staff = await prisma.staffMember.update({
      where: { id: staff.id },
      data: {
        qrToken: generateStaffQrToken(),
        qrPayload: generateStaffQrPayload(staff.id),
      },
    });
  } else {
    staff = await prisma.staffMember.update({
      where: { id: staff.id },
      data: {
        name: 'Private Staff Access',
        countryCode: 'CL',
        roleId: role.id,
        zoneId: zone.id,
        permissionIds,
        status: 'online',
        lastActivityAt: new Date(),
        supervisorPinHash: pinHash,
        supervisorPinEncrypted: pinEncrypted,
      },
    });
  }
  return staff;
}

async function main() {
  const customerPhone = env.PLAY_REVIEW_PHONE;
  const staffPhone = env.PLAY_REVIEW_STAFF_PHONE;
  const otp = env.PLAY_REVIEW_OTP;
  const pin = env.PLAY_REVIEW_STAFF_PIN;
  const allowlist = env.AUTH_LOGIN_ALLOWLIST;

  if (!customerPhone || !staffPhone || !otp || !pin || !allowlist) {
    throw new Error(
      'Set PLAY_REVIEW_PHONE, PLAY_REVIEW_STAFF_PHONE, PLAY_REVIEW_OTP, PLAY_REVIEW_STAFF_PIN, and AUTH_LOGIN_ALLOWLIST in .env first.',
    );
  }

  const sessions = await revokeAllSessions();
  const retired = await retirePublicReviewAccounts();
  const customer = await ensurePrivateCustomer(customerPhone);
  const staff = await ensurePrivateStaff(staffPhone, pin);

  console.log('Private access lockdown complete.');
  console.log(`  Sessions revoked: users=${sessions.users} staff=${sessions.staff}`);
  console.log(
    `  Retired public review accounts: users=${retired.users} staff=${retired.staff} otp_rows=${retired.authCodes}`,
  );
  console.log(`  Private customer ready: ${customer.phone} (${customer.accountStatus})`);
  console.log(`  Private staff ready: ${staff.phone} (pin configured)`);
  console.log(`  Allowlist: ${allowlist}`);
  console.log('  Old OTP 123456 / phones +56911112222 / +56922223333 are no longer valid.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
