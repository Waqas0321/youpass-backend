import { IconCheckCircle, IconClock, IconMail, IconX } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import type { GuestEntryStatus } from './eventVipTablesData';

const STATUS_CONFIG: Record<
  GuestEntryStatus,
  { Icon: typeof IconCheckCircle; tone: GuestEntryStatus }
> = {
  confirmed: { Icon: IconCheckCircle, tone: 'confirmed' },
  sent: { Icon: IconMail, tone: 'sent' },
  rejected: { Icon: IconX, tone: 'rejected' },
  pending: { Icon: IconClock, tone: 'pending' },
};

type Props = {
  status: GuestEntryStatus;
};

export function EventVipTableGuestEntryBadge({ status }: Props) {
  const { t } = useI18n();
  const { Icon, tone } = STATUS_CONFIG[status];

  return (
    <span className={`event-vip-table-guests-modal__entry event-vip-table-guests-modal__entry--${tone}`}>
      <Icon />
      {t(`eventVipTables.guestsModal.entryStatus.${status}`)}
    </span>
  );
}
