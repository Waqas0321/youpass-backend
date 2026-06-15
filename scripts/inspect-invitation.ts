import { prisma } from '../src/config/database.js';

const id = process.argv[2] ?? '6a2e2cdcb9a264690b7bf860';

async function main() {
  const inv = await prisma.invitation.findUnique({
    where: { id },
    include: { ticket: true },
  });
  console.log(JSON.stringify(inv, null, 2));
  await prisma.$disconnect();
}

main();
