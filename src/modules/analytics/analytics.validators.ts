import { z } from 'zod';

export const registrationCompletedSchema = z.object({
  source: z.enum(['organic', 'invitation', 'shared_link']).optional(),
  invitation_id: z.string().optional(),
  shared_event_id: z.string().optional(),
  time_to_home_ms: z.number().int().nonnegative().optional(),
  client_timestamp: z.string().datetime().optional(),
});

export type RegistrationCompletedInput = z.infer<typeof registrationCompletedSchema>;
