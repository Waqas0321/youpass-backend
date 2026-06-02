import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api/v1'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('365d'),
  OTP_LENGTH: z.coerce.number().default(6),
  OTP_TTL_MINUTES: z.coerce.number().default(3),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(60),
  OTP_MAX_RESENDS_PER_HOUR: z.coerce.number().default(5),
  OTP_MAX_FAILED_ATTEMPTS: z.coerce.number().default(3),
  OTP_BLOCK_MINUTES: z.coerce.number().default(15),
  OTP_DELIVERY_CHANNEL: z.enum(['sms', 'whatsapp']).default('whatsapp'),
  TWILIO_ACCOUNT_SID: z.string().optional().default('').transform((v) => v.trim()),
  TWILIO_AUTH_TOKEN: z.string().optional().default('').transform((v) => v.trim()),
  TWILIO_SMS_FROM: z.string().optional().default('').transform((v) => v.trim()),
  TWILIO_WHATSAPP_FROM: z.string().optional().default('').transform((v) => v.trim()),
  TWILIO_MOCK: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  MIN_AGE_YEARS: z.coerce.number().default(18),
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
