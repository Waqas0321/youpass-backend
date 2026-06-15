import { z } from 'zod';

export const updateInvitationConfigSchema = z.object({
  expiry_days: z.number().int().min(1).max(30).optional(),
});

export type UpdateInvitationConfigInput = z.infer<typeof updateInvitationConfigSchema>;
