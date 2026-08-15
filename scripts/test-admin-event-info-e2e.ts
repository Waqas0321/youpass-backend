/**
 * E2E: admin event info profile fields save/load
 * Usage: npx tsx scripts/test-admin-event-info-e2e.ts
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
  assert(eventsRes.body.success, 'events list failed');
  const event = eventsRes.body.data.events.find((item) => item.title.includes('URBAN NIGHT')) ??
    eventsRes.body.data.events[0];
  assert(event, 'no event');
  const eventId = event.id;

  const patchBody = {
    min_age: 21,
    dress_code: 'formal',
    address_line: '3000 La Marina Ave, Hilaria, Santiago',
    primary_color: '#112233',
    secondary_color: '#AABBCC',
    carousel_images: ['https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400'],
    sponsors: [{ id: 's1', label: 'Test Sponsor', tone: '#00529b' }],
    social_links: [{ id: 'l1', platform: 'instagram', handle: '@test.handle' }],
    ends_at: new Date(new Date().getTime() + 6 * 60 * 60 * 1000).toISOString(),
  };

  const patch = await request<{ success: boolean; data: Record<string, unknown> }>(
    `/admin/events/${eventId}`,
    { method: 'PATCH', body: JSON.stringify(patchBody) },
  );
  assert(patch.status === 200, `patch failed: ${patch.status} ${JSON.stringify(patch.body)}`);
  const data = patch.body.data;
  assert(data.min_age === 21, 'min_age not saved');
  assert(data.dress_code === 'formal', 'dress_code not saved');
  assert(data.address_line === patchBody.address_line, 'address_line not saved');
  assert(data.primary_color === '#112233', 'primary_color not saved');
  assert(Array.isArray(data.carousel_images) && data.carousel_images.length === 1, 'carousel not saved');
  assert(Array.isArray(data.sponsors) && data.sponsors.length === 1, 'sponsors not saved');
  assert(Array.isArray(data.social_links) && data.social_links.length === 1, 'social not saved');
  assert(typeof data.ends_at === 'string', 'ends_at not saved');

  const list = await request<{ success: boolean; data: { events: Array<Record<string, unknown>> } }>(
    '/admin/events',
  );
  const listed = list.body.data.events.find((item) => item.id === eventId);
  assert(listed?.min_age === 21, 'list should include min_age');

  console.log('All admin event info profile checks passed for', event.title);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
