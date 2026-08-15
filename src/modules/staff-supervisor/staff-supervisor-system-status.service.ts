import type { Prisma, StaffMember } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { verifyOtp } from '../../common/utils/crypto.js';
import { invitationAuditService } from '../invitations/invitation-audit.service.js';
import { formatTimeLabel } from './staff-supervisor-entry-search.service.js';
import { supervisorOperationalStateService } from './supervisor-operational-state.service.js';
import type {
  StaffSupervisorApplySystemStatusActionInput,
  StaffSupervisorSystemStatusQuery,
} from './staff-supervisor.validators.js';

const SYSTEM_ACTION_PREFIX = 'supervisor_system_';
const ENTRY_SCAN_PERMISSIONS = ['scan_tickets', 'tickets_supervisor', 'general_admin'] as const;
const FLOW_WINDOW_MS = 5 * 60 * 1000;
const SCANNER_SLOW_MS = 2 * 60 * 1000;
const SCANNER_DISCONNECTED_MS = 5 * 60 * 1000;
const VIP_FLOW_SATURATION_THRESHOLD = 12;

type HealthStatus = 'online' | 'slow' | 'operational' | 'disabled' | 'disconnected';
type GeneralHealthKind = 'system' | 'sync' | 'database' | 'offline_mode';
type EventFlowKind = 'general' | 'vip' | 'backstage' | 'rejected' | 'duplicates';
type AlertKind = 'duplicate_qr' | 'vip_queue_saturated' | 'scanner_slow';
type LogKind =
  | 'offline_activated'
  | 'offline_deactivated'
  | 'validations_paused'
  | 'validations_resumed'
  | 'vip_blocked'
  | 'vip_unblocked'
  | 'override_authorized'
  | 'scanner_restarted'
  | 'duplicate_detected'
  | 'staff_alert';

function activeEventWindow(): Prisma.EventWhereInput {
  const now = Date.now();
  return {
    startsAt: {
      gte: new Date(now - 24 * 60 * 60 * 1000),
      lte: new Date(now + 30 * 24 * 60 * 60 * 1000),
    },
  };
}

function formatScannerId(label: string) {
  const normalized = label
    .trim()
    .toUpperCase()
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized.length > 0 ? normalized : 'SCANNER';
}

function isBackstageAccess(assignedSlot: string | null | undefined) {
  const slot = assignedSlot?.trim().toLowerCase() ?? '';
  return slot.includes('backstage') || slot.includes('back stage');
}

function resolveScannerStatus(
  staffMembers: Array<Pick<StaffMember, 'status' | 'lastActivityAt'>>,
  lastScanAt: Date | null,
  now: number,
): HealthStatus {
  const hasPaused = staffMembers.some((member) => member.status === 'paused');
  if (hasPaused && !lastScanAt) {
    return 'disconnected';
  }

  const lastActivity = staffMembers.reduce<Date | null>((latest, member) => {
    if (!member.lastActivityAt) {
      return latest;
    }
    if (!latest || member.lastActivityAt > latest) {
      return member.lastActivityAt;
    }
    return latest;
  }, lastScanAt);

  if (!lastActivity) {
    return staffMembers.some((member) => member.status === 'online') ? 'slow' : 'disconnected';
  }

  const ageMs = now - lastActivity.getTime();
  if (ageMs >= SCANNER_DISCONNECTED_MS) {
    return 'disconnected';
  }
  if (ageMs >= SCANNER_SLOW_MS || staffMembers.some((member) => member.status === 'away')) {
    return 'slow';
  }

  return 'online';
}

async function resolveEvent(eventId?: string) {
  if (eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, countryCode: true },
    });

    if (!event) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    return event;
  }

  const events = await prisma.event.findMany({
    where: activeEventWindow(),
    select: { id: true, title: true, countryCode: true, startsAt: true },
    orderBy: { startsAt: 'asc' },
    take: 20,
  });

  if (events.length === 0) {
    throw new AppError(404, 'ACTIVE_EVENT_NOT_FOUND', 'No active event found for monitoring');
  }

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const validationCounts = await Promise.all(
    events.map(async (event) => {
      const count = await prisma.invitationTicket.count({
        where: {
          validatedAt: { gte: since },
          invitation: { eventId: event.id },
        },
      });
      return { event, count };
    }),
  );

  validationCounts.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    const now = Date.now();
    const leftDistance = Math.abs(left.event.startsAt.getTime() - now);
    const rightDistance = Math.abs(right.event.startsAt.getTime() - now);
    return leftDistance - rightDistance;
  });

  const selected = validationCounts[0]?.event ?? events[0];
  return {
    id: selected.id,
    title: selected.title,
    countryCode: selected.countryCode,
  };
}

async function loadEventEntryIds(eventId: string) {
  const tickets = await prisma.invitationTicket.findMany({
    where: { invitation: { eventId } },
    select: { manualEntryId: true },
  });

  return tickets
    .map((ticket) => ticket.manualEntryId?.trim())
    .filter((entryId): entryId is string => Boolean(entryId));
}

async function loadEventFlow(eventId: string) {
  const since = new Date(Date.now() - FLOW_WINDOW_MS);
  const tickets = await prisma.invitationTicket.findMany({
    where: {
      validatedAt: { gte: since },
      invitation: { eventId },
    },
    select: {
      invitation: {
        select: {
          tier: true,
          assignedSlot: true,
          status: true,
        },
      },
    },
  });

  const counts: Record<EventFlowKind, number> = {
    general: 0,
    vip: 0,
    backstage: 0,
    rejected: 0,
    duplicates: 0,
  };

  for (const ticket of tickets) {
    const invitation = ticket.invitation;
    if (isBackstageAccess(invitation.assignedSlot)) {
      counts.backstage += 1;
    } else if (invitation.tier === 'vip') {
      counts.vip += 1;
    } else {
      counts.general += 1;
    }
  }

  const entryIds = await loadEventEntryIds(eventId);
  if (entryIds.length > 0) {
    counts.duplicates = await prisma.staffScanLog.count({
      where: {
        scanType: 'entry',
        outcome: 'already_used',
        scannedAt: { gte: since },
        entryId: { in: entryIds },
      },
    });
  }

  counts.rejected = await prisma.invitation.count({
    where: {
      eventId,
      status: { in: ['rejected', 'canceled', 'failed'] },
      updatedAt: { gte: since },
    },
  });

  return Object.entries(counts).map(([kind, count]) => ({
    kind: kind as EventFlowKind,
    count,
  }));
}

async function loadScanners(eventTitle: string) {
  const staffMembers = await prisma.staffMember.findMany({
    where: {
      permissionIds: { hasSome: [...ENTRY_SCAN_PERMISSIONS] },
    },
    include: { zone: true },
    orderBy: [{ zone: { displayOrder: 'asc' } }, { name: 'asc' }],
  });

  const since = new Date(Date.now() - SCANNER_DISCONNECTED_MS);
  const scanLogs = await prisma.staffScanLog.findMany({
    where: {
      scanType: 'entry',
      scannedAt: { gte: since },
      OR: [{ eventTitle }, { eventTitle: null }],
    },
    select: {
      staffMemberId: true,
      scannedAt: true,
    },
    orderBy: { scannedAt: 'desc' },
  });

  const latestScanByStaff = new Map<string, Date>();
  for (const log of scanLogs) {
    if (!latestScanByStaff.has(log.staffMemberId)) {
      latestScanByStaff.set(log.staffMemberId, log.scannedAt);
    }
  }

  const zoneMap = new Map<
    string,
    {
      id: string;
      staffMembers: Array<Pick<StaffMember, 'id' | 'status' | 'lastActivityAt'>>;
      lastScanAt: Date | null;
    }
  >();

  for (const member of staffMembers) {
    const scannerId = formatScannerId(member.zone.label);
    const existing = zoneMap.get(scannerId) ?? {
      id: scannerId,
      staffMembers: [],
      lastScanAt: null,
    };

    existing.staffMembers.push({
      id: member.id,
      status: member.status,
      lastActivityAt: member.lastActivityAt,
    });

    const memberScanAt = latestScanByStaff.get(member.id) ?? null;
    if (
      memberScanAt &&
      (!existing.lastScanAt || memberScanAt.getTime() > existing.lastScanAt.getTime())
    ) {
      existing.lastScanAt = memberScanAt;
    }

    zoneMap.set(scannerId, existing);
  }

  const now = Date.now();
  return [...zoneMap.values()].map((scanner) => ({
    id: scanner.id,
    status: resolveScannerStatus(scanner.staffMembers, scanner.lastScanAt, now),
  }));
}

function buildGeneralHealth(
  flags: Awaited<ReturnType<typeof supervisorOperationalStateService.getFlags>>,
  syncStatus: HealthStatus,
): Array<{ kind: GeneralHealthKind; status: HealthStatus }> {
  return [
    { kind: 'system', status: 'online' },
    { kind: 'sync', status: syncStatus },
    { kind: 'database', status: 'operational' },
    {
      kind: 'offline_mode',
      status: flags.offlineModeEnabled ? 'online' : 'disabled',
    },
  ];
}

function buildAlerts(
  eventFlow: Awaited<ReturnType<typeof loadEventFlow>>,
  scanners: Awaited<ReturnType<typeof loadScanners>>,
  flags: Awaited<ReturnType<typeof supervisorOperationalStateService.getFlags>>,
): AlertKind[] {
  const alerts = new Set<AlertKind>();
  const flow = Object.fromEntries(eventFlow.map((item) => [item.kind, item.count])) as Record<
    EventFlowKind,
    number
  >;

  if ((flow.duplicates ?? 0) > 0) {
    alerts.add('duplicate_qr');
  }

  if ((flow.vip ?? 0) >= VIP_FLOW_SATURATION_THRESHOLD) {
    alerts.add('vip_queue_saturated');
  }

  if (scanners.some((scanner) => scanner.status === 'slow')) {
    alerts.add('scanner_slow');
  }

  if (flags.validationsPaused) {
    alerts.add('scanner_slow');
  }

  return [...alerts];
}

function resolveRiskReason(alerts: AlertKind[], flags: { validationsPaused: boolean }) {
  if (flags.validationsPaused) {
    return 'validations_paused';
  }
  if (alerts.includes('vip_queue_saturated')) {
    return 'vip_flow';
  }
  if (alerts.includes('duplicate_qr')) {
    return 'duplicate_qr';
  }
  if (alerts.includes('scanner_slow')) {
    return 'scanner_slow';
  }
  return null;
}

function mapAuditActionToLogKind(action: string): LogKind | null {
  switch (action) {
    case `${SYSTEM_ACTION_PREFIX}offline_mode_enabled`:
      return 'offline_activated';
    case `${SYSTEM_ACTION_PREFIX}offline_mode_disabled`:
      return 'offline_deactivated';
    case `${SYSTEM_ACTION_PREFIX}validations_paused`:
      return 'validations_paused';
    case `${SYSTEM_ACTION_PREFIX}validations_resumed`:
      return 'validations_resumed';
    case `${SYSTEM_ACTION_PREFIX}vip_access_blocked`:
      return 'vip_blocked';
    case `${SYSTEM_ACTION_PREFIX}vip_access_unblocked`:
      return 'vip_unblocked';
    case `${SYSTEM_ACTION_PREFIX}scanner_restarted`:
      return 'scanner_restarted';
    case `${SYSTEM_ACTION_PREFIX}staff_alert`:
      return 'staff_alert';
    default:
      if (action.startsWith('supervisor_entry_override_')) {
        return 'override_authorized';
      }
      if (action.startsWith('supervisor_duplicate_')) {
        return 'duplicate_detected';
      }
      return null;
  }
}

async function loadRecentLogs(eventId: string, countryCode: string) {
  const auditRows = await prisma.invitationAuditLog.findMany({
    where: {
      OR: [
        { action: { startsWith: SYSTEM_ACTION_PREFIX } },
        { action: { startsWith: 'supervisor_entry_override_' } },
        { action: { startsWith: 'supervisor_duplicate_' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  const logs: Array<{ time: string; kind: LogKind }> = [];

  for (const row of auditRows) {
    const metadata = row.metadata;
    const metadataEventId =
      metadata &&
      typeof metadata === 'object' &&
      !Array.isArray(metadata) &&
      'event_id' in metadata &&
      typeof metadata.event_id === 'string'
        ? metadata.event_id
        : null;

    if (metadataEventId && metadataEventId !== eventId) {
      continue;
    }

    const kind = mapAuditActionToLogKind(row.action);
    if (!kind) {
      continue;
    }

    logs.push({
      time: formatTimeLabel(row.createdAt, countryCode),
      kind,
    });

    if (logs.length >= 8) {
      break;
    }
  }

  return logs;
}

async function assertSupervisorPin(staffMemberId: string, pin: string) {
  const member = await prisma.staffMember.findUnique({
    where: { id: staffMemberId },
    select: { supervisorPinHash: true },
  });

  if (!member?.supervisorPinHash) {
    throw new AppError(
      403,
      'SUPERVISOR_PIN_NOT_CONFIGURED',
      'Supervisor PIN has not been configured',
    );
  }

  const isValid = await verifyOtp(pin, member.supervisorPinHash);
  if (!isValid) {
    throw new AppError(401, 'SUPERVISOR_PIN_INVALID', 'Incorrect supervisor PIN');
  }
}

async function logSystemAction(
  staffMemberId: string,
  eventId: string,
  action: string,
  metadata?: Record<string, unknown>,
) {
  await invitationAuditService.log({
    actorUserId: staffMemberId,
    actorType: 'system',
    action,
    result: 'success',
    metadata: {
      event_id: eventId,
      ...metadata,
    },
  });
}

export const staffSupervisorSystemStatusService = {
  async getSystemStatus(query: StaffSupervisorSystemStatusQuery) {
    const event = await resolveEvent(query.event_id);
    const flags = await supervisorOperationalStateService.getFlags(event.id);
    const scanners = await loadScanners(event.title);
    const eventFlow = await loadEventFlow(event.id);
    const alerts = buildAlerts(eventFlow, scanners, flags);
    const syncStatus: HealthStatus = scanners.some((scanner) => scanner.status !== 'online')
      ? 'slow'
      : 'online';
    const riskReason = resolveRiskReason(alerts, flags);
    const logs = await loadRecentLogs(event.id, event.countryCode);

    return {
      event_id: event.id,
      event_title: event.title,
      general_health: buildGeneralHealth(flags, syncStatus),
      scanners,
      alerts,
      event_flow: eventFlow,
      logs,
      risk_level: riskReason ? ('moderate' as const) : null,
      risk_reason_key: riskReason,
      operational_flags: {
        offline_mode_enabled: flags.offlineModeEnabled,
        validations_paused: flags.validationsPaused,
        vip_access_blocked: flags.vipAccessBlocked,
      },
    };
  },

  async applySystemStatusAction(
    staffMemberId: string,
    input: StaffSupervisorApplySystemStatusActionInput,
  ) {
    await assertSupervisorPin(staffMemberId, input.pin);
    const event = await resolveEvent(input.event_id);
    const current = await supervisorOperationalStateService.getOrCreate(event.id);

    switch (input.action) {
      case 'offline_mode': {
        const enabled = !current.offlineModeEnabled;
        await supervisorOperationalStateService.updateFlags(event.id, staffMemberId, {
          offlineModeEnabled: enabled,
        });
        await logSystemAction(
          staffMemberId,
          event.id,
          enabled
            ? `${SYSTEM_ACTION_PREFIX}offline_mode_enabled`
            : `${SYSTEM_ACTION_PREFIX}offline_mode_disabled`,
        );
        break;
      }
      case 'pause_validations': {
        const paused = !current.validationsPaused;
        await supervisorOperationalStateService.updateFlags(event.id, staffMemberId, {
          validationsPaused: paused,
        });
        await logSystemAction(
          staffMemberId,
          event.id,
          paused
            ? `${SYSTEM_ACTION_PREFIX}validations_paused`
            : `${SYSTEM_ACTION_PREFIX}validations_resumed`,
        );
        break;
      }
      case 'block_vip': {
        const blocked = !current.vipAccessBlocked;
        await supervisorOperationalStateService.updateFlags(event.id, staffMemberId, {
          vipAccessBlocked: blocked,
        });
        await logSystemAction(
          staffMemberId,
          event.id,
          blocked
            ? `${SYSTEM_ACTION_PREFIX}vip_access_blocked`
            : `${SYSTEM_ACTION_PREFIX}vip_access_unblocked`,
        );
        break;
      }
      case 'staff_alert': {
        const message = input.notes?.trim() || 'Supervisor alert sent to staff';
        await supervisorOperationalStateService.updateFlags(event.id, staffMemberId, {
          lastStaffAlertAt: new Date(),
          lastStaffAlertMessage: message,
        });
        await logSystemAction(staffMemberId, event.id, `${SYSTEM_ACTION_PREFIX}staff_alert`, {
          message,
        });
        break;
      }
      case 'restart_scanner': {
        const scannerId = input.scanner_id?.trim();
        if (!scannerId) {
          throw new AppError(400, 'SCANNER_ID_REQUIRED', 'Scanner id is required');
        }

        const staffMembers = await prisma.staffMember.findMany({
          where: {
            permissionIds: { hasSome: [...ENTRY_SCAN_PERMISSIONS] },
          },
          include: { zone: true },
        });

        const matches = staffMembers.filter(
          (member) => formatScannerId(member.zone.label) === scannerId,
        );

        if (matches.length === 0) {
          throw new AppError(404, 'SCANNER_NOT_FOUND', 'Scanner not found');
        }

        await prisma.staffMember.updateMany({
          where: { id: { in: matches.map((member) => member.id) } },
          data: {
            status: 'online',
            lastActivityAt: new Date(),
          },
        });

        await logSystemAction(staffMemberId, event.id, `${SYSTEM_ACTION_PREFIX}scanner_restarted`, {
          scanner_id: scannerId,
        });
        break;
      }
      default:
        throw new AppError(400, 'INVALID_SYSTEM_ACTION', 'Unsupported system action');
    }

    return this.getSystemStatus({ event_id: event.id });
  },
};
