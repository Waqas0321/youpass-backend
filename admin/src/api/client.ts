import { API_BASE_URL, tunnelRequestHeaders } from '../config';

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
    ...tunnelRequestHeaders(),
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
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

export async function uploadAdminImageRequest(
  file: File,
  folder: string,
): Promise<ApiResult<{ url: string; folder: string }>> {
  const session = getSession();
  if (!session) {
    return { ok: false, status: 401, error: 'Not signed in' };
  }

  const formData = new FormData();
  formData.append('image', file);
  formData.append('folder', folder);

  const response = await fetch(`${API_BASE_URL}/admin/uploads/image`, {
    method: 'POST',
    headers: {
      'x-admin-key': session.apiKey,
      'x-admin-api-key': session.apiKey,
      ...(session.producerId ? { 'x-producer-id': session.producerId } : {}),
    },
    body: formData,
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
    data: payload.data as { url: string; folder: string },
  };
}

export async function uploadAdminVideoRequest(
  file: File,
  folder: string,
): Promise<ApiResult<{ url: string; folder: string }>> {
  const session = getSession();
  if (!session) {
    return { ok: false, status: 401, error: 'Not signed in' };
  }

  const formData = new FormData();
  formData.append('video', file);
  formData.append('folder', folder);

  const response = await fetch(`${API_BASE_URL}/admin/uploads/video`, {
    method: 'POST',
    headers: {
      'x-admin-key': session.apiKey,
      'x-admin-api-key': session.apiKey,
      ...(session.producerId ? { 'x-producer-id': session.producerId } : {}),
    },
    body: formData,
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
    data: payload.data as { url: string; folder: string },
  };
}

/** Must match backend `CLOUDINARY_*_FOLDER` defaults in `.env.example`. */
export const DRINK_PRODUCT_UPLOAD_FOLDER = 'youpass/drink-products';
export const EVENT_IMAGE_UPLOAD_FOLDER = 'youpass/event-images';
export const TICKET_IMAGE_UPLOAD_FOLDER = 'youpass/ticket-images';
export const VENUE_LAYOUT_UPLOAD_FOLDER = 'youpass/venue-layouts';

export const adminApi = {
  overview: () => apiRequest<Record<string, number>>('/admin/overview'),
  producers: () => apiRequest<{ producers: Producer[] }>('/admin/producers'),
  createProducer: (body: ProducerInput) =>
    apiRequest<Producer>('/admin/producers', { method: 'POST', body: JSON.stringify(body) }),
  updateProducer: (producerId: string, body: Partial<ProducerInput>) =>
    apiRequest<Producer>(`/admin/producers/${producerId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  users: () => apiRequest<{ users: AdminUser[] }>('/admin/users'),
  events: () =>
    apiRequest<{ events: AdminEvent[]; summary?: AdminEventsListSummary }>('/admin/events'),
  createEvent: (body: AdminEventInput) =>
    apiRequest<AdminEvent>('/admin/events', { method: 'POST', body: JSON.stringify(body) }),
  updateEvent: (eventId: string, body: Partial<AdminEventInput>) =>
    apiRequest<AdminEvent>(`/admin/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  eventSalesStatus: (eventId: string) =>
    apiRequest<AdminEventSalesStatus>(`/admin/events/${eventId}/sales`),
  setEventSalesPaused: (eventId: string, salesPaused: boolean) =>
    apiRequest<AdminEventSalesStatus>(`/admin/events/${eventId}/sales`, {
      method: 'PATCH',
      body: JSON.stringify({ sales_paused: salesPaused }),
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
  producerInvitations: (
    producerId: string,
    options: {
      page?: number;
      pageSize?: number;
      eventId?: string;
      search?: string;
      status?: string;
    } = {},
  ) => {
    const query = new URLSearchParams({
      page: String(options.page ?? 1),
      page_size: String(options.pageSize ?? 10),
    });
    if (options.eventId) {
      query.set('event_id', options.eventId);
    }
    if (options.search) {
      query.set('search', options.search);
    }
    if (options.status) {
      query.set('status', options.status);
    }
    return apiRequest<{ invitations: ProducerInvitation[]; pagination: Pagination }>(
      `/producer/invitations?${query.toString()}`,
      {},
      producerId,
    );
  },
  producerAlerts: (producerId: string) =>
    apiRequest('/producer/invitations/alerts', {}, producerId),
  createInvitation: (producerId: string, body: CreateInvitationBody) =>
    apiRequest('/producer/invitations', { method: 'POST', body: JSON.stringify(body) }, producerId),
  updateInvitation: (producerId: string, invitationId: string, body: UpdateInvitationBody) =>
    apiRequest<ProducerInvitation>(
      `/producer/invitations/${invitationId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
      producerId,
    ),
  resendInvitation: (producerId: string, invitationId: string) =>
    apiRequest<ProducerInvitation>(
      `/producer/invitations/${invitationId}/resend`,
      { method: 'POST', body: '{}' },
      producerId,
    ),
  revokeInvitation: (producerId: string, invitationId: string) =>
    apiRequest<{ revoked: boolean; id: string }>(
      `/producer/invitations/${invitationId}`,
      { method: 'DELETE' },
      producerId,
    ),
  producerSuggestedCandidates: (producerId: string, eventId?: string, limit = 50) => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (eventId) {
      query.set('event_id', eventId);
    }
    return apiRequest<{ candidates: ProducerSuggestedCandidate[] }>(
      `/producer/invitations/suggested-candidates?${query.toString()}`,
      {},
      producerId,
    );
  },
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
  eventVipTables: (eventId: string) =>
    apiRequest<AdminVipTablesList>(`/admin/events/${eventId}/vip-tables`),
  ensureEventVipLayout: (eventId: string) =>
    apiRequest<AdminVipTablesList>(`/admin/events/${eventId}/vip-tables/ensure-layout`, {
      method: 'POST',
      body: '{}',
    }),
  eventVipTableGuests: (eventId: string, tableId: string) =>
    apiRequest<AdminVipTableGuestsResponse>(
      `/admin/events/${eventId}/vip-tables/${tableId}/guests`,
    ),
  eventVipTableAction: (eventId: string, tableId: string, action: AdminVipTableAction) =>
    apiRequest<AdminVipTablesList>(`/admin/events/${eventId}/vip-tables/${tableId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  moveEventVipTable: (eventId: string, tableId: string, zoneId: string) =>
    apiRequest<AdminVipTablesList>(`/admin/events/${eventId}/vip-tables/${tableId}/move`, {
      method: 'POST',
      body: JSON.stringify({ zone_id: zoneId }),
    }),
  editEventVipTable: (
    eventId: string,
    tableId: string,
    body: AdminVipTableEditInput,
  ) =>
    apiRequest<AdminVipTablesList>(`/admin/events/${eventId}/vip-tables/${tableId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  cancelEventVipTableGuest: (eventId: string, tableId: string, slotId: string) =>
    apiRequest<AdminVipTableGuestsResponse>(
      `/admin/events/${eventId}/vip-tables/${tableId}/guests/${slotId}`,
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
  eventDashboard: (eventId: string) =>
    apiRequest<AdminEventDashboard>(`/admin/events/${eventId}/dashboard`),
  eventDashboardHourlySales: (eventId: string, period: DashboardSalesPeriod = 'today') =>
    apiRequest<AdminDashboardHourlySales>(
      `/admin/events/${eventId}/dashboard/hourly-ticket-sales?period=${period}`,
    ),
  eventDashboardPanels: (eventId: string, period: DashboardSalesPeriod) =>
    apiRequest<AdminEventDashboardPanels>(`/admin/events/${eventId}/dashboard/panels?period=${period}`),
  eventStaffQr: (eventId: string) =>
    apiRequest<AdminEventStaffQrDashboard>(`/admin/events/${eventId}/staff-qr`),
  eventStaffQrScans: (eventId: string, page = 1, limit = 20) =>
    apiRequest<AdminEventStaffQrScanList>(
      `/admin/events/${eventId}/staff-qr/scans?page=${page}&limit=${limit}`,
    ),
  listStaff: () => apiRequest<AdminStaffListResponse>('/admin/staff'),
  createStaff: (body: AdminCreateStaffInput) =>
    apiRequest<AdminStaffQrResponse>('/admin/staff', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateStaff: (staffId: string, body: AdminUpdateStaffInput) =>
    apiRequest<AdminStaffMember>(`/admin/staff/${staffId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  resetStaffQr: (staffId: string) =>
    apiRequest<AdminStaffQrResponse>(`/admin/staff/${staffId}/reset-qr`, {
      method: 'POST',
      body: '{}',
    }),
  getSupervisorPin: (staffId: string) =>
    apiRequest<AdminStaffSupervisorPinResponse>(`/admin/staff/${staffId}/supervisor-pin`),
  resetSupervisorPin: (staffId: string) =>
    apiRequest<AdminStaffSupervisorPinResponse>(`/admin/staff/${staffId}/reset-supervisor-pin`, {
      method: 'POST',
      body: '{}',
    }),
  deleteStaff: (staffId: string) =>
    apiRequest<{ id: string; deleted: boolean }>(`/admin/staff/${staffId}`, {
      method: 'DELETE',
    }),
  createStaffRole: (body: { label: string; color?: string }) =>
    apiRequest<AdminStaffRole>('/admin/staff/roles', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createStaffZone: (body: { label: string }) =>
    apiRequest<{ id: string; label: string }>('/admin/staff/zones', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  eventDrinkCategories: (eventId: string) =>
    apiRequest<{ event_id: string; currency: string; categories: EventDrinkCategory[] }>(
      `/admin/events/${eventId}/drink-categories`,
    ),
  createEventDrinkCategory: (eventId: string, body: EventDrinkCategoryInput) =>
    apiRequest<EventDrinkCategory>(`/admin/events/${eventId}/drink-categories`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateEventDrinkCategory: (
    eventId: string,
    categoryId: string,
    body: Partial<EventDrinkCategoryInput>,
  ) =>
    apiRequest<EventDrinkCategory>(`/admin/events/${eventId}/drink-categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteEventDrinkCategory: (eventId: string, categoryId: string) =>
    apiRequest<{ deleted: boolean }>(`/admin/events/${eventId}/drink-categories/${categoryId}`, {
      method: 'DELETE',
    }),
  eventDrinkProducts: (eventId: string, category?: string) => {
    const query = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
    return apiRequest<{ event_id: string; currency: string; products: EventDrinkProduct[] }>(
      `/admin/events/${eventId}/drink-products${query}`,
    );
  },
  createEventDrinkProduct: (eventId: string, body: EventDrinkProductInput) =>
    apiRequest<EventDrinkProduct>(`/admin/events/${eventId}/drink-products`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateEventDrinkProduct: (
    eventId: string,
    productId: string,
    body: Partial<EventDrinkProductInput>,
  ) =>
    apiRequest<EventDrinkProduct>(`/admin/events/${eventId}/drink-products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  duplicateEventDrinkProduct: (eventId: string, productId: string) =>
    apiRequest<EventDrinkProduct>(
      `/admin/events/${eventId}/drink-products/${productId}/duplicate`,
      { method: 'POST', body: '{}' },
    ),
  deleteEventDrinkProduct: (eventId: string, productId: string) =>
    apiRequest(`/admin/events/${eventId}/drink-products/${productId}`, {
      method: 'DELETE',
    }),
  eventDrinkOrders: (
    eventId: string,
    params?: {
      q?: string;
      page?: number;
      limit?: number;
      product_id?: string;
      qr_status?: AdminDrinkOrderQrStatus;
      date_from?: string;
      date_to?: string;
    },
  ) => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.product_id) query.set('product_id', params.product_id);
    if (params?.qr_status) query.set('qr_status', params.qr_status);
    if (params?.date_from) query.set('date_from', params.date_from);
    if (params?.date_to) query.set('date_to', params.date_to);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<AdminDrinkOrdersListResponse>(
      `/admin/events/${eventId}/drink-orders${suffix}`,
    );
  },
  eventDrinkOrder: (eventId: string, orderId: string) =>
    apiRequest<AdminDrinkOrderDetail>(`/admin/events/${eventId}/drink-orders/${orderId}`),
  reissueEventDrinkOrderQr: (eventId: string, orderId: string) =>
    apiRequest<AdminDrinkOrderDetail>(
      `/admin/events/${eventId}/drink-orders/${orderId}/reissue-qr`,
      { method: 'POST', body: '{}' },
    ),
  refundEventDrinkOrder: (eventId: string, orderId: string) =>
    apiRequest<AdminDrinkOrderDetail>(
      `/admin/events/${eventId}/drink-orders/${orderId}/refund`,
      { method: 'POST', body: '{}' },
    ),
  invalidateEventDrinkOrder: (eventId: string, orderId: string) =>
    apiRequest<AdminDrinkOrderDetail>(
      `/admin/events/${eventId}/drink-orders/${orderId}/invalidate`,
      { method: 'POST', body: '{}' },
    ),
  exportEventDrinkOrders: async (
    eventId: string,
    params?: {
      q?: string;
      product_id?: string;
      qr_status?: AdminDrinkOrderQrStatus;
      date_from?: string;
      date_to?: string;
    },
  ) => {
    const session = getSession();
    if (!session) {
      return { ok: false as const, status: 401, error: 'Not signed in' };
    }
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.product_id) query.set('product_id', params.product_id);
    if (params?.qr_status) query.set('qr_status', params.qr_status);
    if (params?.date_from) query.set('date_from', params.date_from);
    if (params?.date_to) query.set('date_to', params.date_to);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(
      `${API_BASE_URL}/admin/events/${eventId}/drink-orders/export${suffix}`,
      { headers: adminHeaders(session) },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return {
        ok: false as const,
        status: response.status,
        error: payload?.error?.message ?? `Export failed (${response.status})`,
      };
    }
    const blob = await response.blob();
    return { ok: true as const, status: response.status, blob };
  },
  uploadImage: (file: File, folder = DRINK_PRODUCT_UPLOAD_FOLDER) =>
    uploadAdminImageRequest(file, folder),
  uploadVideo: (file: File, folder = EVENT_IMAGE_UPLOAD_FOLDER) =>
    uploadAdminVideoRequest(file, folder),
};

export type Producer = {
  id: string;
  name: string;
  logo_url: string | null;
  type_label?: string | null;
  description?: string | null;
  coverage_label?: string | null;
  follower_count: number;
  created_at?: string;
};

export type ProducerInput = {
  name: string;
  logo_url?: string | null;
  type_label?: string | null;
  description?: string | null;
  coverage_label?: string | null;
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
  ends_at?: string | null;
  starts_at_display?: string;
  starts_at_short?: string;
  starts_at_time?: string;
  ends_at_time?: string | null;
  date_time_display?: string;
  location_display?: string;
  address_line?: string | null;
  image_url?: string | null;
  logo_url?: string | null;
  teaser_video_url?: string | null;
  carousel_images?: string[];
  floor_plan_image_url?: string | null;
  min_age?: number | null;
  dress_code?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  sponsors?: Array<{ id: string; label: string; tone: string; logo_url?: string | null }>;
  social_links?: Array<{
    id: string;
    platform: 'instagram' | 'facebook' | 'tiktok' | 'other';
    handle: string;
  }>;
  producer_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: 'draft' | 'published' | 'cancelled';
  sales_paused?: boolean;
  is_featured?: boolean;
  featured_order?: number;
  event_type?: { id: string; slug: string; name: string; icon?: string | null };
  ticket_order_count?: number;
  drink_order_count?: number;
  tickets_sold?: number;
  total_revenue_clp?: number;
  revenue_delta_pct?: number;
  currency_code?: string;
  capacity_total?: number | null;
  capacity_available?: number | null;
  created_at?: string;
};

export type AdminEventsListSummary = {
  total_events: number;
  created_this_month: number;
};

export type AdminEventSalesStatus = {
  event_id: string;
  sales_paused: boolean;
  status: 'draft' | 'published' | 'cancelled';
};

export type AdminEventInput = {
  title: string;
  description?: string;
  starts_at: string;
  ends_at?: string;
  venue_id?: string;
  venue_name?: string;
  city?: string;
  address_line?: string;
  country_code?: string;
  image_url?: string;
  logo_url?: string;
  teaser_video_url?: string;
  carousel_images?: string[];
  floor_plan_image_url?: string | null;
  min_age?: number;
  dress_code?: string;
  primary_color?: string;
  secondary_color?: string;
  sponsors?: Array<{ id: string; label: string; tone: string; logo_url?: string }>;
  social_links?: Array<{
    id: string;
    platform: 'instagram' | 'facebook' | 'tiktok' | 'other';
    handle: string;
  }>;
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

export type AdminVipTableAction = 'reserve' | 'release' | 'block' | 'unblock';

export type AdminVipTableRow = {
  table_id: string;
  zone_id: string;
  zone_external_id: string;
  zone_name: string;
  zone_color: string;
  number: number;
  label: string;
  capacity: number;
  status: 'available' | 'reserved' | 'paid' | 'blocked';
  backend_status: 'available' | 'locked' | 'reserved' | 'sold';
  price: number;
  currency: string;
  buyer: {
    user_id: string | null;
    name: string;
    phone: string;
    avatar_initials: string;
    avatar_url: string | null;
  } | null;
};

export type AdminVipTablesList = {
  event_id: string;
  currency: string;
  layout_configured: boolean;
  tables: AdminVipTableRow[];
};

export type AdminVipTableGuest = {
  slot_id: string;
  name: string;
  phone: string;
  entry_status: 'confirmed' | 'sent' | 'rejected' | 'pending';
  slot_status: string;
  slot_number?: number;
};

export type AdminVipTableGuestsResponse = {
  table_id: string;
  zone_name: string;
  number: number;
  capacity: number;
  status: 'available' | 'reserved' | 'paid' | 'blocked';
  buyer: {
    name: string;
    phone: string;
    avatar_initials: string;
    avatar_url: string | null;
  } | null;
  guests: AdminVipTableGuest[];
};

export type AdminVipTableEditInput = {
  number?: number;
  label?: string;
  price?: number;
  capacity?: number;
  status?: 'available' | 'locked' | 'reserved' | 'sold';
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
  event_id?: string;
  event_title: string;
  recipient_phone?: string;
  recipient_name?: string | null;
  recipient_avatar_url?: string | null;
  invitation_type: string;
  type?: string;
  tier?: string;
  lifecycle_state: string;
  lifecycle_label?: string;
  status: string;
  slot_label?: string;
  assigned_slot?: string;
  qr_status?: 'locked' | 'available' | 'redeemed' | 'expired';
  sent_at?: string;
  entry_at?: string | null;
  deep_link?: string;
  custom_message?: string | null;
};

export type ProducerSuggestedCandidate = {
  rank: number;
  guest_name: string;
  guest_phone: string;
  reason: string;
  score: number;
  past_attendance_count: number;
};

export type UpdateInvitationBody = {
  slot_label?: string;
  personalised_message?: string;
  recipient_name?: string;
};

export type Pagination = {
  page: number;
  page_size?: number;
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
  recipient_user_id?: string;
  recipient_phone?: string;
  recipient_name?: string;
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

export type EventDrinkCategory = {
  category_id: string;
  event_id: string;
  slug: string;
  name: string;
  icon: string | null;
  display_order: number;
};

export type EventDrinkCategoryInput = {
  name: string;
  slug?: string;
  icon?: string | null;
  display_order?: number;
};

export type EventDrinkProductStatus = 'available' | 'hidden' | 'sold_out';

export type EventDrinkProduct = {
  product_id: string;
  event_id: string;
  category_id: string | null;
  category_slug: string | null;
  category_name: string | null;
  name: string;
  description: string | null;
  volume_ml: number | null;
  price_clp: number;
  price: number;
  currency: string;
  cost_clp: number | null;
  image_url: string | null;
  stock_total: number | null;
  stock_remaining: number | null;
  status: EventDrinkProductStatus;
  display_order: number;
  is_recommended: boolean;
};

export type EventDrinkProductInput = {
  name: string;
  description?: string | null;
  category_id?: string | null;
  volume_ml?: number | null;
  price_clp: number;
  cost_clp?: number | null;
  image_url?: string | null;
  stock_total?: number | null;
  stock_remaining?: number | null;
  status?: EventDrinkProductStatus;
  display_order?: number;
  is_recommended?: boolean;
};

export type AdminDrinkOrderQrStatus =
  | 'paid'
  | 'pending'
  | 'redeemed'
  | 'refunded'
  | 'invalid';

export type AdminDrinkOrderListItem = {
  order_id: string;
  display_order_id: string;
  user: {
    id: string;
    full_name: string;
    phone: string;
    profile_photo_url: string | null;
    initials: string;
  };
  product_summary: string;
  payment_method: {
    type: 'none';
    label: string;
    brand: string;
    last_four: string | null;
  };
  created_at: string;
  qr_status: AdminDrinkOrderQrStatus;
  total_clp: number;
  currency: string;
  entry_code: string | null;
  status: string;
  line_items: Array<{
    line_id: string;
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price_clp: number;
    line_total_clp: number;
    volume_ml: number | null;
    image_url: string | null;
    entry_code: string | null;
    qr_status: AdminDrinkOrderQrStatus;
    qr_payload: string | null;
  }>;
};

export type AdminDrinkOrderDetail = AdminDrinkOrderListItem & {
  event_id: string;
  event_title: string;
  subtotal_clp: number;
  service_fee_clp: number;
  item_count: number;
};

export type AdminDrinkOrdersListResponse = {
  orders: AdminDrinkOrderListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    from: number;
    to: number;
  };
};

export type AdminEventDashboardKpi = {
  value: number;
  delta_pct: number | null;
  sparkline: number[];
};

export type AdminEventDashboardKpis = {
  tickets_sold: AdminEventDashboardKpi;
  total_revenue: AdminEventDashboardKpi;
  bar_consumption: AdminEventDashboardKpi;
  active_users: AdminEventDashboardKpi;
};

export type AdminEventDashboard = {
  event_id: string;
  currency: string;
  kpis: AdminEventDashboardKpis;
  kpis_by_period?: Record<DashboardSalesPeriod, AdminEventDashboardKpis>;
  hourly_ticket_sales: Array<{ hour: number; value: number }>;
  hourly_ticket_sales_last_24h?: Array<{ hour: number; value: number }>;
  hourly_ticket_sales_by_period: Record<
    DashboardSalesPeriod,
    Array<{ hour: number; value: number }>
  >;
  hourly_revenue?: Array<{ hour: number; value: number }>;
  hourly_revenue_by_period?: Record<DashboardSalesPeriod, Array<{ hour: number; value: number }>>;
  top_bar_items: AdminDashboardTopBarItem[];
  top_bar_items_by_period?: Record<DashboardSalesPeriod, AdminDashboardTopBarItem[]>;
  tickets_by_category: AdminDashboardTicketCategory[];
  tickets_by_category_by_period?: Record<DashboardSalesPeriod, AdminDashboardTicketCategory[]>;
  consumption_by_category?: AdminDashboardSlice[];
  consumption_by_category_by_period?: Record<DashboardSalesPeriod, AdminDashboardSlice[]>;
  revenue_by_zone?: AdminDashboardZoneRevenue[];
  revenue_by_zone_by_period?: Record<DashboardSalesPeriod, AdminDashboardZoneRevenue[]>;
  top_spenders?: AdminDashboardTopSpender[];
  top_spenders_by_period?: Record<DashboardSalesPeriod, AdminDashboardTopSpender[]>;
  behavior_insights?: AdminDashboardBehaviorInsights;
  behavior_insights_by_period?: Record<DashboardSalesPeriod, AdminDashboardBehaviorInsights>;
  recent_activity: AdminDashboardActivity[];
  recent_activity_by_period?: Record<DashboardSalesPeriod, AdminDashboardActivity[]>;
};

export type AdminEventDashboardPanels = {
  event_id: string;
  period: DashboardSalesPeriod;
  top_bar_items: AdminDashboardTopBarItem[];
  tickets_by_category: AdminDashboardTicketCategory[];
  recent_activity: AdminDashboardActivity[];
};

export type AdminDashboardTopBarItem = {
  product_id: string | null;
  name: string;
  count: number;
};

export type AdminDashboardTicketCategory = {
  offering_id: string | null;
  type: string;
  label: string;
  count: number;
};

export type AdminDashboardSlice = {
  label: string;
  value: number;
};

export type AdminDashboardZoneRevenue = {
  zone_id: string;
  label: string;
  value: number;
};

export type AdminDashboardTopSpender = {
  user_id: string;
  name: string;
  purchase_count: number;
  total_spend: number;
};

export type AdminDashboardBehaviorInsights = {
  entry_by_hour: number[];
  consumption_by_hour: number[];
  peak_entry_hour: number | null;
  peak_consumption_hour: number | null;
  recurring_users: number;
  recurring_share_pct: number;
  social_conversion_pct: number | null;
};

export type AdminDashboardActivity = {
  id: string;
  kind: 'ticket_purchase' | 'drink_purchase' | 'drink_redemption' | 'ticket_redemption' | 'table_assigned';
  occurred_at: string;
  actor_name: string;
  product_name?: string;
  quantity?: number;
  offering_name?: string;
  table_label?: string;
  zone_name?: string;
  subtitle?: string;
};

export type DashboardSalesPeriod = 'today' | 'yesterday' | 'last_7_days' | 'all_time';

export type AdminDashboardHourlySales = {
  event_id: string;
  period: DashboardSalesPeriod;
  timezone: string;
  hourly_ticket_sales: Array<{ hour: number; value: number }>;
};

export type AdminStaffRole = {
  id: string;
  slug?: string;
  label: string;
  color: string;
};

export type AdminCreateStaffInput = {
  name: string;
  phone: string;
  role_id: string;
  zone: string;
  permission_ids?: string[];
};

export type AdminUpdateStaffInput = {
  status?: 'online' | 'away' | 'paused';
  role_id?: string;
  permission_ids?: string[];
};

export type AdminStaffQrResponse = AdminStaffMember & {
  qr_token?: string | null;
  qr_payload?: string | null;
  qr_image: string;
};

export type AdminStaffSupervisorPinResponse = {
  staff_id: string;
  pin: string;
  updated_at: string;
};

export type AdminStaffListResponse = {
  staff: AdminStaffMember[];
  roles: AdminStaffRole[];
  zones: string[];
  total: number;
};

export type AdminStaffPermission = {
  id: string;
  label: string;
  enabled: boolean;
};

export type AdminStaffMember = {
  id: string;
  name: string;
  phone: string;
  role_id: string;
  zone: string;
  status: 'online' | 'away' | 'paused';
  last_activity_at: string;
  permission_ids: string[];
  qr_payload?: string | null;
  has_supervisor_pin?: boolean;
};

export type AdminEventStaffQrDashboard = {
  event_id: string;
  event_title: string;
  fetched_at?: string;
  roles: AdminStaffRole[];
  permissions: AdminStaffPermission[];
  summary: {
    active_staff: number;
    zones_assigned: number;
    scans_today: number;
    qr_efficiency_pct: number;
    invalid_qr_today: number;
    invalid_qr_share_pct?: number;
  };
  staff: AdminStaffMember[];
  staff_total: number;
  qr_live: AdminEventStaffQrScanItem[];
  top_bar: {
    name: string;
    scans: number;
    share_pct: number;
  } | null;
  activity_by_zone: Array<{ zone: string; count: number }>;
};

export type AdminEventStaffQrScanItem = {
  id: string;
  time_label: string;
  staff_name: string;
  detail: string;
  zone: string;
  kind: 'drink' | 'ticket';
  outcome: string;
  occurred_at: string;
};

export type AdminEventStaffQrScanList = {
  event_id: string;
  page: number;
  limit: number;
  total: number;
  scans: AdminEventStaffQrScanItem[];
};
