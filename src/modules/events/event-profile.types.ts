export type EventSponsor = {
  id: string;
  label: string;
  tone: string;
  logo_url?: string;
};

export type EventSocialLink = {
  id: string;
  platform: 'instagram' | 'facebook' | 'tiktok' | 'other';
  handle: string;
};

export function parseEventSponsors(value: unknown): EventSponsor[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id : '';
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      const tone = typeof record.tone === 'string' ? record.tone : '#333333';
      const logoUrl =
        typeof record.logo_url === 'string'
          ? record.logo_url
          : typeof record.logoUrl === 'string'
            ? record.logoUrl
            : undefined;
      if (!id || !label) {
        return null;
      }
      const sponsor: EventSponsor = { id, label, tone };
      if (logoUrl) {
        sponsor.logo_url = logoUrl;
      }
      return sponsor;
    })
    .filter((item): item is EventSponsor => item !== null);
}

export function parseEventSocialLinks(value: unknown): EventSocialLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id : '';
      const handle = typeof record.handle === 'string' ? record.handle.trim() : '';
      const platformRaw = typeof record.platform === 'string' ? record.platform : 'other';
      const platform =
        platformRaw === 'instagram' ||
        platformRaw === 'facebook' ||
        platformRaw === 'tiktok' ||
        platformRaw === 'other'
          ? platformRaw
          : 'other';
      if (!id || !handle) {
        return null;
      }
      return { id, platform, handle };
    })
    .filter((item): item is EventSocialLink => item !== null);
}

export function formatEventSponsors(sponsors: EventSponsor[]) {
  return sponsors.map((sponsor) => ({
    id: sponsor.id,
    label: sponsor.label,
    tone: sponsor.tone,
    logo_url: sponsor.logo_url ?? null,
  }));
}

export function formatEventSocialLinks(links: EventSocialLink[]) {
  return links.map((link) => ({
    id: link.id,
    platform: link.platform,
    handle: link.handle,
  }));
}
