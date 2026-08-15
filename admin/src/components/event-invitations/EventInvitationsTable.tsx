import type { ProducerInvitation } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { IconEdit, IconEye, IconSmartphone, IconSort, IconTrash } from '../ui/Icons';
import {
  formatEntryDateTime,
  guestInitials,
  resolveGuestListId,
  resolveInvitationDisplayStatus,
  resolveProductDisplay,
  resolveQrDisplayStatus,
  GUEST_LISTS,
} from './eventInvitationsUtils';

type Props = {
  invitations: ProducerInvitation[];
  selectedIds: Set<string>;
  sortDirection: 'asc' | 'desc';
  onSortName: () => void;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string, checked: boolean) => void;
  onSend: (invitation: ProducerInvitation) => void;
  onView: (invitation: ProducerInvitation) => void;
  onEdit: (invitation: ProducerInvitation) => void;
  onDelete: (invitation: ProducerInvitation) => void;
};

function GuestListTag({ invitation, t }: { invitation: ProducerInvitation; t: ReturnType<typeof useI18n>['t'] }) {
  const listId = resolveGuestListId(invitation);
  const list = listId ? GUEST_LISTS.find((item) => item.id === listId) : null;
  const label = invitation.slot_label ?? invitation.assigned_slot ?? t('eventInvitations.lists.unassigned');
  const color = list?.color ?? '#94a3b8';

  return (
    <span
      className="event-invitations-tag"
      style={{
        color,
        backgroundColor: `${color}22`,
        borderColor: `${color}55`,
      }}
    >
      {listId ? t(`eventInvitations.lists.${listId}`) : label}
    </span>
  );
}

export function EventInvitationsTable({
  invitations,
  selectedIds,
  sortDirection,
  onSortName,
  onToggleAll,
  onToggleOne,
  onSend,
  onView,
  onEdit,
  onDelete,
}: Props) {
  const { t, dateLocale } = useI18n();
  const allSelected = invitations.length > 0 && invitations.every((item) => selectedIds.has(item.id));

  return (
    <div className="event-invitations-table-card">
      <table className="event-invitations-table">
        <thead>
          <tr>
            <th className="event-invitations-table__check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => onToggleAll(event.target.checked)}
                aria-label={t('eventInvitations.selectAll')}
              />
            </th>
            <th>
              <button
                type="button"
                className="event-invitations-table__sortable"
                onClick={onSortName}
                aria-label={t('eventInvitations.sortByName')}
              >
                {t('eventInvitations.columns.name')}
                <IconSort className={sortDirection === 'desc' ? 'is-desc' : undefined} />
              </button>
            </th>
            <th>{t('eventInvitations.columns.phone')}</th>
            <th>{t('eventInvitations.columns.list')}</th>
            <th>{t('eventInvitations.columns.invitationType')}</th>
            <th>{t('eventInvitations.columns.invitationStatus')}</th>
            <th>{t('eventInvitations.columns.qrStatus')}</th>
            <th>{t('eventInvitations.columns.entryTime')}</th>
            <th aria-label={t('eventInvitations.columns.actions')} />
          </tr>
        </thead>
        <tbody>
          {invitations.length === 0 ? (
            <tr>
              <td colSpan={9} className="event-invitations-table__empty">
                {t('eventInvitations.emptyTitle')}
              </td>
            </tr>
          ) : (
            invitations.map((invitation) => {
              const displayStatus = resolveInvitationDisplayStatus(invitation);
              const qrStatus = resolveQrDisplayStatus(invitation);
              const product = resolveProductDisplay(invitation);
              const name = invitation.recipient_name ?? t('eventInvitations.unknownGuest');

              return (
                <tr key={invitation.id}>
                  <td className="event-invitations-table__check">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(invitation.id)}
                      onChange={(event) => onToggleOne(invitation.id, event.target.checked)}
                      aria-label={t('eventInvitations.selectGuest', { name })}
                    />
                  </td>
                  <td>
                    <div className="event-invitations-guest">
                      {invitation.recipient_avatar_url ? (
                        <img src={invitation.recipient_avatar_url} alt="" className="event-invitations-guest__avatar" />
                      ) : (
                        <span className="event-invitations-guest__avatar event-invitations-guest__avatar--fallback">
                          {guestInitials(name)}
                        </span>
                      )}
                      <strong>{name}</strong>
                    </div>
                  </td>
                  <td className="event-invitations-table__phone">{invitation.recipient_phone ?? '—'}</td>
                  <td>
                    <GuestListTag invitation={invitation} t={t} />
                  </td>
                  <td>
                    <span className={`event-invitations-type event-invitations-type--${product}`}>
                      {t(`eventInvitations.productTypes.${product}`)}
                    </span>
                  </td>
                  <td>
                    <span className={`event-invitations-status event-invitations-status--${displayStatus}`}>
                      <span className="event-invitations-status__dot" />
                      {t(`eventInvitations.status.${displayStatus}`)}
                    </span>
                  </td>
                  <td>
                    <span className={`event-invitations-qr event-invitations-qr--${qrStatus}`}>
                      {t(`eventInvitations.qrStatus.${qrStatus}`)}
                    </span>
                  </td>
                  <td className="event-invitations-table__entry">
                    {formatEntryDateTime(invitation.entry_at, dateLocale)}
                  </td>
                  <td>
                    <div className="event-invitations-actions">
                      <button type="button" className="event-invitations-actions__btn event-invitations-actions__btn--send" onClick={() => onSend(invitation)} title={t('eventInvitations.actions.send')}>
                        <IconSmartphone />
                      </button>
                      <button type="button" className="event-invitations-actions__btn event-invitations-actions__btn--view" onClick={() => onView(invitation)} title={t('eventInvitations.actions.view')}>
                        <IconEye />
                      </button>
                      <button type="button" className="event-invitations-actions__btn event-invitations-actions__btn--edit" onClick={() => onEdit(invitation)} title={t('eventInvitations.actions.edit')}>
                        <IconEdit />
                      </button>
                      <button type="button" className="event-invitations-actions__btn event-invitations-actions__btn--danger" onClick={() => onDelete(invitation)} title={t('eventInvitations.actions.delete')}>
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
