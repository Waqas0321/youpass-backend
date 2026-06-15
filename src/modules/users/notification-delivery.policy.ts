type NotificationChannel = 'email' | 'push' | 'whatsapp';
type NotificationType = 'purchases' | 'reminders' | 'promotions' | 'social';

export type CriticalNotificationKey =
  | 'event_cancellation'
  | 'event_datetime_change'
  | 'event_venue_change'
  | 'security_alerts'
  | 'payment_receipts'
  | 'processed_refunds';

export const CRITICAL_NOTIFICATION_KEYS: CriticalNotificationKey[] = [
  'event_cancellation',
  'event_datetime_change',
  'event_venue_change',
  'security_alerts',
  'payment_receipts',
  'processed_refunds',
];

export type NotificationSettingsSnapshot = {
  master_enabled: boolean;
  channels: Record<NotificationChannel, boolean>;
  types: Record<NotificationType, Record<NotificationChannel, boolean>>;
  night_silence: {
    enabled: boolean;
    from_hour: number | null;
  };
};

export function isCriticalNotification(type: string): type is CriticalNotificationKey {
  return CRITICAL_NOTIFICATION_KEYS.includes(type as CriticalNotificationKey);
}

/**
 * Optional notifications honour master switch, per-type channel matrix, global
 * channels, and night silence (push only). Pass the user's local hour for
 * night-silence checks.
 */
export function shouldDeliverOptionalNotification(
  settings: NotificationSettingsSnapshot,
  options: {
    type: NotificationType;
    channel: NotificationChannel;
    localHour: number;
  },
): boolean {
  if (!settings.master_enabled) {
    return false;
  }

  if (!settings.channels[options.channel]) {
    return false;
  }

  const typeChannels = settings.types[options.type];
  if (!typeChannels?.[options.channel]) {
    return false;
  }

  if (
    options.channel === 'push' &&
    settings.night_silence.enabled &&
    settings.night_silence.from_hour != null &&
    options.localHour >= settings.night_silence.from_hour
  ) {
    return false;
  }

  return true;
}
