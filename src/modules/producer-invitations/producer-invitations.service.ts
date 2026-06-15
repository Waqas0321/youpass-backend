import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { invitationConfigService, addDays } from '../../common/services/invitation-config.service.js';
import { getCurrencyForCountry } from '../../common/services/country-config.service.js';
import {
  formatInvitationListItem,
} from '../invitations/invitations.formatter.js';
import { resolveInvitationProductKind } from '../invitations/invitation-product-type.utils.js';
import {
  lifecycleStateLabel,
  resolveInvitationLifecycleState,
} from '../invitations/invitation-status.utils.js';
import { invitationAuditService } from '../invitations/invitation-audit.service.js';
import {
  formatInvitationSettingsResponse,
  invitationSettingsUpdateData,
} from '../invitations/invitation-settings.formatter.js';
import {
  invitationSettingsService,
  ALLOWED_DISCOUNT_PERCENTAGES,
  INVITATION_SETTINGS_DEFAULTS,
} from '../invitations/invitation-settings.service.js';
import { invitationReminderService } from '../invitations/invitation-reminder.service.js';
import {
  mapApiTypeToDb,
  mapDbTypeToApi,
} from '../invitations/invitation-status.utils.js';
import {
  formatFreedSlotDuration,
  markFreedSlotReinvited,
} from '../invitations/invitation-freed-slot.service.js';
import {
  guaranteedPassNotificationService,
  resolveGuestContact,
} from '../invitations/guaranteed-pass-notification.service.js';
import { invitationDeliveryService } from '../messaging/invitation-delivery.service.js';
import { buildInvitationDeepLink } from '../invitations/guaranteed-pass-deep-link.utils.js';
import { eventEndAt } from '../tickets/tickets.utils.js';
import type {
  CreateProducerInvitationInput,
  ListProducerInvitationsQuery,
  ReinviteProducerInvitationInput,
  UpdateEventInvitationSettingsInput,
} from './producer-invitations.validators.js';

const invitationInclude = {
  event: true,
  producer: true,
  ticket: true,
  recipient: true,
  inviter: true,
} as const;

type InvitationRow = Prisma.InvitationGetPayload<{ include: typeof invitationInclude }>;

function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  return trimmed.startsWith('+') ? trimmed : `+${trimmed.replace(/\D/g, '')}`;
}

async function resolveInvitationRecipient(input: CreateProducerInvitationInput) {
  if (input.recipient_user_id) {
    const user = await prisma.user.findFirst({
      where: {
        id: input.recipient_user_id,
        accountStatus: { in: ['active', 'pending_deletion'] },
      },
    });
    if (!user) {
      throw new AppError(404, 'RECIPIENT_NOT_FOUND', 'User not found');
    }
    return { phone: user.phone, user };
  }

  const phone = normalizePhone(input.recipient_phone!);
  const user = await prisma.user.findFirst({ where: { phone } });
  return { phone, user };
}

async function assertProducerExists(producerId: string) {
  const producer = await prisma.producer.findUnique({ where: { id: producerId } });
  if (!producer) {
    throw new AppError(404, 'PRODUCER_NOT_FOUND', 'Producer not found');
  }
  return producer;
}

async function loadEventForProducer(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      invitationSettings: true,
      ticketOfferings: { where: { status: 'active' }, orderBy: { price: 'desc' }, take: 1 },
    },
  });
  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }
  if (!event.invitationSettings) {
    await invitationSettingsService.ensureInvitationSettings(eventId);
    return loadEventForProducer(eventId);
  }
  return event;
}

function resolveBasePrice(event: Awaited<ReturnType<typeof loadEventForProducer>>): number {
  const offering = event.ticketOfferings[0];
  if (offering) {
    return offering.price;
  }
  return event.minPrice ?? 0;
}

function buildProducerInvitationPayload(
  producerId: string,
  event: Awaited<ReturnType<typeof loadEventForProducer>>,
  input: CreateProducerInvitationInput,
) {
  const dbType = mapApiTypeToDb(input.type);
  const currency = event.currencyCode ?? getCurrencyForCountry(event.countryCode);
  const basePrice = resolveBasePrice(event);
  const sentAt = new Date();
  const settings = event.invitationSettings!;

  try {
    invitationSettingsService.assertInvitationTypeAllowed(settings, dbType);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVITATION_TYPE_DISABLED';
    throw new AppError(422, code, 'Invitation type is disabled for this event');
  }

  const cancellationDays =
    input.cancellation_deadline_days ??
    invitationSettingsService.resolveCancellationDays(settings, dbType);
  const cancellationDeadline = addDays(sentAt, cancellationDays);

  let discountPercentage: number | null = null;
  let amountToPay = 0;

  if (dbType === 'discount') {
    try {
      discountPercentage = invitationSettingsService.resolveDiscountPercentage(
        settings,
        input.discount_percentage,
      );
    } catch {
      throw new AppError(
        422,
        'INVALID_DISCOUNT_PERCENTAGE',
        `discount_percentage must be one of ${ALLOWED_DISCOUNT_PERCENTAGES.join(', ')}`,
      );
    }
    amountToPay = Math.round(basePrice * (1 - discountPercentage / 100));
  }

  return {
    eventId: event.id,
    producerId,
    recipientPhone: normalizePhone(input.recipient_phone!),
    type: dbType,
    tier: 'vip' as const,
    status: 'sent' as const,
    source: 'producer' as const,
    assignedSlot: input.slot_label,
    customMessage: input.personalised_message,
    entryValue: basePrice > 0 ? basePrice : 50000,
    discountPercentage,
    amountToPay,
    chargeCurrency: currency,
    cancellationDeadline,
    sentAt,
    expiresAt: addDays(sentAt, 3),
  };
}

function formatProducerInvitationRow(invitation: InvitationRow, expiryDays: number) {
  const lifecycle = resolveInvitationLifecycleState({
    ...invitation,
    ticket: invitation.ticket,
  });

  return {
    ...formatInvitationListItem(invitation, expiryDays),
    recipient_phone: invitation.recipientPhone,
    recipient_name: invitation.recipientName ?? invitation.recipient?.fullName ?? null,
    invitation_type: mapDbTypeToApi(invitation.type),
    lifecycle_state: lifecycle,
    lifecycle_label: lifecycleStateLabel(lifecycle),
    slot_label: invitation.assignedSlot,
    sent_at: invitation.sentAt.toISOString(),
  };
}

async function dispatchNewInvitationNotifications(invitation: InvitationRow) {
  const productKind = resolveInvitationProductKind(invitation);
  const recipient = invitation.recipient;
  const contact = resolveGuestContact(recipient, invitation);
  const deepLink = buildInvitationDeepLink(invitation.id);

  if (productKind === 'guaranteed_pass') {
    await guaranteedPassNotificationService.sendInvitationReceived({
      invitation,
      event: invitation.event,
      producer: invitation.producer,
      recipient,
      inviterName: invitation.producer.name,
      ...contact,
      guestName: recipient?.fullName ?? invitation.recipientName ?? 'Guest',
    });
    return;
  }

  if (contact.guestPhone) {
    await invitationDeliveryService.sendGuestInvitation({
      guestPhone: contact.guestPhone,
      guestName: recipient?.fullName ?? invitation.recipientName ?? 'Guest',
      inviterName: invitation.producer.name,
      eventTitle: invitation.event.title,
      claimUrl: deepLink,
    });
  }

  console.info('[producer-invite/email]', {
    to: contact.guestEmail,
    subject: `Invitation to ${invitation.event.title}`,
    deepLink,
  });
}

export const producerInvitationsService = {
  async listInvitations(producerId: string, query: ListProducerInvitationsQuery) {
    await assertProducerExists(producerId);
    const { expiryDays } = await invitationConfigService.getConfig();

    const where: Prisma.InvitationWhereInput = {
      producerId,
      source: 'producer',
    };

    if (query.event_id) {
      where.eventId = query.event_id;
    }

    if (query.status) {
      where.status = {
        in: query.status.split(',').map((value) => value.trim()) as Prisma.EnumInvitationStatusFilter['in'],
      };
    }

    if (query.from || query.to) {
      where.sentAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { recipientName: { contains: term } },
        { recipientPhone: { contains: term } },
        { recipient: { fullName: { contains: term } } },
        { recipient: { phone: { contains: term } } },
      ];
    }

    const page = query.page;
    const pageSize = query.page_size;
    const skip = (page - 1) * pageSize;

    let invitations = await prisma.invitation.findMany({
      where,
      include: invitationInclude,
      orderBy: { sentAt: 'desc' },
      skip,
      take: pageSize,
    });

    if (query.type) {
      invitations = invitations.filter((row) => mapDbTypeToApi(row.type) === query.type);
    }

    const total = await prisma.invitation.count({ where });

    return {
      invitations: invitations.map((row) => formatProducerInvitationRow(row, expiryDays)),
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  },

  async createInvitation(producerId: string, input: CreateProducerInvitationInput) {
    await assertProducerExists(producerId);
    const event = await loadEventForProducer(input.event_id);
    const recipient = await resolveInvitationRecipient(input);
    const payload = buildProducerInvitationPayload(producerId, event, {
      ...input,
      recipient_phone: recipient.phone,
    });

    const invitation = await prisma.invitation.create({
      data: {
        ...payload,
        recipientUserId: recipient.user?.id ?? null,
        recipientName: recipient.user?.fullName ?? null,
        claimToken: crypto.randomBytes(16).toString('hex'),
      },
      include: invitationInclude,
    });

    await invitationReminderService.scheduleInvitationReminders(invitation, event);

    await dispatchNewInvitationNotifications(invitation);
    await invitationAuditService.log({
      invitationId: invitation.id,
      actorType: 'producer',
      action: 'create_invitation',
      result: 'success',
      metadata: { producer_id: producerId, type: input.type },
    });

    const { expiryDays } = await invitationConfigService.getConfig();
    return {
      ...formatProducerInvitationRow(invitation, expiryDays),
      status: 'sent',
      lifecycle_state: 'sent',
      lifecycle_label: 'Sent',
    };
  },

  async getStats(producerId: string) {
    await assertProducerExists(producerId);
    const invitations = await prisma.invitation.findMany({
      where: { producerId, source: 'producer' },
      include: { ticket: true },
    });

    const totalSent = invitations.length;
    const accepted = invitations.filter((row) =>
      ['accepted', 'validated'].includes(row.status),
    );
    const pending = invitations.filter((row) => ['sent', 'viewed'].includes(row.status));
    const rejected = invitations.filter((row) => row.status === 'rejected');
    const cancelled = invitations.filter((row) => row.status === 'canceled');
    const validated = invitations.filter(
      (row) => row.status === 'validated' || row.ticket?.validatedAt != null,
    );
    const charged = invitations.filter((row) => row.status === 'charged');
    const failed = invitations.filter((row) => row.status === 'failed');
    const revenue = charged.reduce((sum, row) => sum + row.entryValue, 0);
    const currency = invitations[0]?.chargeCurrency ?? 'CLP';

    const byType = {
      free: { sent: 0, accepted: 0 },
      guaranteed: { sent: 0, accepted: 0 },
      discounted: { sent: 0, accepted: 0 },
    };

    for (const row of invitations) {
      const apiType = mapDbTypeToApi(row.type);
      byType[apiType].sent += 1;
      if (['accepted', 'validated'].includes(row.status)) {
        byType[apiType].accepted += 1;
      }
    }

    return {
      total_sent: totalSent,
      accepted_count: accepted.length,
      accepted_percentage: totalSent > 0 ? Math.round((accepted.length / totalSent) * 1000) / 10 : 0,
      pending_count: pending.length,
      rejected_count: rejected.length,
      cancelled_count: cancelled.length,
      validated_count: validated.length,
      charged_count: charged.length,
      failed_charge_count: failed.length,
      revenue_from_charges: revenue,
      revenue_currency: currency,
      breakdown_by_type: byType,
    };
  },

  async getAlerts(producerId: string) {
    await assertProducerExists(producerId);
    const now = new Date();
    const in24h = addDays(now, 1);

    const nearDeadline = await prisma.invitation.findMany({
      where: {
        producerId,
        status: 'accepted',
        cancellationDeadline: { gte: now, lte: in24h },
      },
      include: invitationInclude,
      orderBy: { cancellationDeadline: 'asc' },
      take: 50,
    });

    const freedSlots = await prisma.freedInvitationSlot.findMany({
      where: { producerId, reinvitedAt: null },
      include: { event: true },
      orderBy: { releasedAt: 'desc' },
      take: 50,
    });

    const failedCharges = await prisma.invitation.findMany({
      where: {
        producerId,
        status: 'failed',
      },
      include: invitationInclude,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return {
      guests_near_cancellation_deadline: nearDeadline.map((row) => ({
        invitation_id: row.id,
        guest_name: row.recipientName ?? row.recipient?.fullName ?? null,
        guest_phone: row.recipientPhone,
        event_title: row.event.title,
        cancellation_deadline: row.cancellationDeadline?.toISOString() ?? null,
        hours_remaining: row.cancellationDeadline
          ? Math.max(
              0,
              Math.round(
                (row.cancellationDeadline.getTime() - now.getTime()) / (60 * 60 * 1000),
              ),
            )
          : null,
      })),
      recently_released_slots: freedSlots.map((slot) => ({
        freed_slot_id: slot.id,
        slot_label: slot.slotLabel,
        event_id: slot.eventId,
        event_title: slot.event.title,
        released_at: slot.releasedAt.toISOString(),
        ...formatFreedSlotDuration(slot.releasedAt, now),
      })),
      failed_charges: failedCharges.map((row) => ({
        invitation_id: row.id,
        guest_name: row.recipientName ?? row.recipient?.fullName ?? null,
        guest_phone: row.recipientPhone,
        event_title: row.event.title,
        amount: row.entryValue,
        currency: row.chargeCurrency,
        failed_at: row.updatedAt.toISOString(),
        attempts: 3,
      })),
      generated_at: now.toISOString(),
    };
  },

  async listFreedSlots(producerId: string) {
    await assertProducerExists(producerId);
    const now = new Date();
    const slots = await prisma.freedInvitationSlot.findMany({
      where: { producerId, reinvitedAt: null },
      include: { event: true },
      orderBy: { releasedAt: 'desc' },
    });

    return {
      freed_slots: slots.map((slot) => ({
        id: slot.id,
        slot_label: slot.slotLabel,
        event_id: slot.eventId,
        event_title: slot.event.title,
        released_at: slot.releasedAt.toISOString(),
        ...formatFreedSlotDuration(slot.releasedAt, now),
      })),
    };
  },

  async reinvite(producerId: string, input: ReinviteProducerInvitationInput) {
    await assertProducerExists(producerId);
    const slot = await prisma.freedInvitationSlot.findFirst({
      where: { id: input.freed_slot_id, producerId, reinvitedAt: null },
      include: { event: { include: { invitationSettings: true, ticketOfferings: true } } },
    });

    if (!slot) {
      throw new AppError(404, 'FREED_SLOT_NOT_FOUND', 'Released slot not found');
    }

    const created = await this.createInvitation(producerId, {
      event_id: slot.eventId,
      type: 'guaranteed',
      recipient_phone: input.new_recipient_phone,
      slot_label: slot.slotLabel,
      cancellation_deadline_days:
        slot.event.invitationSettings?.guaranteedCancellationDays ?? 3,
      personalised_message: input.personalised_message,
    });

    await markFreedSlotReinvited(slot.id);
    return created;
  },

  async getSuggestedCandidates(
    producerId: string,
    eventId?: string,
    limit = 20,
  ) {
    await assertProducerExists(producerId);
    const candidates: Array<{
      guest_name: string;
      guest_phone: string;
      reason: string;
      score: number;
      past_attendance_count: number;
    }> = [];

    const followers = await prisma.producerFollow.findMany({
      where: { producerId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            category: true,
          },
        },
      },
      take: 100,
    });

    for (const follow of followers) {
      const attendanceCount = await prisma.invitationTicket.count({
        where: {
          validatedAt: { not: null },
          invitation: { recipientUserId: follow.user.id },
        },
      });

      const isGold = follow.user.category === 'gold';
      candidates.push({
        guest_name: follow.user.fullName,
        guest_phone: follow.user.phone,
        reason: isGold
          ? "Promoter's Gold-tier client"
          : "Promoter's saved contact (follower)",
        score: isGold ? 90 : 60,
        past_attendance_count: attendanceCount,
      });
    }

    if (eventId) {
      const pastGuests = await prisma.invitation.findMany({
        where: {
          eventId: { not: eventId },
          producerId,
          status: { in: ['accepted', 'validated'] },
          recipientUserId: { not: null },
        },
        include: { recipient: true, ticket: true },
        take: 100,
      });

      for (const guest of pastGuests) {
        if (!guest.recipient) {
          continue;
        }
        candidates.push({
          guest_name: guest.recipient.fullName,
          guest_phone: guest.recipient.phone,
          reason: 'Attended similar past events',
          score: guest.ticket?.validatedAt ? 80 : 50,
          past_attendance_count: guest.ticket?.validatedAt ? 1 : 0,
        });
      }
    }

    const deduped = new Map<string, (typeof candidates)[number]>();
    for (const candidate of candidates) {
      const existing = deduped.get(candidate.guest_phone);
      if (!existing || candidate.score > existing.score) {
        deduped.set(candidate.guest_phone, candidate);
      }
    }

    const ranked = [...deduped.values()]
      .sort((a, b) => b.score - a.score || b.past_attendance_count - a.past_attendance_count)
      .slice(0, limit)
      .map((candidate, index) => ({
        rank: index + 1,
        ...candidate,
      }));

    return { candidates: ranked };
  },

  async getPostEventReport(producerId: string, eventId: string, format: 'json' | 'csv' | 'pdf') {
    await assertProducerExists(producerId);
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    const closeAt = event.endsAt ?? eventEndAt(event.startsAt);
    if (new Date() < closeAt) {
      throw new AppError(409, 'EVENT_NOT_ENDED', 'Post-event report is available after event end time');
    }

    const invitations = await prisma.invitation.findMany({
      where: { producerId, eventId, source: 'producer' },
      include: { ticket: true, recipient: true },
      orderBy: { sentAt: 'desc' },
    });

    const attended = invitations.filter(
      (row) => row.status === 'validated' || row.ticket?.validatedAt != null,
    );
    const charged = invitations.filter((row) => row.status === 'charged');
    const failed = invitations.filter((row) => row.status === 'failed');
    const revenue = charged.reduce((sum, row) => sum + row.entryValue, 0);
    const currency = invitations[0]?.chargeCurrency ?? event.currencyCode ?? 'CLP';

    const report = {
      event_id: eventId,
      event_title: event.title,
      event_ended_at: closeAt.toISOString(),
      total_invitations_sent: invitations.length,
      total_attended: attended.length,
      attendance_rate:
        invitations.length > 0
          ? Math.round((attended.length / invitations.length) * 1000) / 10
          : 0,
      no_show_rate:
        invitations.length > 0
          ? Math.round(((invitations.length - attended.length) / invitations.length) * 1000) / 10
          : 0,
      revenue_from_charges: revenue,
      revenue_currency: currency,
      charged_guests: charged.map((row) => ({
        invitation_id: row.id,
        guest_name: row.recipientName ?? row.recipient?.fullName ?? null,
        guest_phone: row.recipientPhone,
        amount: row.entryValue,
        currency: row.chargeCurrency,
      })),
      failed_charges: failed.map((row) => ({
        invitation_id: row.id,
        guest_name: row.recipientName ?? row.recipient?.fullName ?? null,
        guest_phone: row.recipientPhone,
        amount: row.entryValue,
        currency: row.chargeCurrency,
        attempts: 3,
      })),
      breakdown_by_type: {
        free: invitations.filter((row) => mapDbTypeToApi(row.type) === 'free').length,
        guaranteed: invitations.filter((row) => mapDbTypeToApi(row.type) === 'guaranteed')
          .length,
        discounted: invitations.filter((row) => mapDbTypeToApi(row.type) === 'discounted')
          .length,
      },
    };

    if (format === 'csv') {
      const lines = [
        'invitation_id,guest_name,guest_phone,status,amount,currency',
        ...invitations.map(
          (row) =>
            `${row.id},${row.recipientName ?? ''},${row.recipientPhone ?? ''},${row.status},${row.entryValue},${row.chargeCurrency ?? currency}`,
        ),
      ];
      return {
        format: 'csv',
        content_type: 'text/csv',
        body: lines.join('\n'),
      };
    }

    if (format === 'pdf') {
      return {
        format: 'pdf',
        content_type: 'application/pdf',
        body: `YOUPASS Post-Event Report\nEvent: ${event.title}\nSent: ${report.total_invitations_sent}\nAttended: ${report.total_attended}\nRevenue: ${currency} ${revenue}`,
        note: 'PDF export uses a lightweight text payload until a PDF renderer is integrated.',
      };
    }

    return report;
  },

  async updateEventInvitationSettings(
    producerId: string,
    eventId: string,
    input: UpdateEventInvitationSettingsInput,
  ) {
    await assertProducerExists(producerId);
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    const settings = await prisma.invitationSettings.upsert({
      where: { eventId },
      create: {
        eventId,
        ...invitationSettingsUpdateData(input, INVITATION_SETTINGS_DEFAULTS),
      },
      update: invitationSettingsUpdateData(input, INVITATION_SETTINGS_DEFAULTS),
    });

    await invitationAuditService.log({
      actorType: 'producer',
      action: 'update_event_invitation_settings',
      result: 'success',
      metadata: { producer_id: producerId, event_id: eventId },
    });

    return formatInvitationSettingsResponse(settings);
  },
};
