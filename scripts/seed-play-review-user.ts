/**
 * Ensure Google Play review customer + staff accounts exist.
 * Run: npm run db:seed:play-review
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

async function ensureCustomer() {
  const phone = env.PLAY_REVIEW_PHONE;
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        accountStatus: 'active',
        deletionRequestedAt: null,
        deletionScheduledAt: null,
        fullName: existing.fullName || 'Google Play Reviewer',
        email: existing.email || 'play.review@youpass.test',
      },
    });
  }

  return prisma.user.create({
    data: {
      phone,
      countryCode: 'CL',
      preferredLanguage: 'en',
      fullName: 'Google Play Reviewer',
      rutOrPassport: 'PLAY-REVIEW-01',
      email: 'play.review@youpass.test',
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

async function ensureStaffRolesAndZones() {
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

async function ensureStaff() {
  await ensureStaffRolesAndZones();

  const phone = env.PLAY_REVIEW_STAFF_PHONE;
  const pin = env.PLAY_REVIEW_STAFF_PIN || '1234';
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
        name: 'Google Play Staff Reviewer',
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
        name: 'Google Play Staff Reviewer',
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

  return { staff, pin };
}

async function main() {
  const otp = env.PLAY_REVIEW_OTP;
  if (!env.PLAY_REVIEW_PHONE || !env.PLAY_REVIEW_STAFF_PHONE || !otp) {
    throw new Error(
      'Set PLAY_REVIEW_PHONE, PLAY_REVIEW_STAFF_PHONE, and PLAY_REVIEW_OTP in the environment.',
    );
  }

  const customer = await ensureCustomer();
  const { staff, pin } = await ensureStaff();

  console.log('Private / review login accounts ready.\n');
  console.log('=== Customer (User account) ===');
  console.log(`  Phone: ${customer.phone}`);
  console.log(`  Access code (OTP): ${otp}`);
  console.log(`  Name: ${customer.fullName}`);
  console.log('');
  console.log('=== Staff account ===');
  console.log(`  Phone: ${staff.phone}`);
  console.log(`  Access code (OTP): ${otp}`);
  console.log(`  Supervisor PIN: ${pin}`);
  console.log(`  Name: ${staff.name}`);
  console.log(`  Permissions: ${staff.permissionIds.join(', ')}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
