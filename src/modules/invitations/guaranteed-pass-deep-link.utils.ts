import { env } from '../../config/env.js';

export function buildInvitationDeepLink(invitationId: string): string {
  const base = env.APP_DEEP_LINK_BASE.replace(/\/$/, '');
  return `${base}/${invitationId}`;
}
