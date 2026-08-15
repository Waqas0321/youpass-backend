/**
 * E2E: admin event ticket offerings actions
 * Usage: npx tsx scripts/test-admin-event-tickets-e2e.ts
 */
const API = process.env.API_BASE ?? 'http://localhost:3002/api/v1';
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key';

async function request<T>(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-admin-api-key': ADMIN_KEY,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json();
  return { status: res.status, body };
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const eventsRes = await request<{ success: boolean; data: { events: Array<{ id: string; title: string }> } }>(
    '/admin/events',
  );
  const event = eventsRes.body.data.events.find((item) => item.title.includes('URBAN NIGHT')) ??
    eventsRes.body.data.events[0];
  assert(event, 'no event');
  const eventId = event.id;

  const listRes = await request<{ success: boolean; data: { offerings: Array<{ offering_id: string; name: string; status: string; currency: string }> } }>(
    `/admin/events/${eventId}/ticket-offerings`,
  );
  assert(listRes.body.success, 'list failed');
  const offering = listRes.body.data.offerings[0];
  assert(offering, 'no offerings');

  const offeringId = offering.offering_id;
  const originalStatus = offering.status;

  const pause = await request(`/admin/events/${eventId}/ticket-offerings/${offeringId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'paused' }),
  });
  assert(pause.status === 200 && pause.body.data.status === 'paused', 'pause failed');

  const resume = await request(`/admin/events/${eventId}/ticket-offerings/${offeringId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'active' }),
  });
  assert(resume.status === 200 && resume.body.data.status === 'active', 'resume failed');

  const hide = await request(`/admin/events/${eventId}/ticket-offerings/${offeringId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'closed' }),
  });
  assert(hide.status === 200 && hide.body.data.status === 'closed', 'hide failed');

  await request(`/admin/events/${eventId}/ticket-offerings/${offeringId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: originalStatus }),
  });

  assert(offering.currency, 'currency should be returned');
  console.log('All admin event ticket checks passed for', offering.name, `(${offering.currency})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
