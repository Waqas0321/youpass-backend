/**
 * Admin producers CRUD + event promoter linkage.
 * Run: npx tsx scripts/test-admin-producers.ts
 */
import 'dotenv/config';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/database.js';

const BASE = `http://localhost:${env.PORT}${env.API_PREFIX}`;
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key';

type StepResult = { name: string; ok: boolean; detail: string };

const results: StepResult[] = [];
let createdProducerId = '';
let createdEventId = '';
const testProducerName = `E2E Promoter ${Date.now()}`;

function pass(name: string, detail = 'OK') {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail !== 'OK' ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.log(`  ✗ ${name} — ${detail}`);
}

async function adminRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': ADMIN_KEY,
      'x-admin-api-key': ADMIN_KEY,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function main() {
  console.log('=== Admin producers test ===');
  console.log(`API: ${BASE}`);

  const listBefore = await adminRequest('/admin/producers');
  if (listBefore.status === 200 && listBefore.body?.success) {
    pass('GET /admin/producers');
  } else {
    fail('GET /admin/producers', JSON.stringify(listBefore.body));
    return summarize();
  }

  const create = await adminRequest('/admin/producers', {
    method: 'POST',
    body: JSON.stringify({
      name: testProducerName,
      type_label: 'Event producer',
      description: 'Created by test-admin-producers.ts',
      coverage_label: 'Events across Chile',
      logo_url: null,
    }),
  });

  if (create.status === 201 && create.body?.data?.id) {
    createdProducerId = create.body.data.id;
    pass('POST /admin/producers', `id=${createdProducerId}`);
  } else {
    fail('POST /admin/producers', JSON.stringify(create.body));
    return summarize();
  }

  const listAfterCreate = await adminRequest('/admin/producers');
  const foundAfterCreate = listAfterCreate.body?.data?.producers?.some(
    (producer: { id: string }) => producer.id === createdProducerId,
  );
  if (foundAfterCreate) {
    pass('Producer appears in list after create');
  } else {
    fail('Producer appears in list after create', 'not found');
  }

  const duplicate = await adminRequest('/admin/producers', {
    method: 'POST',
    body: JSON.stringify({ name: testProducerName }),
  });
  if (duplicate.status === 409) {
    pass('Duplicate producer name rejected');
  } else {
    fail('Duplicate producer name rejected', `status=${duplicate.status}`);
  }

  const updatedName = `${testProducerName} Updated`;
  const update = await adminRequest(`/admin/producers/${createdProducerId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: updatedName,
      coverage_label: 'Santiago · Valparaíso',
    }),
  });
  if (update.status === 200 && update.body?.data?.name === updatedName) {
    pass('PATCH /admin/producers/:id');
  } else {
    fail('PATCH /admin/producers/:id', JSON.stringify(update.body));
  }

  if (update.body?.data?.type_label === 'Event producer') {
    pass('Producer type_label returned from API');
  } else {
    fail('Producer type_label returned from API', JSON.stringify(update.body?.data?.type_label));
  }

  const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const createEvent = await adminRequest('/admin/events', {
    method: 'POST',
    body: JSON.stringify({
      title: `Producer Link Test ${Date.now()}`,
      starts_at: startsAt,
      venue_name: 'Test Venue',
      city: 'Santiago',
      country_code: 'CL',
      event_type: 'parties',
      status: 'draft',
      producer_name: updatedName,
    }),
  });

  if (createEvent.status === 201 && createEvent.body?.data?.id) {
    createdEventId = createEvent.body.data.id;
    pass('POST /admin/events with promoter name', `event=${createdEventId}`);
  } else {
    fail('POST /admin/events with promoter name', JSON.stringify(createEvent.body));
  }

  const listEvents = await adminRequest('/admin/events');
  const linkedEvent = listEvents.body?.data?.events?.find(
    (event: { id: string }) => event.id === createdEventId,
  );
  if (linkedEvent?.producer_name === updatedName) {
    pass('Event list shows assigned promoter');
  } else {
    fail(
      'Event list shows assigned promoter',
      `expected=${updatedName} got=${linkedEvent?.producer_name ?? 'missing'}`,
    );
  }

  await summarize();
}

async function summarize() {
  if (createdEventId) {
    await adminRequest(`/admin/events/${createdEventId}`, { method: 'DELETE' });
    console.log(`\nCleanup: deleted test event ${createdEventId}`);
  }

  if (createdProducerId) {
    await prisma.producer.delete({ where: { id: createdProducerId } }).catch(() => undefined);
    console.log(`Cleanup: deleted test producer ${createdProducerId}`);
  }

  const failed = results.filter((item) => !item.ok).length;
  console.log(`\n=== RESULT: ${failed === 0 ? 'PASS' : 'FAIL'} (${results.length - failed}/${results.length}) ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
