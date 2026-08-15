/**
 * Grant all staff permissions to a staff member by phone (E.164).
 * Run: npx tsx scripts/grant-staff-all-permissions.ts [phone]
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { STAFF_PERMISSIONS } from '../src/modules/admin/admin-staff.constants.js';

const phone = process.argv[2]?.trim() || '+56912345678';
const allPermissionIds = STAFF_PERMISSIONS.map((permission) => permission.id);

async function main() {
  const member = await prisma.staffMember.findUnique({
    where: { phone },
    include: { role: true, zone: true },
  });

  if (!member) {
    console.error(`Staff member not found for phone ${phone}`);
    process.exit(1);
  }

  console.log('Staff:', member.name);
  console.log('Phone:', member.phone);
  console.log('Role:', member.role.label);
  console.log('Before:', member.permissionIds.join(', ') || '(none)');

  const updated = await prisma.staffMember.update({
    where: { phone },
    data: { permissionIds: allPermissionIds },
  });

  console.log('After:', updated.permissionIds.join(', '));
  console.log('Done — log out and back in on the staff app to refresh the session profile.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
