/**
 * Section 21 — Ticket Type Selection verification.
 * Run: npm run test:section-21
 *
 * Checks DB seed data, API responses (if server is up), admin endpoints, and Flutter source.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/database.js';
import { createSession } from '../src/modules/auth/session.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const FLUTTER_ROOT = path.resolve(REPO_ROOT, '../youpass');

const BASE = process.env.API_BASE_URL ?? `http://localhost:${env.PORT}${env.API_PREFIX}`;
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key';

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

function pass(name: string, detail = 'OK') {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail !== 'OK' ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.log(`  ✗ ${name} — ${detail}`);
}

function readFlutter(relPath: string): string | null {
  const full = path.join(FLUTTER_ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function flutterContains(relPath: string, needle: string, label: string) {
  const content = readFlutter(relPath);
  if (!content) {
    fail(label, `Missing file: ${relPath}`);
    return;
  }
  if (content.includes(needle)) {
    pass(label);
  } else {
    fail(label, `Expected "${needle}" in ${relPath}`);
  }
}

async function apiReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function getDevToken(): Promise<string | null> {
  const user =
    (await prisma.user.findFirst({ where: { phone: '+56912345678' } })) ??
    (await prisma.user.findFirst({ where: { accountStatus: 'active' } }));
  if (!user) return null;
  const session = await createSession(user);
  return session.accessToken;
}

async function main() {
  console.log('=== Section 21 verification ===\n');

  // ── Database ─────────────────────────────────────────────────────────────
  console.log('Database');

  const purchasableTitles = ['Caribe Night', 'URBAN NIGHT LIVE', 'Sunset Sessions'];
  const publishedWithTickets = await prisma.event.findMany({
    where: {
      status: 'published',
      title: { in: purchasableTitles },
    },
    include: {
      ticketOfferings: true,
      venueLayout: { select: { id: true } },
    },
  });

  if (publishedWithTickets.length >= 3) {
    pass('Purchasable demo events exist', `${publishedWithTickets.length} events`);
  } else {
    fail(
      'Purchasable demo events exist',
      `Found ${publishedWithTickets.length}/3 — run: npm run db:seed:purchasable`,
    );
  }

  for (const title of purchasableTitles) {
    const event = publishedWithTickets.find((item) => item.title === title);
    if (!event) {
      fail(`Event "${title}" published with tickets`, 'Not found');
      continue;
    }
    const activeOfferings = event.ticketOfferings.filter((o) => o.status === 'active');
    if (activeOfferings.length > 0) {
      pass(`"${title}" has active ticket types`, `${activeOfferings.length} active`);
    } else {
      fail(`"${title}" has active ticket types`, 'None active');
    }
  }

  const caribe = publishedWithTickets.find((e) => e.title === 'Caribe Night');
  if (caribe) {
    const soldOutWave = caribe.ticketOfferings.find((o) => o.type === 'early_bird');
    if (soldOutWave && soldOutWave.status === 'sold_out' && soldOutWave.stockTotal) {
      pass('Caribe Night Early bird sold-out wave seeded');
    } else {
      fail('Caribe Night Early bird sold-out wave seeded', 'early_bird should be sold_out + stocked');
    }
    if (caribe.venueLayout) {
      pass('Caribe Night has VIP floor plan');
    } else {
      fail('Caribe Night has VIP floor plan', 'Missing layout');
    }
  }

  const offeringWithStock = await prisma.eventTicketOffering.findFirst({
    where: { stockTotal: { not: null } },
  });
  if (offeringWithStock) {
    pass('Per-wave stock_total field in use');
  } else {
    fail('Per-wave stock_total field in use', 'Run db:seed:purchasable');
  }

  // ── Flutter source (Section 21 UI) ───────────────────────────────────────
  console.log('\nFlutter app (Section 21)');

  if (!fs.existsSync(FLUTTER_ROOT)) {
    fail('Flutter repo found', `Expected at ${FLUTTER_ROOT}`);
  } else {
    pass('Flutter repo found', FLUTTER_ROOT);

    flutterContains(
      'lib/features/vip_venue/presentation/screens/ticket_selection_screen.dart',
      'expandedOfferingId',
      'Expandable cards state',
    );
    flutterContains(
      'lib/features/vip_venue/presentation/screens/ticket_selection_screen.dart',
      'copyWith(quantity: 1)',
      'Auto quantity 1 on expand',
    );
    flutterContains(
      'lib/features/vip_venue/presentation/screens/ticket_selection_screen.dart',
      'vipSectionVipTables',
      'Two-block layout (VIP Tables section)',
    );
    flutterContains(
      'lib/features/vip_venue/presentation/widgets/ticket_offering_row_widget.dart',
      'isExpanded',
      'Card expand/collapse widget',
    );
    flutterContains(
      'lib/features/vip_venue/presentation/widgets/ticket_offering_row_widget.dart',
      'vipTicketSoldOutBadge',
      'Sold out badge on card',
    );
    flutterContains(
      'lib/features/vip_venue/presentation/widgets/ticket_selection_bottom_bar_widget.dart',
      'vipContinueWithAmount',
      'Continue button shows amount',
    );
    flutterContains(
      'lib/features/vip_venue/presentation/vip_venue_screen_theme.dart',
      '0xFFE5A906',
      'Brand gold colour',
    );
    flutterContains(
      'lib/features/vip_venue/presentation/vip_venue_screen_theme.dart',
      '0xFF0F0F14',
      'Brand button text colour',
    );
    flutterContains(
      'lib/features/vip_venue/data/models/vip_venue_models.dart',
      'is_sold_out',
      'Parse is_sold_out from API',
    );
    flutterContains(
      'lib/features/vip_venue/data/models/vip_venue_models.dart',
      'description',
      'Parse ticket description from API',
    );
  }

  // ── Backend source ───────────────────────────────────────────────────────
  console.log('\nBackend source');

  const formatter = fs.readFileSync(
    path.join(REPO_ROOT, 'src/modules/vip-venue/vip-venue.formatter.ts'),
    'utf8',
  );
  if (formatter.includes('resolveOfferingAvailability') && formatter.includes('is_sold_out')) {
    pass('Offering availability resolver');
  } else {
    fail('Offering availability resolver', 'Missing resolveOfferingAvailability');
  }

  const adminRoutes = fs.readFileSync(
    path.join(REPO_ROOT, 'src/modules/admin/admin.routes.ts'),
    'utf8',
  );
  if (adminRoutes.includes('ticket-offerings')) {
    pass('Admin ticket-offerings routes');
  } else {
    fail('Admin ticket-offerings routes', 'Missing CRUD routes');
  }

  const adminPanel = path.join(REPO_ROOT, 'admin/src/components/EventTicketOfferingsPanel.tsx');
  if (fs.existsSync(adminPanel)) {
    pass('Admin EventTicketOfferingsPanel UI');
  } else {
    fail('Admin EventTicketOfferingsPanel UI', 'Component missing');
  }

  // ── Live API (optional) ──────────────────────────────────────────────────
  console.log('\nAPI (live)');

  const serverUp = await apiReachable();
  if (!serverUp) {
    console.log('  ⚠ API not reachable — skipping live checks (start: npm run dev)');
  } else {
    pass('API health reachable');

    const token = await getDevToken();
    const caribeEvent = await prisma.event.findFirst({
      where: { title: 'Caribe Night', status: 'published' },
    });

    if (!caribeEvent) {
      fail('Live ticket-types check', 'Caribe Night not in DB');
    } else if (!token) {
      fail('Live ticket-types check', 'No dev user for auth');
    } else {
      const ticketTypesRes = await fetch(`${BASE}/events/${caribeEvent.id}/ticket-types`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ticketTypesBody = await ticketTypesRes.json();

      if (ticketTypesRes.ok && ticketTypesBody.data?.offerings?.length > 0) {
        const offerings = ticketTypesBody.data.offerings;
        pass('GET /events/:id/ticket-types', `${offerings.length} offerings`);

        const hasDescription = offerings.some((o: { name?: string }) => o.name);
        if (hasDescription) pass('API returns ticket names');
        else fail('API returns ticket names', 'No name on any offering');

        const hasSoldOut = offerings.some((o: { is_sold_out?: boolean }) => o.is_sold_out === true);
        if (hasSoldOut) pass('API returns sold-out offering (visible, not hidden)');
        else fail('API returns sold-out offering', 'Expected early_bird is_sold_out');

        const hasSelectable = offerings.some(
          (o: { is_selectable?: boolean }) => o.is_selectable === true,
        );
        if (hasSelectable) pass('API returns selectable offerings');
        else fail('API returns selectable offerings', 'None selectable');

        const availabilityRes = await fetch(
          `${BASE}/events/${caribeEvent.id}/availability`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const availabilityBody = await availabilityRes.json();
        if (availabilityRes.ok && availabilityBody.data?.has_general_tickets != null) {
          pass('GET /events/:id/availability');
        } else {
          fail('GET /events/:id/availability', JSON.stringify(availabilityBody));
        }

        const detailRes = await fetch(`${BASE}/events/${caribeEvent.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const detailBody = await detailRes.json();
        if (detailRes.ok && detailBody.data?.purchase?.has_ticket_offerings) {
          pass('GET /events/:id includes purchase meta');
        } else {
          fail('GET /events/:id includes purchase meta', JSON.stringify(detailBody));
        }

        const layoutRes = await fetch(`${BASE}/events/${caribeEvent.id}/venue-layout`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (layoutRes.ok) {
          pass('GET /events/:id/venue-layout (VIP Tables block)');
        } else {
          fail('GET /events/:id/venue-layout', `Status ${layoutRes.status}`);
        }
      } else {
        fail('GET /events/:id/ticket-types', JSON.stringify(ticketTypesBody));
      }

      const adminOfferingsRes = await fetch(
        `${BASE}/admin/events/${caribeEvent.id}/ticket-offerings`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': ADMIN_KEY,
            'x-admin-api-key': ADMIN_KEY,
          },
        },
      );
      const adminBody = await adminOfferingsRes.json();
      if (adminOfferingsRes.ok && adminBody.data?.offerings) {
        pass('GET /admin/events/:id/ticket-offerings', `${adminBody.data.offerings.length} types`);
      } else {
        fail('GET /admin/events/:id/ticket-offerings', JSON.stringify(adminBody));
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log('\n=== Summary ===');
  console.log(`${passed}/${results.length} passed`);

  if (failed.length > 0) {
    console.log('\nFailed:');
    for (const item of failed) {
      console.log(`  - ${item.name}: ${item.detail}`);
    }
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('\nAll Section 21 checks passed.');
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
