/**
 * E2E smoke test: admin Events list API vs UI expectations.
 *
 * Usage: npx tsx scripts/test-admin-events-list-e2e.ts
 * Env: API_BASE_URL (default http://localhost:3002/api/v1), ADMIN_API_KEY
 */

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3002/api/v1';
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key';

type AdminEvent = {
  id: string;
  title: string;
  status?: string;
  starts_at: string;
  tickets_sold?: number;
  total_revenue_clp?: number;
  currency_code?: string;
  capacity_total?: number | null;
  image_url?: string | null;
};

type ListResponse = {
  success: boolean;
  data?: {
    events: AdminEvent[];
    summary?: { total_events: number; created_this_month: number };
  };
  error?: { message?: string };
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function apiGet(path: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-admin-api-key': ADMIN_KEY },
  });
  const payload = (await response.json()) as ListResponse;
  return { response, payload };
}

function countLifecycle(events: AdminEvent[]) {
  const now = Date.now();
  const activeWindow = 24 * 60 * 60 * 1000;
  const upcomingWindow = 30 * 24 * 60 * 60 * 1000;
  const counts = { all: events.length, active: 0, upcoming: 0, finished: 0, drafts: 0 };

  for (const event of events) {
    if (event.status === 'draft') {
      counts.drafts += 1;
      continue;
    }
    const startsAtMs = new Date(event.starts_at).getTime();
    const diff = startsAtMs - now;
    if (diff > 0 && diff <= upcomingWindow) {
      counts.upcoming += 1;
    }
    if (startsAtMs <= now && now - startsAtMs < activeWindow) {
      counts.active += 1;
    }
    if (startsAtMs < now && now - startsAtMs >= activeWindow) {
      counts.finished += 1;
    }
  }

  return counts;
}

async function main() {
  console.log('Admin Events list E2E');
  console.log('API:', API_BASE);

  const { response, payload } = await apiGet('/admin/events');
  assert(response.ok, `GET /admin/events failed (${response.status})`);
  assert(payload.success, payload.error?.message ?? 'success=false');

  const events = payload.data?.events ?? [];
  const summary = payload.data?.summary;
  assert(events.length > 0, 'Expected at least one event');
  assert(summary?.total_events === events.length, 'summary.total_events mismatch');

  console.log('✓ List returns', events.length, 'events');
  console.log('✓ Summary:', summary);

  const lifecycle = countLifecycle(events);
  console.log('✓ Lifecycle counts (UI tabs):', lifecycle);

  const lahore = events.find((event) => event.title.includes('Lahore'));
  if (lahore) {
    assert((lahore.tickets_sold ?? 0) > 0, 'Lahore tickets_sold should be > 0');
    assert((lahore.total_revenue_clp ?? 0) > 0, 'Lahore total_revenue_clp should be > 0');
    assert(lahore.capacity_total != null, 'Lahore capacity_total should be set');
    assert(lahore.currency_code === 'PKR', `Lahore currency should be PKR, got ${lahore.currency_code}`);
    console.log('✓ Lahore stats:', {
      tickets_sold: lahore.tickets_sold,
      total_revenue: lahore.total_revenue_clp,
      currency: lahore.currency_code,
      capacity: lahore.capacity_total,
    });
  } else {
    console.log('— Lahore event not in list (skipped sales assertions)');
  }

  const withImage = events.filter((event) => event.image_url?.startsWith('http'));
  console.log('✓ Events with image_url:', withImage.length, '/', events.length);

  const draft = events.find((event) => event.status === 'draft');
  if (draft) {
    const patchRes = await fetch(`${API_BASE}/admin/events/${draft.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-api-key': ADMIN_KEY,
      },
      body: JSON.stringify({ status: draft.status }),
    });
    assert(patchRes.ok, 'PATCH event should accept status noop');
    console.log('✓ Update endpoint reachable for draft event');
  } else {
    const sample = events[0];
    const patchRes = await fetch(`${API_BASE}/admin/events/${sample.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-api-key': ADMIN_KEY,
      },
      body: JSON.stringify({ title: sample.title }),
    });
    assert(patchRes.ok, 'PATCH event should accept title noop');
    console.log('✓ Update endpoint reachable');
  }

  console.log('\nAll Events page API checks passed.');
}

main().catch((error) => {
  console.error('\nFAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
