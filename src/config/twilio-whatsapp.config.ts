import type { AuthCodePurpose } from '@prisma/client';
import { env } from './env.js';
import { discoverApprovedOtpContentSid } from '../modules/messaging/twilio-content-discovery.service.js';

const SANDBOX_NUMBER = '+14155238886';

function normalizeE164(value: string): string {
  const trimmed = value.trim().replace(/^whatsapp:/, '');
  if (!trimmed) return '';
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

export function resolveTwilioMockFlag(
  raw: string | undefined,
  nodeEnv: string,
): boolean {
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return nodeEnv !== 'production';
}

export function hasTwilioWhatsAppCredentials(): boolean {
  return Boolean(
    env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_WHATSAPP_FROM,
  );
}

export function isWhatsAppSandboxSender(fromE164?: string): boolean {
  const from = normalizeE164(fromE164 ?? env.TWILIO_WHATSAPP_FROM);
  return from === SANDBOX_NUMBER;
}

/** Production = live Twilio + a non-sandbox WhatsApp sender. */
export function isProductionWhatsAppMode(): boolean {
  return !env.TWILIO_MOCK && hasTwilioWhatsAppCredentials() && !isWhatsAppSandboxSender();
}

export function otpContentSidForPurpose(purpose: AuthCodePurpose): string {
  const byPurpose: Record<AuthCodePurpose, string> = {
    login: env.TWILIO_WHATSAPP_TEMPLATE_LOGIN_SID,
    register: env.TWILIO_WHATSAPP_TEMPLATE_REGISTER_SID,
    change_phone: env.TWILIO_WHATSAPP_TEMPLATE_PHONE_CHANGE_SID,
    delete_account: env.TWILIO_WHATSAPP_TEMPLATE_DELETE_ACCOUNT_SID,
  };
  return (byPurpose[purpose] || env.TWILIO_WHATSAPP_OTP_CONTENT_SID).trim();
}

export async function resolveOtpContentSid(purpose: AuthCodePurpose): Promise<string> {
  const configured = otpContentSidForPurpose(purpose);
  if (configured) {
    return configured;
  }
  return (await discoverApprovedOtpContentSid()) ?? '';
}

export function invitationContentSid(): string {
  return (
    env.TWILIO_WHATSAPP_INVITATION_CONTENT_SID.trim() ||
    env.TWILIO_WHATSAPP_OTP_CONTENT_SID.trim()
  );
}

export type TwilioConfigIssue = {
  level: 'error' | 'warn';
  message: string;
};

export function collectTwilioWhatsAppConfigIssues(): TwilioConfigIssue[] {
  const issues: TwilioConfigIssue[] = [];

  if (env.TWILIO_MOCK) {
    issues.push({
      level: 'warn',
      message:
        'TWILIO_MOCK=true — OTP codes are not sent via WhatsApp. Set TWILIO_MOCK=false for live delivery.',
    });
    return issues;
  }

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    issues.push({
      level: 'error',
      message: 'Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN.',
    });
  }

  if (!env.TWILIO_WHATSAPP_FROM) {
    issues.push({
      level: 'error',
      message: 'Missing TWILIO_WHATSAPP_FROM (your Twilio WhatsApp sender in E.164).',
    });
  }

  if (isWhatsAppSandboxSender()) {
    issues.push({
      level: 'warn',
      message:
        'TWILIO_WHATSAPP_FROM is the Twilio sandbox (+14155238886). Recipients must join the sandbox. Use your Meta-linked production sender for all numbers.',
    });
    return issues;
  }

  if (!otpContentSidForPurpose('login')) {
    issues.push({
      level: 'error',
      message:
        'Production WhatsApp sender requires approved templates. Set TWILIO_WHATSAPP_OTP_CONTENT_SID (and optional per-purpose SIDs).',
    });
  }

  if (!invitationContentSid()) {
    issues.push({
      level: 'warn',
      message:
        'TWILIO_WHATSAPP_INVITATION_CONTENT_SID is not set — guest ticket invites may fail on production WhatsApp.',
    });
  }

  return issues;
}

let startupLogged = false;

export function logTwilioWhatsAppStartupSummary(): void {
  if (startupLogged) return;
  startupLogged = true;

  const mode = env.TWILIO_MOCK
    ? 'MOCK'
    : isProductionWhatsAppMode()
      ? 'LIVE (production sender + templates)'
      : isWhatsAppSandboxSender()
        ? 'LIVE (sandbox sender)'
        : 'LIVE (credentials incomplete)';

  console.log(
    `[Twilio WhatsApp] mode=${mode} from=${env.TWILIO_WHATSAPP_FROM || '(not set)'} mock=${env.TWILIO_MOCK}`,
  );

  for (const issue of collectTwilioWhatsAppConfigIssues()) {
    console.log(`[Twilio WhatsApp] ${issue.level.toUpperCase()}: ${issue.message}`);
  }
}

export async function assertProductionOtpTemplateConfigured(
  purpose: AuthCodePurpose,
): Promise<void> {
  if (env.TWILIO_MOCK || isWhatsAppSandboxSender()) {
    return;
  }

  const contentSid = await resolveOtpContentSid(purpose);
  if (!contentSid) {
    throw new Error(
      'No approved WhatsApp OTP template found. Create an Authentication template in Twilio Content Template Builder ' +
        '(https://console.twilio.com/us1/develop/sms/content-template-builder), get it approved by Meta, ' +
        'then set TWILIO_WHATSAPP_OTP_CONTENT_SID in Vercel.',
    );
  }
}

export function assertProductionInvitationTemplateConfigured(): void {
  if (env.TWILIO_MOCK || isWhatsAppSandboxSender()) {
    return;
  }

  if (!invitationContentSid()) {
    throw new Error(
      'TWILIO_WHATSAPP_INVITATION_CONTENT_SID is required for guest invitations on production WhatsApp.',
    );
  }
}
