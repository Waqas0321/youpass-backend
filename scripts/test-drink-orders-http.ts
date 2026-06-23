import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/database.js';

const API = `http://localhost:${env.PORT}${env.API_PREFIX}`;

async function main() {
  const user = await prisma.user.findFirst({
    where: { phone: '+923205905162' },
  });
  if (!user) {
    throw new Error('TestA user not found');
  }

  const token = jwt.sign({ sub: user.id, phone: user.phone }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  const orderId = '5f04962a67a8ebcb1637bf49';
  const urls = [
    `${API}/users/me/drink-orders`,
    `${API}/users/me/drink-orders/${orderId}`,
  ];

  for (const url of urls) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await response.text();
    console.log(url, response.status, text.slice(0, 200));
  }
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());
