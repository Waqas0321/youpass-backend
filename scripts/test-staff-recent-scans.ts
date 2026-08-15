import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { staffScanService } from '../src/modules/staff-scan/staff-scan.service.js';

async function main() {
  const staff = await prisma.staffMember.findUniqueOrThrow({
    where: { phone: '+56912345678' },
  });

  try {
    const result = await staffScanService.listRecentScans(staff, 'product', 10);
    console.log('OK scans:', result.scans.length);
    console.log(JSON.stringify(result.scans.slice(0, 2), null, 2));
  } catch (error) {
    console.error('FAILED:', error);
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
