import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/database.js';
import { invitationsService } from '../src/modules/invitations/invitations.service.js';
import { producerInvitationsService } from '../src/modules/producer-invitations/producer-invitations.service.js';

const API = `http://localhost:${env.PORT}${env.API_PREFIX}`;

async function testClientServices() {
  const user = await prisma.user.findFirst({ where: { phone: '+56912345678' } });
  if (!user) {
    throw new Error('Test user not found');
  }

  const list = await invitationsService.listInvitations(user.id, user.phone, {
    filter: 'active',
  });
  console.log('service listInvitations', list.invitations.length, 'invitations');

  const invitationId = list.invitations[0]?.id;
  if (invitationId) {
    const detail = await invitationsService.getInvitationDetail(
      user.id,
      user.phone,
      invitationId,
    );
    const status = await invitationsService.getInvitationStatus(
      user.id,
      user.phone,
      invitationId,
    );
    console.log('service getInvitationDetail', detail.id, detail.lifecycle_state);
    console.log('service getInvitationStatus', status.lifecycle_state);
  }
}

async function getToken() {
  const user = await prisma.user.findFirst({
    where: { phone: '+56912345678' },
  });
  if (!user) {
    throw new Error('Test user not found');
  }
  return jwt.sign({ sub: user.id, phone: user.phone }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, init);
  const body = await response.json();
  return { status: response.status, body };
}

async function main() {
  await testClientServices();

  const token = await getToken();
  const producer = await prisma.producer.findFirst();
  if (!producer) {
    throw new Error('No producer in database');
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const list = await request('/users/me/invitations?filter=active', { headers });
  console.log('GET /users/me/invitations', list.status, list.body.success ? 'OK' : list.body);

  const invitationId = list.body.data?.invitations?.[0]?.id;
  if (invitationId) {
    const detail = await request(`/users/me/invitations/${invitationId}`, { headers });
    console.log('GET /users/me/invitations/:id', detail.status, detail.body.success ? 'OK' : detail.body);

    const status = await request(`/users/me/invitations/${invitationId}/status`, { headers });
    console.log('GET /users/me/invitations/:id/status', status.status, status.body.data?.lifecycle_state);
  }

  const producerHeaders = {
    'x-producer-id': producer.id,
    'Content-Type': 'application/json',
  };

  const stats = await request('/producer/invitations/stats', { headers: producerHeaders });
  console.log('GET /producer/invitations/stats', stats.status, stats.body.success ? 'OK' : stats.body);

  const alerts = await request('/producer/invitations/alerts', { headers: producerHeaders });
  console.log('GET /producer/invitations/alerts', alerts.status, alerts.body.success ? 'OK' : alerts.body);

  const freed = await request('/producer/invitations/freed-slots', { headers: producerHeaders });
  console.log('GET /producer/invitations/freed-slots', freed.status, freed.body.success ? 'OK' : freed.body);

  const releaseExpired = await request('/system/invitations/release-expired', {
    method: 'POST',
    headers: producerHeaders,
  });
  console.log('POST /system/invitations/release-expired', releaseExpired.status, releaseExpired.body.success ? 'OK' : releaseExpired.body);

  const reminders = await request('/system/invitations/send-reminders', {
    method: 'POST',
    headers: producerHeaders,
  });
  console.log('POST /system/invitations/send-reminders', reminders.status, reminders.body.success ? 'OK' : reminders.body);

  const charges = await request('/system/invitations/post-event-charges', {
    method: 'POST',
    headers: producerHeaders,
    body: JSON.stringify({}),
  });
  console.log('POST /system/invitations/post-event-charges', charges.status, charges.body.success ? 'OK' : charges.body);

  const producerList = await producerInvitationsService.listInvitations(producer.id, {
    page: 1,
    page_size: 5,
  });
  console.log('service producer list', producerList.invitations.length, 'rows');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
