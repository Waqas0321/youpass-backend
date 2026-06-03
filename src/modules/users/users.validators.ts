import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    full_name: z.string().min(2).max(200).optional(),
    email: z.string().email().max(255).optional(),
    rut_or_passport: z.string().min(3).max(50).optional(),
    birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').optional(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
    instagram_username: z
      .union([z.string().max(100), z.literal(''), z.null()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (value === '' || value === null) return null;
        return value.replace(/^@/, '').trim() || null;
      }),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one profile field is required',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
