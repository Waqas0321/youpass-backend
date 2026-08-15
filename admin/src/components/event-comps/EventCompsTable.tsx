import type { Comp } from './eventCompsUtils';
import { formatCompDate, formatCompDateTime } from './eventCompsUtils';
import { useI18n } from '../../i18n/useI18n';
import { IconEdit, IconEye, IconSend, IconTrash, IconX } from '../ui/Icons';

type Props = {
  comps: Comp[];
  selectedIds: Set<string>;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string, checked: boolean) => void;
  onSend: (comp: Comp) => void;
  onView: (comp: Comp) => void;
  onCancel: (comp: Comp) => void;
  onEdit: (comp: Comp) => void;
  onDelete: (comp: Comp) => void;
};

export function EventCompsTable({
  comps,
  selectedIds,
  onToggleAll,
  onToggleOne,
  onSend,
  onView,
  onCancel,
  onEdit,
  onDelete,
}: Props) {
  const { t, dateLocale } = useI18n();
  const allSelected = comps.length > 0 && comps.every((item) => selectedIds.has(item.id));

  return (
    <div className="event-comps-table-card">
      <table className="event-comps-table">
        <thead>
          <tr>
            <th className="event-comps-table__check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => onToggleAll(event.target.checked)}
                aria-label={t('eventComps.selectAll')}
              />
            </th>
            <th>{t('eventComps.columns.code')}</th>
            <th>{t('eventComps.columns.beneficiary')}</th>
            <th>{t('eventComps.columns.phone')}</th>
            <th>{t('eventComps.columns.type')}</th>
            <th>{t('eventComps.columns.benefit')}</th>
            <th>{t('eventComps.columns.qrStatus')}</th>
            <th>{t('eventComps.columns.createdAt')}</th>
            <th>{t('eventComps.columns.usedAt')}</th>
            <th aria-label={t('eventComps.columns.actions')} />
          </tr>
        </thead>
        <tbody>
          {comps.length === 0 ? (
            <tr>
              <td colSpan={10} className="event-comps-table__empty">
                {t('eventComps.emptyTitle')}
              </td>
            </tr>
          ) : (
            comps.map((comp) => (
              <tr key={comp.id}>
                <td className="event-comps-table__check">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(comp.id)}
                    onChange={(event) => onToggleOne(comp.id, event.target.checked)}
                    aria-label={t('eventComps.selectComp', { name: comp.beneficiary_name })}
                  />
                </td>
                <td>
                  <strong className="event-comps-table__code">{comp.code}</strong>
                </td>
                <td>{comp.beneficiary_name}</td>
                <td className="event-comps-table__phone">{comp.phone}</td>
                <td>
                  <span className={`event-comps-type event-comps-type--${comp.type}`}>
                    {t(`eventComps.types.${comp.type}`)}
                  </span>
                </td>
                <td>{comp.benefit}</td>
                <td>
                  <span className={`event-comps-qr event-comps-qr--${comp.status}`}>
                    {t(`eventComps.status.${comp.status}`)}
                  </span>
                </td>
                <td>{formatCompDate(comp.created_at, dateLocale)}</td>
                <td>
                  {comp.used_at ? formatCompDateTime(comp.used_at, dateLocale) : '—'}
                </td>
                <td>
                  <div className="event-comps-actions">
                    <button type="button" className="event-comps-actions__btn event-comps-actions__btn--send" onClick={() => onSend(comp)}>
                      <IconSend />
                    </button>
                    <button type="button" className="event-comps-actions__btn event-comps-actions__btn--view" onClick={() => onView(comp)}>
                      <IconEye />
                    </button>
                    <button type="button" className="event-comps-actions__btn event-comps-actions__btn--cancel" onClick={() => onCancel(comp)}>
                      <IconX />
                    </button>
                    <button type="button" className="event-comps-actions__btn event-comps-actions__btn--edit" onClick={() => onEdit(comp)}>
                      <IconEdit />
                    </button>
                    <button type="button" className="event-comps-actions__btn event-comps-actions__btn--delete" onClick={() => onDelete(comp)}>
                      <IconTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
