import { useState } from 'react';
import { formatUserJoinedDate } from '../calendar/formatCalendarDates';
import { formatCurrencyClp } from '../../i18n/helpers';
import { useI18n } from '../../i18n/useI18n';
import { LoyaltyBadge } from './LoyaltyBadge';
import type { ProducerUser } from './types';

type Props = {
  users: ProducerUser[];
};

export function UsersTable({ users }: Props) {
  const { locale, t, dateLocale, numberLocale } = useI18n();
  const [blockedIds, setBlockedIds] = useState<Set<string>>(() => new Set());

  function toggleBlock(userId: string) {
    setBlockedIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  return (
    <div className="prod-users-table-wrap">
      <table className="prod-users-table" key={locale}>
        <thead>
          <tr>
            <th scope="col">{t('users.table.name')}</th>
            <th scope="col">{t('users.table.phone')}</th>
            <th scope="col">{t('users.table.joined')}</th>
            <th scope="col">{t('users.table.avgTicket')}</th>
            <th scope="col">{t('users.table.loyaltyCategory')}</th>
            <th scope="col">{t('users.table.eventAttendances')}</th>
            <th scope="col">{t('users.table.action')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isBlocked = blockedIds.has(user.id);

            return (
              <tr key={user.id} className={isBlocked ? 'prod-users-table__row--blocked' : undefined}>
                <td>
                  <div className="prod-users-table__name">
                    <img src={user.avatarUrl} alt="" loading="lazy" />
                    <span>{user.name}</span>
                  </div>
                </td>
                <td>{user.phone}</td>
                <td>{formatUserJoinedDate(user.joinedAt, dateLocale)}</td>
                <td>{formatCurrencyClp(user.avgTicketClp, numberLocale)}</td>
                <td>
                  <LoyaltyBadge tier={user.loyaltyTier} />
                </td>
                <td>{user.eventAttendances}</td>
                <td>
                  <button
                    type="button"
                    className="prod-users-table__block-btn"
                    onClick={() => toggleBlock(user.id)}
                  >
                    {isBlocked ? t('users.unblockUser') : t('users.blockUser')}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
