/**
 * E2E: admin event sales pause/resume
 * Usage: npx tsx scripts/test-admin-event-sales-e2e.ts
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
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const eventsRes = await request<{ success: boolean; data: { events: Array<{ id: string; title: string; status?: string }> } }>(
    '/admin/events',
  );
  assert(eventsRes.body.success, 'events list failed');
  const event =
    eventsRes.body.data.events.find((item) => item.status === 'published') ??
    eventsRes.body.data.events[0];
  assert(event, 'no event found');
  const eventId = event.id;
  console.log('Using event:', event.title, eventId);

  const initial = await request<{ success: boolean; data: { sales_paused: boolean } }>(
    `/admin/events/${eventId}/sales`,
  );
  assert(initial.status === 200, `GET sales status failed: ${initial.status}`);
  const initialPaused = initial.body.data.sales_paused;
  console.log('Initial sales_paused:', initialPaused);

  const pause = await request<{ success: boolean; data: { sales_paused: boolean } }>(
    `/admin/events/${eventId}/sales`,
    { method: 'PATCH', body: JSON.stringify({ sales_paused: true }) },
  );
  assert(pause.status === 200, `pause failed: ${pause.status}`);
  assert(pause.body.data.sales_paused === true, 'expected sales_paused true');

  const resume = await request<{ success: boolean; data: { sales_paused: boolean } }>(
    `/admin/events/${eventId}/sales`,
    { method: 'PATCH', body: JSON.stringify({ sales_paused: false }) },
  );
  assert(resume.status === 200, `resume failed: ${resume.status}`);
  assert(resume.body.data.sales_paused === false, 'expected sales_paused false');

  const list = await request<{ success: boolean; data: { events: Array<{ id: string; sales_paused?: boolean }> } }>(
    '/admin/events',
  );
  const listed = list.body.data.events.find((item) => item.id === eventId);
  assert(listed, 'event missing from list');
  assert(listed.sales_paused === false, 'list should reflect sales_paused false');

  if (initialPaused !== false) {
    await request(`/admin/events/${eventId}/sales`, {
      method: 'PATCH',
      body: JSON.stringify({ sales_paused: initialPaused }),
    });
  }

  console.log('All admin event sales checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
