const API_BASE = process.env.API_BASE_URL ?? 'http://127.0.0.1:3003/api/v1';
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key';

type ApiJson = {
  success?: boolean;
  data?: unknown;
  error?: unknown;
};

async function adminRequest<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: ApiJson & { data?: T } }> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-admin-api-key': ADMIN_KEY,
      'x-admin-key': ADMIN_KEY,
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as ApiJson & { data?: T };
  return { status: response.status, body };
}

export type SeededEvent = {
  id: string;
  title: string;
};

export async function seedEvent(title: string): Promise<SeededEvent> {
  const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000).toISOString();

  const { status, body } = await adminRequest<{ id: string; title: string }>('/admin/events', {
    method: 'POST',
    body: JSON.stringify({
      title,
      description: `Playwright seeded event — ${title}`,
      starts_at: startsAt,
      ends_at: endsAt,
      venue_name: 'Playwright Venue',
      address_line: 'Av. Playwright 123, Santiago',
      city: 'Santiago',
      country_code: 'CL',
      event_type: 'parties',
      status: 'draft',
      min_age: 18,
      dress_code: 'casual',
    }),
  });

  if (status >= 400 || !body.success || !body.data?.id) {
    throw new Error(`seedEvent failed: HTTP ${status} ${JSON.stringify(body)}`);
  }

  return { id: body.data.id, title: body.data.title ?? title };
}

export async function deleteEventById(eventId: string): Promise<void> {
  await adminRequest(`/admin/events/${eventId}`, { method: 'DELETE' });
}

export async function listEvents(): Promise<Array<{ id: string; title: string; status: string }>> {
  const { status, body } = await adminRequest<{ events: Array<{ id: string; title: string; status: string }> }>(
    '/admin/events',
  );
  if (status >= 400 || !body.success) {
    throw new Error(`listEvents failed: HTTP ${status} ${JSON.stringify(body)}`);
  }
  return body.data?.events ?? [];
}

export async function updateEventApi(
  eventId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { status, body } = await adminRequest(`/admin/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (status >= 400 || !body.success) {
    throw new Error(`updateEventApi failed: HTTP ${status} ${JSON.stringify(body)}`);
  }
}

export async function ensureVipLayout(eventId: string): Promise<void> {
  const { status, body } = await adminRequest(`/admin/events/${eventId}/vip-tables/ensure-layout`, {
    method: 'POST',
    body: '{}',
  });
  if (status >= 400 || !body.success) {
    throw new Error(`ensureVipLayout failed: HTTP ${status} ${JSON.stringify(body)}`);
  }
}

export async function createVipZone(
  eventId: string,
  name: string,
): Promise<{ zoneId: string }> {
  const existing = await adminRequest<{ layout: { zones?: Array<{ zone_id: string }> } | null }>(
    `/admin/events/${eventId}/venue-layout`,
  );
  if (!existing.body.data?.layout) {
    const layout = await adminRequest(`/admin/events/${eventId}/venue-layout`, {
      method: 'PUT',
      body: JSON.stringify({
        venue_name: 'Playwright Hall',
        width_meters: 36,
        height_meters: 18,
        table_lock_minutes: 10,
      }),
    });
    if (layout.status >= 400 || !layout.body.success) {
      throw new Error(`createVipZone layout failed: ${JSON.stringify(layout.body)}`);
    }
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'vip-zone';
  const { status, body } = await adminRequest<{ zone_id: string }>(
    `/admin/events/${eventId}/venue-layout/zones`,
    {
      method: 'POST',
      body: JSON.stringify({
        external_id: `${slug}-${Date.now().toString().slice(-5)}`,
        name,
        kind: 'vip_table_zone',
        status: 'available',
        position_x: 12,
        position_y: 12,
        size_width: 22,
        size_height: 22,
        color: '#F2B705',
        capacity_per_table: 10,
        is_selectable: true,
        display_order: 1,
      }),
    },
  );
  if (status >= 400 || !body.success || !body.data?.zone_id) {
    throw new Error(`createVipZone failed: HTTP ${status} ${JSON.stringify(body)}`);
  }
  return { zoneId: body.data.zone_id };
}
