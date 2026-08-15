import { z } from 'zod';

export const staffScanQrSchema = z.object({
  qr_payload: z.string().trim().min(4).max(512),
});

export const staffScanRecentQuerySchema = z.object({
  scan_type: z.enum(['entry', 'product']).default('product'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type StaffScanRecentQuery = z.infer<typeof staffScanRecentQuerySchema>;
