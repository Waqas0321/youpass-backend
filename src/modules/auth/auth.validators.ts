import { z } from 'zod';

export const authCodePurposeSchema = z.enum(['login', 'register', 'change_phone', 'delete_account']);

const recaptchaTokenSchema = z.object({
  recaptcha_token: z.string().min(1).optional(),
});

export const sendCodeSchema = recaptchaTokenSchema.extend({
  phone: z.string().min(6).max(20),
  country_code: z.string().min(2).max(5),
  purpose: authCodePurposeSchema,
});

export const verifyCodeSchema = z.object({
  phone: z.string().min(6).max(20),
  country_code: z.string().min(2).max(5),
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
  purpose: authCodePurposeSchema,
});

export const resendCodeSchema = sendCodeSchema;

export const checkWhatsAppSchema = z.object({
  phone: z.string().min(6).max(20),
  country_code: z.string().min(2).max(5),
});

export const loginSchema = recaptchaTokenSchema.extend({
  phone: z.string().min(6).max(20),
  country_code: z.string().min(2).max(5),
  code: z.string().length(6).regex(/^\d{6}$/),
});

export const registerSchema = recaptchaTokenSchema.extend({
  phone: z.string().min(6).max(20),
  country_code: z.string().min(2).max(5),
  code: z.string().length(6).regex(/^\d{6}$/),
  full_name: z.string().min(2).max(200),
  rut_or_passport: z.string().min(3).max(50),
  email: z.string().email().max(255),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  instagram_username: z.string().max(100).optional(),
  preferred_language: z.enum(['es', 'pt', 'en']).optional(),
  accept_terms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept terms and conditions' }),
  }),
});

export const changePhoneRequestSchema = z.object({
  new_phone: z.string().min(6).max(20),
  new_country_code: z.string().min(2).max(5),
});

export const changePhoneVerifySchema = z.object({
  new_phone: z.string().min(6).max(20),
  new_country_code: z.string().min(2).max(5),
  code: z.string().length(6).regex(/^\d{6}$/),
});

export const deleteAccountVerifySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export type SendCodeInput = z.infer<typeof sendCodeSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePhoneRequestInput = z.infer<typeof changePhoneRequestSchema>;
export type ChangePhoneVerifyInput = z.infer<typeof changePhoneVerifySchema>;
export type DeleteAccountVerifyInput = z.infer<typeof deleteAccountVerifySchema>;
