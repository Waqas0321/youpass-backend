/**
 * E2E: admin event invitations page API surface
 * Usage: API_BASE=http://localhost:3003/api/v1 npx tsx scripts/test-admin-event-invitations-e2e.ts
 */
const API = process.env.API_BASE ?? 'http://localhost:3003/api/v1';
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key';

type ApiBody = {
  success?: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

async function request<T = ApiBody>(
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
  const body = (await res.json()) as T;
  return { status: res.status, body };
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function pass(label: string, detail = '') {
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log('Admin event invitations E2E');
  console.log(`API: ${API}\n`);

  const producersRes = await request<{ success: boolean; data: { producers: Array<{ id: string; name: string }> } }>(
    '/admin/producers',
  );
  assert(producersRes.status === 200 && producersRes.body.success, 'producers list failed');
  const producer = producersRes.body.data.producers[0];
  assert(producer, 'no producer');
  pass('GET /admin/producers', producer.name);

  const eventsRes = await request<{ success: boolean; data: { events: Array<{ id: string; title: string }> } }>(
    '/admin/events',
  );
  assert(eventsRes.status === 200 && eventsRes.body.success, 'events list failed');
  const event =
    eventsRes.body.data.events.find((item) => item.title.includes('URBAN NIGHT')) ??
    eventsRes.body.data.events[0];
  assert(event, 'no event');
  pass('GET /admin/events', event.title);

  const eventId = event.id;
  const producerId = producer.id;
  const stamp = Date.now().toString().slice(-7);
  const testPhone = `+5699${stamp}`;
  const testName = `E2E Guest ${stamp}`;

  const listBefore = await request<{
    success: boolean;
    data: { invitations: Array<{ id: string }>; pagination: { total: number } };
  }>(`/producer/invitations?event_id=${eventId}&page=1&page_size=100`, {}, producerId);
  assert(listBefore.status === 200 && listBefore.body.success, 'list invitations failed');
  const beforeTotal = listBefore.body.data.pagination.total;
  pass('GET /producer/invitations (event scoped)', `total=${beforeTotal}`);

  const createRes = await request<{ success: boolean; data: { id: string; recipient_name?: string; deep_link?: string; lifecycle_state?: string } }>(
    '/producer/invitations',
    {
      method: 'POST',
      body: JSON.stringify({
        event_id: eventId,
        type: 'free',
        recipient_phone: testPhone,
        recipient_name: testName,
        slot_label: 'Influencers · General',
        personalised_message: 'E2E admin invitations test',
      }),
    },
    producerId,
  );
  assert(
    (createRes.status === 200 || createRes.status === 201) && createRes.body.success && createRes.body.data?.id,
    `create failed: ${JSON.stringify(createRes.body)}`,
  );
  const invitationId = createRes.body.data.id;
  assert(createRes.body.data.recipient_name === testName, 'recipient_name missing on create');
  assert(Boolean(createRes.body.data.deep_link), 'deep_link missing on create');
  pass('POST /producer/invitations (phone)', invitationId);

  const searchRes = await request<{
    success: boolean;
    data: { invitations: Array<{ id: string; recipient_name?: string }> };
  }>(
    `/producer/invitations?event_id=${eventId}&search=${encodeURIComponent(testName)}&page=1&page_size=20`,
    {},
    producerId,
  );
  assert(searchRes.status === 200 && searchRes.body.success, 'search failed');
  assert(
    searchRes.body.data.invitations.some((row) => row.id === invitationId),
    'search did not return created invitation',
  );
  pass('GET /producer/invitations?search=', testName);

  const updateRes = await request<{ success: boolean; data: { recipient_name?: string; slot_label?: string } }>(
    `/producer/invitations/${invitationId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        recipient_name: `${testName} Updated`,
        slot_label: 'Staff · VIP',
        personalised_message: 'Updated E2E message',
      }),
    },
    producerId,
  );
  assert(updateRes.status === 200 && updateRes.body.success, `update failed: ${JSON.stringify(updateRes.body)}`);
  assert(updateRes.body.data.recipient_name === `${testName} Updated`, 'name not updated');
  assert(updateRes.body.data.slot_label === 'Staff · VIP', 'slot not updated');
  pass('PATCH /producer/invitations/:id');

  const resendRes = await request<{ success: boolean; data: { id: string } }>(
    `/producer/invitations/${invitationId}/resend`,
    { method: 'POST', body: '{}' },
    producerId,
  );
  assert(resendRes.status === 200 && resendRes.body.success, `resend failed: ${JSON.stringify(resendRes.body)}`);
  pass('POST /producer/invitations/:id/resend');

  const batchNameA = `E2E Batch A ${stamp}`;
  const batchNameB = `E2E Batch B ${stamp}`;
  const batchIds: string[] = [];

  for (const [name, phoneSuffix] of [
    [batchNameA, '1'],
    [batchNameB, '2'],
  ] as const) {
    const batchRes = await request<{ success: boolean; data: { id: string } }>(
      '/producer/invitations',
      {
        method: 'POST',
        body: JSON.stringify({
          event_id: eventId,
          type: 'guaranteed',
          recipient_phone: `${testPhone.slice(0, -1)}${phoneSuffix}`,
          recipient_name: name,
          slot_label: 'RRPP · VIP',
        }),
      },
      producerId,
    );
    assert(batchRes.body.success && batchRes.body.data?.id, `batch create failed for ${name}`);
    batchIds.push(batchRes.body.data.id);
  }
  pass('POST /producer/invitations (batch/list)', `${batchIds.length} guests`);

  const candidatesRes = await request<{ success: boolean; data: { candidates: unknown[] } }>(
    `/producer/invitations/suggested-candidates?event_id=${eventId}&limit=10`,
    {},
    producerId,
  );
  assert(candidatesRes.status === 200 && candidatesRes.body.success, 'suggested candidates failed');
  pass('GET /producer/invitations/suggested-candidates', `count=${candidatesRes.body.data.candidates.length}`);

  const duplicateRes = await request(
    '/producer/invitations',
    {
      method: 'POST',
      body: JSON.stringify({
        event_id: eventId,
        type: 'free',
        recipient_phone: testPhone,
        recipient_name: `${testName} Duplicate`,
        slot_label: 'Staff',
      }),
    },
    producerId,
  );
  assert(
    duplicateRes.status === 409 || duplicateRes.body.success === false,
    `duplicate create should fail: ${JSON.stringify(duplicateRes.body)}`,
  );
  pass('POST /producer/invitations duplicate blocked');

  const candidatesAfterInvite = await request<{ success: boolean; data: { candidates: Array<{ guest_phone: string }> } }>(
    `/producer/invitations/suggested-candidates?event_id=${eventId}&limit=50`,
    {},
    producerId,
  );
  const stillListed = candidatesAfterInvite.body.data.candidates.some(
    (candidate) => candidate.guest_phone === testPhone,
  );
  assert(!stillListed, 'invited guest still appears in suggested candidates');
  pass('GET /producer/invitations/suggested-candidates excludes invited guest');

  const revokeMain = await request<{ success: boolean; data: { revoked: boolean; id: string } }>(
    `/producer/invitations/${invitationId}`,
    { method: 'DELETE' },
    producerId,
  );
  assert(revokeMain.status === 200 && revokeMain.body.success && revokeMain.body.data.revoked, 'revoke main failed');
  pass('DELETE /producer/invitations/:id', invitationId);

  for (const id of batchIds) {
    const revokeBatch = await request(`/producer/invitations/${id}`, { method: 'DELETE' }, producerId);
    assert(revokeBatch.status === 200 && revokeBatch.body.success, `revoke batch ${id} failed`);
  }
  pass('DELETE /producer/invitations/:id (batch cleanup)');

  const listAfter = await request<{ success: boolean; data: { pagination: { total: number } } }>(
    `/producer/invitations?event_id=${eventId}&page=1&page_size=100`,
    {},
    producerId,
  );
  assert(listAfter.body.data.pagination.total === beforeTotal, 'total count changed after cleanup');
  pass('Cleanup verified', `total still ${beforeTotal}`);

  console.log('\nAll admin event invitation checks passed.');
}

main().catch((err) => {
  console.error('\n✗', err instanceof Error ? err.message : err);
  process.exit(1);
});
