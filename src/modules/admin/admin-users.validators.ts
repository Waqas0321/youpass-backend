import { z } from 'zod';

export const adminUsersListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['active', 'blocked', 'pending_deletion', 'deleted', 'all']).default('all'),
  category: z.enum(['bronze', 'silver', 'gold']).optional(),
  sort: z.enum(['newest', 'oldest', 'name', 'last_active']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminUserUpdateSchema = z
  .object({
    full_name: z.string().trim().min(2).max(200),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().min(6).max(20),
    country_code: z.string().trim().min(2).max(5),
    rut_or_passport: z.string().trim().min(3).max(50),
    birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
    instagram_username: z.string().trim().max(100).nullable(),
    category: z.enum(['bronze', 'silver', 'gold']),
    preferred_language: z.enum(['es', 'en', 'pt']).nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export const adminUserBlockSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type AdminUsersListQuery = z.infer<typeof adminUsersListQuerySchema>;
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;
