import type { AdminEvent, AdminEventInput } from '../../api/client';

export type EventInfoSponsor = {
  id: string;
  label: string;
  tone: string;
  logo_url?: string;
};

export type EventInfoSocialLink = {
  id: string;
  platform: 'instagram' | 'facebook' | 'tiktok' | 'other';
  handle: string;
};

export const DESCRIPTION_MAX = 500;

export const DEFAULT_EVENT_SPONSORS: EventInfoSponsor[] = [
  { id: 'demo-redbull', label: 'Red Bull', tone: '#1e3264' },
  { id: 'demo-budweiser', label: 'Budweiser', tone: '#c8102e' },
  { id: 'demo-jw', label: 'JW', tone: '#8b5a2b' },
  { id: 'demo-copec', label: 'COPEC', tone: '#00529b' },
];

export const DEFAULT_EVENT_SOCIAL_LINKS: EventInfoSocialLink[] = [
  { id: 'demo-instagram', platform: 'instagram', handle: '@youfest.oficial' },
  { id: 'demo-facebook', platform: 'facebook', handle: 'YouFest' },
  { id: 'demo-tiktok', platform: 'tiktok', handle: '@youfest.oficial' },
];

export const EMPTY_EVENT_FORM: AdminEventInput = {
  title: '',
  description: '',
  starts_at: '',
  venue_name: '',
  city: '',
  country_code: 'CL',
  image_url: '',
  logo_url: '',
  teaser_video_url: '',
  carousel_images: [],
  event_type: 'parties',
  producer_name: '',
  status: 'draft',
  is_featured: false,
  featured_order: 0,
  min_age: 18,
  dress_code: 'casual',
  primary_color: '#F2B705',
  secondary_color: '#7B5FF2',
  sponsors: [],
  social_links: [],
};

export function createEventInfoId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function toDatetimeLocalValue(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function splitDatetimeLocal(value: string) {
  if (!value) {
    return { date: '', time: '' };
  }
  const [date, time = ''] = value.split('T');
  return { date, time };
}

export function mergeDateAndTime(date: string, time: string) {
  if (!date) {
    return '';
  }
  return `${date}T${time || '20:00'}`;
}

export function buildEndsAtIso(startsAtLocal: string, endTime: string) {
  if (!startsAtLocal || !endTime) {
    return undefined;
  }

  const { date } = splitDatetimeLocal(startsAtLocal);
  const start = new Date(startsAtLocal);
  let end = new Date(`${date}T${endTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return undefined;
  }
  if (end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return end.toISOString();
}

export function extractEndTime(endsAtIso: string | null | undefined, startsAtIso: string) {
  if (!endsAtIso) {
    return '05:00';
  }
  const end = new Date(endsAtIso);
  const start = new Date(startsAtIso);
  const pad = (value: number) => String(value).padStart(2, '0');
  if (end.getDate() !== start.getDate() || end.getMonth() !== start.getMonth()) {
    return `${pad(end.getHours())}:${pad(end.getMinutes())}`;
  }
  return `${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

export function buildAddressLine(venue?: string | null, city?: string | null) {
  return [venue, city].filter(Boolean).join(', ');
}

export function parseSponsors(value: AdminEvent['sponsors']): EventInfoSponsor[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => ({
      id: item.id,
      label: item.label,
      tone: item.tone,
      logo_url: item.logo_url ?? undefined,
    }))
    .filter((item) => item.id && item.label);
}

export function parseSocialLinks(value: AdminEvent['social_links']): EventInfoSocialLink[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => ({
      id: item.id,
      platform: item.platform,
      handle: item.handle,
    }))
    .filter((item) => item.id && item.handle);
}

export type EventInfoFormState = {
  form: AdminEventInput;
  addressLine: string;
  endTime: string;
  sponsors: EventInfoSponsor[];
  socialLinks: EventInfoSocialLink[];
};

export function eventToFormState(event: AdminEvent): EventInfoFormState {
  return {
    form: {
      title: event.title,
      description: event.description ?? '',
      starts_at: toDatetimeLocalValue(event.starts_at),
      ends_at: event.ends_at ?? undefined,
      venue_id: event.venue_id ?? undefined,
      venue_name: event.venue_name ?? '',
      city: event.city,
      address_line: event.address_line ?? undefined,
      country_code: event.country_code ?? 'CL',
      image_url: event.image_url ?? '',
      logo_url: event.logo_url ?? '',
      teaser_video_url: event.teaser_video_url ?? '',
      carousel_images: event.carousel_images ?? [],
      event_type: event.event_type?.slug ?? 'parties',
      producer_name: event.producer_name ?? '',
      status: event.status ?? 'draft',
      is_featured: event.is_featured ?? false,
      featured_order: event.featured_order ?? 0,
      min_age: event.min_age ?? 18,
      dress_code: event.dress_code ?? 'casual',
      primary_color: event.primary_color ?? '#F2B705',
      secondary_color: event.secondary_color ?? '#7B5FF2',
      sponsors: parseSponsors(event.sponsors),
      social_links: parseSocialLinks(event.social_links),
    },
    addressLine:
      event.address_line ??
      event.physical_venue?.address ??
      buildAddressLine(event.venue_name, event.city),
    endTime: extractEndTime(event.ends_at, event.starts_at),
    sponsors: parseSponsors(event.sponsors),
    socialLinks: parseSocialLinks(event.social_links),
  };
}

export function buildEventInfoPayload(state: EventInfoFormState): AdminEventInput | null {
  const { form, addressLine, endTime, sponsors, socialLinks } = state;

  if (!form.title.trim() || !form.starts_at) {
    return null;
  }

  const endsAt = buildEndsAtIso(form.starts_at, endTime);

  return {
    ...form,
    title: form.title.trim(),
    venue_name: form.venue_name?.trim(),
    city: form.city?.trim() || 'Santiago',
    address_line: addressLine.trim() || undefined,
    country_code: form.country_code?.toUpperCase(),
    venue_id: form.venue_id || undefined,
    description: form.description?.trim() || undefined,
    image_url: form.image_url?.trim() || undefined,
    logo_url: form.logo_url?.trim() || undefined,
    teaser_video_url: form.teaser_video_url?.trim() || undefined,
    carousel_images: form.carousel_images ?? [],
    starts_at: new Date(form.starts_at).toISOString(),
    ends_at: endsAt,
    min_age: form.min_age ?? 18,
    dress_code: form.dress_code ?? 'casual',
    primary_color: form.primary_color ?? '#F2B705',
    secondary_color: form.secondary_color ?? '#7B5FF2',
    sponsors,
    social_links: socialLinks,
    status: form.status ?? 'draft',
    producer_name: form.producer_name?.trim() || undefined,
  };
}

export function socialPlatformClass(platform: EventInfoSocialLink['platform']) {
  if (platform === 'instagram') return 'event-info__social-icon--instagram';
  if (platform === 'facebook') return 'event-info__social-icon--facebook';
  if (platform === 'tiktok') return 'event-info__social-icon--tiktok';
  return 'event-info__social-icon--other';
}
