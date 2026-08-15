import type { Comp } from './eventCompsUtils';

export const COMPS_USE_DEMO_FALLBACK = false;

export function shouldUseDemoComps(_count: number) {
  return false;
}

export function buildDemoComps(_count = 0): Comp[] {
  return [];
}

export const DEMO_COMP_TYPE_COUNTS = {
  general: 0,
  vip: 0,
  backstage: 0,
  open_bar: 0,
  vip_table: 0,
} as const;

export const DEMO_COMP_STATUS_COUNTS = {
  available: 0,
  sent: 0,
  accepted: 0,
  redeemed: 0,
  expired: 0,
  invalidated: 0,
} as const;

export const DEMO_TOTAL_COMPS = 0;
