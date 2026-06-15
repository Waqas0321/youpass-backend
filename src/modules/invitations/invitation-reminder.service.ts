import type { Event, Invitation, InvitationProductType } from '@prisma/client';
import { addDays } from '../../common/services/invitation-config.service.js';
import { prisma } from '../../config/database.js';

type ReminderScheduleInput = {
  invitationId: string;
  eventStartsAt: Date;
  cancellationDeadline: Date;
  type: InvitationProductType;
};

const MS_PER_HOUR = 60 * 60 * 1000;

function subtractHours(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * MS_PER_HOUR);
}

function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

/**
 * Section 14.7 — reminder scheduled_at values are computed once at invitation creation.
 */
export function buildReminderSchedule(input: ReminderScheduleInput) {
  const { eventStartsAt, cancellationDeadline, type } = input;
  if (type !== 'guaranteed') {
    return [];
  }

  return [
    { reminderType: 'seven_days' as const, scheduledAt: subtractDays(eventStartsAt, 7) },
    { reminderType: 'five_days' as const, scheduledAt: subtractDays(eventStartsAt, 5) },
    { reminderType: 'deadline' as const, scheduledAt: cancellationDeadline },
    { reminderType: 'twenty_four_h' as const, scheduledAt: subtractHours(eventStartsAt, 24) },
    { reminderType: 'three_h' as const, scheduledAt: subtractHours(eventStartsAt, 3) },
  ];
}

export async function scheduleInvitationReminders(
  invitation: Pick<Invitation, 'id' | 'type' | 'cancellationDeadline'>,
  event: Pick<Event, 'startsAt'>,
) {
  const rows = buildReminderSchedule({
    invitationId: invitation.id,
    eventStartsAt: event.startsAt,
    cancellationDeadline: invitation.cancellationDeadline,
    type: invitation.type,
  });

  if (rows.length === 0) {
    return [];
  }

  await prisma.invitationReminder.createMany({
    data: rows.map((row) => ({
      invitationId: invitation.id,
      reminderType: row.reminderType,
      scheduledAt: row.scheduledAt,
      channel: 'whatsapp',
      status: 'pending',
    })),
  });

  return rows;
}

export async function markReminderSent(reminderId: string) {
  return prisma.invitationReminder.update({
    where: { id: reminderId },
    data: {
      status: 'sent',
      sentAt: new Date(),
    },
  });
}

export async function markReminderFailed(reminderId: string) {
  return prisma.invitationReminder.update({
    where: { id: reminderId },
    data: { status: 'failed' },
  });
}

export const invitationReminderService = {
  buildReminderSchedule,
  scheduleInvitationReminders,
  markReminderSent,
  markReminderFailed,
};
