import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api/v1'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('365d'),
  /** When true (default), sessions stay valid until manual logout. */
  JWT_SESSION_INDEFINITE: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  OTP_LENGTH: z.coerce.number().default(6),
  OTP_TTL_MINUTES: z.coerce.number().default(3),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(60),
  OTP_MAX_RESENDS_PER_HOUR: z.coerce.number().default(5),
  OTP_MAX_FAILED_ATTEMPTS: z.coerce.number().default(3),
  OTP_BLOCK_MINUTES: z.coerce.number().default(15),
  OTP_DELIVERY_CHANNEL: z
    .enum(['sms', 'whatsapp'])
    .default('whatsapp')
    .transform(() => 'whatsapp' as const),
  RECAPTCHA_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  RECAPTCHA_SECRET_KEY: z.string().optional().default('').transform((v) => v.trim()),
  RECAPTCHA_SITE_KEY: z.string().optional().default('').transform((v) => v.trim()),
  RECAPTCHA_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.5),
  ALLOW_LEGACY_CARD_INPUT: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  TWILIO_ACCOUNT_SID: z.string().optional().default('').transform((v) => v.trim()),
  TWILIO_AUTH_TOKEN: z.string().optional().default('').transform((v) => v.trim()),
  TWILIO_SMS_FROM: z.string().optional().default('').transform((v) => v.trim()),
  TWILIO_WHATSAPP_FROM: z.string().optional().default('').transform((v) => v.trim()),
  /** Fallback sandbox sender when production templates are not approved yet (+14155238886). */
  TWILIO_WHATSAPP_SANDBOX_FROM: z
    .string()
    .optional()
    .default('+14155238886')
    .transform((v) => v.trim()),
  TWILIO_MOCK: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  MIN_AGE_YEARS: z.coerce.number().default(18),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default('').transform((v) => v.trim()),
  CLOUDINARY_API_KEY: z.string().optional().default('').transform((v) => v.trim()),
  CLOUDINARY_API_SECRET: z.string().optional().default('').transform((v) => v.trim()),
  CLOUDINARY_PROFILE_FOLDER: z.string().default('youpass/profile-photos'),
  PROFILE_PHOTO_MAX_BYTES: z.coerce.number().default(5 * 1024 * 1024),
  APP_CLAIM_BASE_URL: z.string().default('https://youpass.app/claim'),
  TWILIO_WHATSAPP_INVITATION_CONTENT_SID: z.string().optional().default('').transform((v) => v.trim()),
  /** Optional — reuse OTP WhatsApp template for invitations when invite template not set */
  TWILIO_WHATSAPP_OTP_CONTENT_SID: z.string().optional().default('').transform((v) => v.trim()),
  TWILIO_WHATSAPP_TEMPLATE_LOGIN_SID: z.string().optional().default('').transform((v) => v.trim()),
  TWILIO_WHATSAPP_TEMPLATE_REGISTER_SID: z.string().optional().default('').transform((v) => v.trim()),
  TWILIO_WHATSAPP_TEMPLATE_PHONE_CHANGE_SID: z.string().optional().default('').transform((v) => v.trim()),
  TWILIO_WHATSAPP_TEMPLATE_DELETE_ACCOUNT_SID: z.string().optional().default('').transform((v) => v.trim()),
  CHECKOUT_MOCK_PAYMENT: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  KLAP_API_KEY: z.string().optional().default('').transform((v) => v.trim()),
  KLAP_WEBHOOK_SECRET: z.string().optional().default('').transform((v) => v.trim()),
  KLAP_CHECKOUT_BASE_URL: z.string().optional().default('').transform((v) => v.trim()),
  STRIPE_SECRET_KEY: z.string().optional().default('').transform((v) => v.trim()),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default('').transform((v) => v.trim()),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
