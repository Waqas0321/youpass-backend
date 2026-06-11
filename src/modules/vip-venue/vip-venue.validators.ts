import { z } from 'zod';

export const eventIdParamSchema = z.object({
  eventId: z.string().min(1),
});

export const zoneIdParamSchema = z.object({
  eventId: z.string().min(1),
  zoneId: z.string().min(1),
});

export const tableIdParamSchema = z.object({
  eventId: z.string().min(1),
  tableId: z.string().min(1),
});
