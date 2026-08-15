import type { ProducerInvitation } from '../../api/client';

export const INVITATIONS_USE_DEMO_FALLBACK = false;

export function shouldUseDemoInvitations(_count: number, _failed: boolean) {
  return false;
}

export function buildDemoInvitations(_eventId: string): ProducerInvitation[] {
  return [];
}

export const DEMO_LIST_COUNTS = {
  rrpp: 0,
  influencers: 0,
  staff: 0,
  sponsors: 0,
  artists: 0,
  vip: 0,
} as const;

export const DEMO_TOTAL_GUESTS = 0;
