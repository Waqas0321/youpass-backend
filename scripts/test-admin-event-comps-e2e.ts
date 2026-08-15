/**
 * E2E: admin event complimentary (comps) page API surface
 * Usage: API_BASE=http://localhost:3003/api/v1 npx tsx scripts/test-admin-event-comps-e2e.ts
 */
const API = process.env.API_BASE ?? 'http://localhost:3003/api/v1';
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key';

async function request<T = { success?: boolean; error?: string; data?: Record<string, unknown> }>(
  path: string,
  init: RequestInit = {},
  producerId?: string,
) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-admin-api-key': ADMIN_KEY,
      ...(producerId ? { 'x-producer-id': producerId } : {}),
      ...(init.headers ?? {}),
    },
  });
  return { status: res.status, body: (await res.json()) as T };
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function pass(label: string, detail = '') {
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

function encodeCompMetadata(metadata: Record<string, unknown>) {
  return `__COMP__${JSON.stringify(metadata)}`;
}

async function main() {
  console.log('Admin event complimentary E2E');
  console.log(`API: ${API}\n`);

  const producersRes = await request<{ success: boolean; data: { producers: Array<{ id: string; name: string }> } }>(
    '/admin/producers',
  );
  const producer = producersRes.body.data?.producers[0];
  assert(producer, 'no producer');
  pass('GET /admin/producers', producer.name);

  const eventsRes = await request<{ success: boolean; data: { events: Array<{ id: string; title: string }> } }>(
    '/admin/events',
  );
  const event =
    eventsRes.body.data?.events.find((item) => item.title.includes('URBAN NIGHT')) ??
    eventsRes.body.data?.events[0];
  assert(event, 'no event');
  pass('GET /admin/events', event.title);

  const eventId = event.id;
  const producerId = producer.id;
  const stamp = Date.now().toString().slice(-6);
  const phone = `+56988${stamp}`;
  const compCode = `CRT-TEST${stamp.slice(-4)}`;

  const meta = encodeCompMetadata({
    kind: 'complimentary',
    comp_type: 'vip',
    benefit: 'Entrada VIP + Open Bar',
    issue_date: '2026-07-06',
    time_from: '22:00',
    time_to: '04:00',
    comp_code: compCode,
  });

  const createRes = await request<{ success: boolean; data: { id: string; custom_message?: string } }>(
    '/producer/invitations',
    {
      method: 'POST',
      body: JSON.stringify({
        event_id: eventId,
        type: 'free',
        recipient_phone: phone,
        recipient_name: `Comp Guest ${stamp}`,
        slot_label: 'Cortesía VIP',
        personalised_message: meta,
      }),
    },
    producerId,
  );
  assert(createRes.body.success && createRes.body.data?.id, `create failed: ${JSON.stringify(createRes.body)}`);
  const compId = createRes.body.data.id;
  assert(createRes.body.data.custom_message?.startsWith('__COMP__'), 'comp metadata missing');
  pass('POST complimentary (free invitation + metadata)', compCode);

  const listRes = await request<{
    success: boolean;
    data: { invitations: Array<{ id: string; custom_message?: string }> };
  }>(`/producer/invitations?event_id=${eventId}&page=1&page_size=100`, {}, producerId);
  const listed = listRes.body.data?.invitations.filter((row) => row.custom_message?.startsWith('__COMP__')) ?? [];
  assert(listed.some((row) => row.id === compId), 'comp not in event list');
  pass('GET list includes complimentary row', `count=${listed.length}`);

  const updateRes = await request(
    `/producer/invitations/${compId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        recipient_name: `Comp Guest Updated ${stamp}`,
        slot_label: 'Cortesía VIP',
        personalised_message: encodeCompMetadata({
          kind: 'complimentary',
          comp_type: 'vip',
          benefit: 'Entrada VIP actualizada',
          issue_date: '2026-07-06',
          time_from: '22:00',
          time_to: '04:00',
          comp_code: compCode,
        }),
      }),
    },
    producerId,
  );
  assert(updateRes.status === 200 && updateRes.body.success, 'update failed');
  pass('PATCH complimentary');

  const resendRes = await request(`/producer/invitations/${compId}/resend`, { method: 'POST', body: '{}' }, producerId);
  assert(resendRes.status === 200 && resendRes.body.success, 'resend failed');
  pass('POST resend complimentary');

  const revokeRes = await request(`/producer/invitations/${compId}`, { method: 'DELETE' }, producerId);
  assert(revokeRes.status === 200 && revokeRes.body.success, 'revoke failed');
  pass('DELETE complimentary');

  console.log('\nAll admin event complimentary checks passed.');
}

main().catch((err) => {
  console.error('\n✗', err instanceof Error ? err.message : err);
  process.exit(1);
});
