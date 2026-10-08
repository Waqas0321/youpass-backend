import type { StaffMember } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { deriveStaffOfflineSigningSecret, verifyOfflineScanHmac } from './staff-offline-hmac.js';
import { staffScanService } from './staff-scan.service.js';
import type { StaffScanSyncInput, StaffScanSyncItem } from './staff-scan.validators.js';

const MAX_SKEW_MS = 24 * 60 * 60 * 1000;

type SyncItemResult = {
  client_scan_id: string;
  status: 'applied' | 'already_used' | 'rejected' | 'duplicate_client_id';
  error_code?: string;
  error_message?: string;
  scan?: Awaited<ReturnType<typeof staffScanService.scanEntry>>;
};

function assertPermissionForScanType(staffMember: StaffMember, scanType: 'entry' | 'product') {
  const granted = new Set(staffMember.permissionIds ?? []);
  const required =
    scanType === 'product'
      ? (['scan_products', 'bar_supervisor', 'general_admin'] as const)
      : (['scan_tickets', 'tickets_supervisor', 'general_admin'] as const);

  if (!required.some((id) => granted.has(id))) {
    throw new AppError(
      403,
      'STAFF_PERMISSION_DENIED',
      'You do not have permission to sync this scan type',
    );
  }
}

async function applyOne(
  staffMember: StaffMember,
  sessionId: string,
  deviceId: string,
  item: StaffScanSyncItem,
): Promise<SyncItemResult> {
  const existing = await prisma.staffScanLog.findFirst({
    where: { clientScanId: item.client_scan_id },
  });
  if (existing) {
    return {
      client_scan_id: item.client_scan_id,
      status: 'duplicate_client_id',
    };
  }

  const signingSecret = deriveStaffOfflineSigningSecret(staffMember.id, sessionId);
  const hmacOk = verifyOfflineScanHmac(
    signingSecret,
    {
      clientScanId: item.client_scan_id,
      scanType: item.scan_type,
      qrPayload: item.qr_payload,
      scannedAt: item.scanned_at,
      deviceId,
    },
    item.hmac,
  );

  if (!hmacOk) {
    return {
      client_scan_id: item.client_scan_id,
      status: 'rejected',
      error_code: 'HMAC_INVALID',
      error_message: 'Scan signature is invalid',
    };
  }

  const scannedAt = new Date(item.scanned_at);
  if (Number.isNaN(scannedAt.getTime())) {
    return {
      client_scan_id: item.client_scan_id,
      status: 'rejected',
      error_code: 'INVALID_SCANNED_AT',
      error_message: 'scanned_at must be a valid ISO timestamp',
    };
  }

  const skew = Math.abs(Date.now() - scannedAt.getTime());
  if (skew > MAX_SKEW_MS) {
    return {
      client_scan_id: item.client_scan_id,
      status: 'rejected',
      error_code: 'SCAN_TOO_OLD',
      error_message: 'Offline scan is outside the allowed time window',
    };
  }

  try {
    assertPermissionForScanType(staffMember, item.scan_type);

    const scan =
      item.scan_type === 'entry'
        ? await staffScanService.scanEntry(item.qr_payload, staffMember, {
            clientScanId: item.client_scan_id,
            deviceId,
            scannedAt,
            syncedFromOffline: true,
          })
        : await staffScanService.scanProduct(item.qr_payload, staffMember, {
            clientScanId: item.client_scan_id,
            deviceId,
            scannedAt,
            syncedFromOffline: true,
          });

    return {
      client_scan_id: item.client_scan_id,
      status: scan.outcome === 'already_used' ? 'already_used' : 'applied',
      scan,
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        client_scan_id: item.client_scan_id,
        status: 'rejected',
        error_code: err.code,
        error_message: err.message,
      };
    }
    throw err;
  }
}

export const staffScanSyncService = {
  async syncOfflineScans(
    staffMember: StaffMember,
    sessionId: string,
    input: StaffScanSyncInput,
  ) {
    const deviceId = input.device_id.trim();
    const ordered = [...input.scans].sort(
      (a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime(),
    );

    const results: SyncItemResult[] = [];
    for (const item of ordered) {
      results.push(await applyOne(staffMember, sessionId, deviceId, item));
    }

    return {
      synced_count: results.filter((r) => r.status === 'applied' || r.status === 'already_used')
        .length,
      results,
    };
  },
};
