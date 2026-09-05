/**
 * One-shot bootstrap for empty Atlas cluster: demo users + Test Bar staff.
 * Run: npx tsx scripts/bootstrap-new-cluster-users.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
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

async function ensureUser(data: {
  phone: string;
  countryCode: string;
  fullName: string;
  rutOrPassport: string;
  email: string;
}) {
  const existing = await prisma.user.findFirst({ where: { phone: data.phone } });
  if (existing) {
    console.log(`user exists ${data.phone} (${existing.fullName})`);
    return existing;
  }

  const user = await prisma.user.create({
    data: {
      phone: data.phone,
      countryCode: data.countryCode,
      preferredLanguage: data.countryCode === 'PK' ? 'en' : 'es',
      fullName: data.fullName,
      rutOrPassport: data.rutOrPassport,
      email: data.email,
      birthdate: new Date('1995-05-15'),
      gender: 'other',
      termsAcceptedAt: new Date(),
      category: 'bronze',
      accountStatus: 'active',
    },
  });

  console.log(`created user ${data.phone} (${data.fullName})`);
  return user;
}

async function ensureStaff() {
  const phone = '+56912345678';
  const pin = '1234';
  const permissionIds = STAFF_PERMISSIONS.map((permission) => permission.id);

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

  const role = await prisma.staffRole.findUniqueOrThrow({ where: { slug: 'bar' } });
  const zone = await prisma.staffZone.findUniqueOrThrow({
    where: { slug: 'barra_principal' },
  });

  let staff = await prisma.staffMember.findFirst({ where: { phone } });
  if (!staff) {
    staff = await prisma.staffMember.create({
      data: {
        name: 'Test Bar',
        phone,
        countryCode: 'CL',
        roleId: role.id,
        zoneId: zone.id,
        permissionIds,
        status: 'online',
        lastActivityAt: new Date(),
        supervisorPinHash: await hashOtp(pin),
        supervisorPinEncrypted: encryptSupervisorPin(pin),
      },
    });

    staff = await prisma.staffMember.update({
      where: { id: staff.id },
      data: {
        qrToken: generateStaffQrToken(),
        qrPayload: generateStaffQrPayload(staff.id),
      },
    });
    console.log(`created staff Test Bar ${phone}`);
  } else {
    staff = await prisma.staffMember.update({
      where: { id: staff.id },
      data: {
        name: 'Test Bar',
        permissionIds,
        supervisorPinHash: await hashOtp(pin),
        supervisorPinEncrypted: encryptSupervisorPin(pin),
        status: 'online',
      },
    });
    console.log(`updated staff Test Bar ${phone}`);
  }

  return staff;
}

async function main() {
  await ensureUser({
    phone: '+56912345670',
    countryCode: 'CL',
    fullName: 'Dev Tester',
    rutOrPassport: 'DEV-0001',
    email: 'dev.tester@youpass.test',
  });

  await ensureUser({
    phone: '+923205905162',
    countryCode: 'PK',
    fullName: 'Testa User',
    rutOrPassport: 'PK-TESTA-01',
    email: 'testa@youpass.test',
  });

  await ensureStaff();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
