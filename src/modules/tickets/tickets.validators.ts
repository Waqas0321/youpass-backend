import { z } from 'zod';

export const listPastTicketsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  event_type: z.enum(['parties', 'concerts', 'bar']).optional(),
  status: z.enum(['attended', 'not_attended', 'cancelled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const listUpcomingTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListPastTicketsQuery = z.infer<typeof listPastTicketsQuerySchema>;
export type ListUpcomingTicketsQuery = z.infer<typeof listUpcomingTicketsQuerySchema>;
