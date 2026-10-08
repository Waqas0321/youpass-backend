import { z } from 'zod';

export const staffScanQrSchema = z.object({
  qr_payload: z.string().trim().min(4).max(512),
});

export const staffScanRecentQuerySchema = z.object({
  scan_type: z.enum(['entry', 'product']).default('product'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const staffScanSyncItemSchema = z.object({
  client_scan_id: z.string().trim().min(8).max(80),
  scan_type: z.enum(['entry', 'product']),
  qr_payload: z.string().trim().min(4).max(512),
  scanned_at: z.string().trim().min(10).max(40),
  hmac: z.string().trim().min(32).max(128),
});

export const staffScanSyncSchema = z.object({
  device_id: z.string().trim().min(8).max(80),
  event_id: z.string().trim().min(1).max(64).optional(),
  scans: z.array(staffScanSyncItemSchema).min(1).max(100),
});

export type StaffScanRecentQuery = z.infer<typeof staffScanRecentQuerySchema>;
export type StaffScanSyncInput = z.infer<typeof staffScanSyncSchema>;
export type StaffScanSyncItem = z.infer<typeof staffScanSyncItemSchema>;
