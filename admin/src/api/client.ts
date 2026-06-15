const SESSION_KEY = 'youpass_admin_session';

export type AdminSession = {
  apiKey: string;
  producerId?: string;
};

export function getSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AdminSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AdminSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

type ApiResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

function adminHeaders(session: AdminSession, producerId?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-admin-key': session.apiKey,
    'x-admin-api-key': session.apiKey,
  };
  const resolvedProducer = producerId ?? session.producerId;
  if (resolvedProducer) {
    headers['x-producer-id'] = resolvedProducer;
  }
  return headers;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  producerId?: string,
): Promise<ApiResult<T>> {
  const session = getSession();
  if (!session) {
    return { ok: false, status: 401, error: 'Not signed in' };
  }

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      ...adminHeaders(session, producerId),
      ...(init.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload?.error?.message ?? payload?.message ?? `Request failed (${response.status})`,
    };
  }

  return {
    ok: true,
    status: response.status,
    data: payload.data as T,
  };
}

export const adminApi = {
  overview: () => apiRequest<Record<string, number>>('/admin/overview'),
  producers: () => apiRequest<{ producers: Producer[] }>('/admin/producers'),
  users: () => apiRequest<{ users: AdminUser[] }>('/admin/users'),
  events: () => apiRequest<{ events: AdminEvent[] }>('/admin/events'),
  createEvent: (body: AdminEventInput) =>
    apiRequest<AdminEvent>('/admin/events', { method: 'POST', body: JSON.stringify(body) }),
  updateEvent: (eventId: string, body: Partial<AdminEventInput>) =>
    apiRequest<AdminEvent>(`/admin/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteEvent: (eventId: string) =>
    apiRequest(`/admin/events/${eventId}`, { method: 'DELETE' }),
  eventTypes: () => apiRequest<EventTypeOption[]>('/events/types'),
  countries: () => apiRequest<CountryOption[]>('/config/countries'),
  categories: () => apiRequest<{ event_categories: EventCategory[] }>('/config/event-categories/all'),
  createCategory: (body: Partial<EventCategory>) =>
    apiRequest('/config/event-categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id: string, body: Partial<EventCategory>) =>
    apiRequest(`/config/event-categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  banners: () => apiRequest<{ home_banners: HomeBanner[] }>('/config/home-banners/all'),
  createBanner: (body: Partial<HomeBanner>) =>
    apiRequest('/config/home-banners', { method: 'POST', body: JSON.stringify(body) }),
  updateBanner: (id: string, body: Partial<HomeBanner>) =>
    apiRequest(`/config/home-banners/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteBanner: (id: string) =>
    apiRequest(`/config/home-banners/${id}`, { method: 'DELETE' }),
  invitationConfig: () => apiRequest<{ expiry_days: number }>('/config/invitations'),
  updateInvitationConfig: (expiry_days: number) =>
    apiRequest('/config/invitations', {
      method: 'PATCH',
      body: JSON.stringify({ expiry_days }),
    }),
  supportFaqs: () => apiRequest<{ faqs: SupportFaq[] }>('/support/admin/faqs'),
  producerStats: (producerId: string) =>
    apiRequest<ProducerInvitationStats>('/producer/invitations/stats', {}, producerId),
  producerInvitations: (producerId: string, page = 1) =>
    apiRequest<{ invitations: ProducerInvitation[]; pagination: Pagination }>(
      `/producer/invitations?page=${page}&page_size=20`,
      {},
      producerId,
    ),
  producerAlerts: (producerId: string) =>
    apiRequest('/producer/invitations/alerts', {}, producerId),
  createInvitation: (producerId: string, body: CreateInvitationBody) =>
    apiRequest('/producer/invitations', { method: 'POST', body: JSON.stringify(body) }, producerId),
  runSystemJob: (
    job: 'release-expired' | 'send-reminders' | 'post-event-charges' | 'process-waitlist-offers',
  ) => apiRequest(`/system/invitations/${job}`, { method: 'POST', body: '{}' }),
  eventWaitlist: (eventId: string) =>
    apiRequest<EventWaitlistDashboard>(`/admin/events/${eventId}/waitlist`),
  eventInvitationSettings: (eventId: string) =>
    apiRequest<EventInvitationSettings>(`/admin/events/${eventId}/invitation-settings`),
  updateEventInvitationSettings: (eventId: string, body: EventInvitationSettings) =>
    apiRequest<EventInvitationSettings>(`/admin/events/${eventId}/invitation-settings`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  eventTicketOfferings: (eventId: string) =>
    apiRequest<{ event_id: string; offerings: AdminTicketOffering[] }>(
      `/admin/events/${eventId}/ticket-offerings`,
    ),
  createTicketOffering: (eventId: string, body: AdminTicketOfferingInput) =>
    apiRequest<AdminTicketOffering>(`/admin/events/${eventId}/ticket-offerings`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateTicketOffering: (
    eventId: string,
    offeringId: string,
    body: Partial<AdminTicketOfferingInput>,
  ) =>
    apiRequest<AdminTicketOffering>(`/admin/events/${eventId}/ticket-offerings/${offeringId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteTicketOffering: (eventId: string, offeringId: string) =>
    apiRequest(`/admin/events/${eventId}/ticket-offerings/${offeringId}`, {
      method: 'DELETE',
    }),
  eventVenueLayout: (eventId: string) =>
    apiRequest<{ event_id: string; layout: AdminVenueLayout | null }>(
      `/admin/events/${eventId}/venue-layout`,
    ),
  upsertVenueLayout: (eventId: string, body: AdminVenueLayoutInput) =>
    apiRequest<AdminVenueLayout>(`/admin/events/${eventId}/venue-layout`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteVenueLayout: (eventId: string) =>
    apiRequest(`/admin/events/${eventId}/venue-layout`, { method: 'DELETE' }),
  createVenueZone: (eventId: string, body: AdminVenueZoneInput) =>
    apiRequest<AdminVenueZone>(`/admin/events/${eventId}/venue-layout/zones`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateVenueZone: (eventId: string, zoneId: string, body: Partial<AdminVenueZoneInput>) =>
    apiRequest<AdminVenueZone>(`/admin/events/${eventId}/venue-layout/zones/${zoneId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteVenueZone: (eventId: string, zoneId: string) =>
    apiRequest(`/admin/events/${eventId}/venue-layout/zones/${zoneId}`, { method: 'DELETE' }),
  createVenueTable: (eventId: string, zoneId: string, body: AdminVenueTableInput) =>
    apiRequest<AdminVenueTable>(
      `/admin/events/${eventId}/venue-layout/zones/${zoneId}/tables`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  updateVenueTable: (
    eventId: string,
    zoneId: string,
    tableId: string,
    body: Partial<AdminVenueTableInput>,
  ) =>
    apiRequest<AdminVenueTable>(
      `/admin/events/${eventId}/venue-layout/zones/${zoneId}/tables/${tableId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  deleteVenueTable: (eventId: string, zoneId: string, tableId: string) =>
    apiRequest(
      `/admin/events/${eventId}/venue-layout/zones/${zoneId}/tables/${tableId}`,
      { method: 'DELETE' },
    ),
  venues: (params?: { country?: string; city?: string; q?: string }) => {
    const search = new URLSearchParams();
    if (params?.country) search.set('country', params.country);
    if (params?.city) search.set('city', params.city);
    if (params?.q) search.set('q', params.q);
    const query = search.toString();
    return apiRequest<{ venues: PhysicalVenue[] }>(
      `/admin/venues${query ? `?${query}` : ''}`,
    );
  },
  createVenue: (body: PhysicalVenueInput) =>
    apiRequest<PhysicalVenue>('/admin/venues', { method: 'POST', body: JSON.stringify(body) }),
  updateVenue: (venueId: string, body: Partial<PhysicalVenueInput>) =>
    apiRequest<PhysicalVenue>(`/admin/venues/${venueId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteVenue: (venueId: string) =>
    apiRequest(`/admin/venues/${venueId}`, { method: 'DELETE' }),
};

export type Producer = {
  id: string;
  name: string;
  logo_url: string | null;
  follower_count: number;
};

export type AdminUser = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
};

export type VenueDimensions = {
  width_meters: number;
  height_meters: number;
};

export type PhysicalVenue = {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  dimensions: VenueDimensions;
  created_at: string;
  updated_at: string;
};

export type PhysicalVenueInput = {
  name: string;
  address: string;
  city: string;
  country: string;
  dimensions: VenueDimensions;
};

export type AdminEvent = {
  id: string;
  title: string;
  description?: string | null;
  city: string;
  venue_name?: string;
  venue_id?: string | null;
  physical_venue?: PhysicalVenue | null;
  country_code?: string;
  starts_at: string;
  starts_at_display?: string;
  location_display?: string;
  image_url?: string | null;
  producer_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: 'draft' | 'published' | 'cancelled';
  is_featured?: boolean;
  featured_order?: number;
  event_type?: { id: string; slug: string; name: string; icon?: string | null };
};

export type AdminEventInput = {
  title: string;
  description?: string;
  starts_at: string;
  venue_id?: string;
  venue_name?: string;
  city?: string;
  country_code?: string;
  image_url?: string;
  event_type: string;
  producer_name?: string;
  latitude?: number;
  longitude?: number;
  status?: 'draft' | 'published' | 'cancelled';
  is_featured?: boolean;
  featured_order?: number;
};

export type AdminTicketOffering = {
  id: string;
  offering_id: string;
  type: 'early_bird' | 'preventa_2' | 'preventa_3' | 'general' | 'vip_general';
  name: string;
  section: 'general' | 'vip';
  price: number;
  currency: string;
  display_order: number;
  stock_total?: number | null;
  stock_remaining?: number | null;
  sold_quantity?: number;
  sale_start_at?: string | null;
  sale_end_at?: string | null;
  status: 'active' | 'sold_out' | 'paused' | 'closed';
  is_sold_out: boolean;
  is_selectable: boolean;
  slug: string;
  label: string;
};

export type AdminTicketOfferingInput = {
  type: 'early_bird' | 'preventa_2' | 'preventa_3' | 'general' | 'vip_general';
  name: string;
  price: number;
  stock_total?: number | null;
  stock_remaining?: number | null;
  sale_start_at?: string | null;
  sale_end_at?: string | null;
  status?: 'active' | 'sold_out' | 'paused' | 'closed';
  display_order?: number;
};

export type AdminVenueLayout = {
  layout_id: string;
  event_id: string;
  venue_id: string | null;
  physical_venue: PhysicalVenue | null;
  venue_name: string;
  width_meters: number;
  height_meters: number;
  table_lock_minutes: number;
  total_zones: number;
  total_tables: number;
  available_tables: number;
  sold_tables: number;
  zones: AdminVenueZone[];
};

export type AdminVenueLayoutInput = {
  venue_id?: string;
  venue_name?: string;
  width_meters?: number;
  height_meters?: number;
  table_lock_minutes?: number;
};

export type AdminVenueZone = {
  zone_id: string;
  external_id: string;
  name: string;
  kind: 'vip_table_zone' | 'vip_premium_zone' | 'stage' | 'general_floor';
  status: 'available' | 'premium' | 'sold';
  position_x: number;
  position_y: number;
  size_width: number;
  size_height: number;
  color: string;
  capacity_per_table?: number | null;
  is_selectable: boolean;
  display_order: number;
  total_tables: number;
  available_tables: number;
  sold_tables: number;
  tables: AdminVenueTable[];
};

export type AdminVenueZoneInput = {
  external_id: string;
  name: string;
  kind: AdminVenueZone['kind'];
  status?: AdminVenueZone['status'];
  position_x: number;
  position_y: number;
  size_width: number;
  size_height: number;
  color: string;
  capacity_per_table?: number | null;
  is_selectable?: boolean;
  display_order?: number;
};

export type AdminVenueTable = {
  table_id: string;
  event_id: string;
  external_id: string;
  number: number;
  label: string;
  status: 'available' | 'locked' | 'reserved' | 'sold';
  position: { x: number; y: number };
  position_x: number;
  position_y: number;
  price: number;
  currency: string;
  capacity: number;
  includes: { bottles: number; bar_vouchers: number; extras: string[] };
  bottle_count: number;
  voucher_count: number;
  locked_by_user_id: string | null;
  locked_until: string | null;
  sold_at: string | null;
  sold_to_user_id: string | null;
};

export type AdminVenueTableInput = {
  external_id: string;
  number: number;
  label: string;
  status?: AdminVenueTable['status'];
  position?: { x: number; y: number };
  position_x?: number;
  position_y?: number;
  price: number;
  capacity?: number;
  includes?: { bottles?: number; bar_vouchers?: number; extras?: string[] };
  bottle_count?: number;
  voucher_count?: number;
  extras?: string[];
};

export type EventTypeOption = {
  id: string;
  slug: string;
  name: string;
  icon?: string | null;
};

export type CountryOption = {
  code: string;
  name: string;
  flag_emoji?: string;
};

export type EventCategory = {
  id: string;
  slug: string;
  name: string;
  icon?: string | null;
  display_order: number;
  is_active: boolean;
};

export type HomeBanner = {
  id: string;
  title: string;
  subtitle?: string | null;
  image_url: string;
  is_active: boolean;
  display_order: number;
};

export type SupportFaq = {
  id: string;
  question_en: string;
  answer_en: string;
  is_active: boolean;
};

export type ProducerInvitationStats = {
  total_sent: number;
  accepted_count: number;
  pending_count: number;
  charged_count: number;
  failed_charge_count: number;
  revenue_from_charges: number;
  revenue_currency: string;
};

export type ProducerInvitation = {
  id: string;
  event_title: string;
  recipient_phone?: string;
  recipient_name?: string | null;
  invitation_type: string;
  lifecycle_state: string;
  status: string;
  slot_label?: string;
};

export type Pagination = {
  page: number;
  total: number;
  total_pages: number;
};

export type EventInvitationSettings = {
  event_id?: string;
  allow_free: boolean;
  allow_guaranteed: boolean;
  allow_discount: boolean;
  free_cancellation_days: number;
  guaranteed_cancellation_days: number;
  discount_cancellation_days: number;
  discount_percentage: number | null;
  enable_waiting_list?: boolean;
  enable_manual_reinvitation?: boolean;
  waitlist_offer_hours?: number;
  courtesy_slots_total?: number;
  updated_at?: string;
};

export type CreateInvitationBody = {
  event_id: string;
  type: 'free' | 'guaranteed' | 'discounted';
  recipient_user_id: string;
  slot_label: string;
  cancellation_deadline_days?: number;
  discount_percentage?: number;
  personalised_message?: string;
};

export type EventWaitlistDashboard = {
  event_id: string;
  event_title: string;
  event_starts_at: string;
  settings: {
    enable_waiting_list: boolean;
    enable_manual_reinvitation: boolean;
    waitlist_offer_hours: number;
    courtesy_slots_total: number;
    courtesy_slots_full: boolean;
  };
  total_waiting: number;
  offer_hours: number;
  active_offer: {
    offer_id: string;
    guest_name: string | null;
    guest_phone: string | null;
    expires_at: string;
    expires_in_label?: string;
  } | null;
  queue: Array<{
    position: number;
    entry_id: string;
    guest_name: string;
    guest_phone: string;
    status: string;
    joined_at: string;
  }>;
  offer_history: Array<{
    offer_id: string;
    guest_name: string | null;
    guest_phone: string | null;
    status: string;
    offered_at: string;
    expires_at: string;
    claimed_at: string | null;
    expired_at: string | null;
  }>;
};
