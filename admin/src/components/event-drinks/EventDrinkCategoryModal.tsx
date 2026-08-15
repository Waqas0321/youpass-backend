import { FormEvent, useEffect, useState } from 'react';
import type { EventDrinkCategory, EventDrinkCategoryInput } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { Modal } from '../ui/Modal';
import { EventInfoField } from '../event-info/EventInfoField';

type Props = {
  open: boolean;
  saving: boolean;
  category?: EventDrinkCategory | null;
  onClose: () => void;
  onSubmit: (body: EventDrinkCategoryInput) => void;
};

export function EventDrinkCategoryModal({ open, saving, category, onClose, onSubmit }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setIcon('');
      return;
    }

    setName(category?.name ?? '');
    setIcon(category?.icon ?? '');
  }, [open, category]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    onSubmit({
      name: name.trim(),
      icon: icon.trim() || null,
    });
  }

  const isEdit = Boolean(category);

  const footer = (
    <>
      <button type="button" className="event-vip-table-modal__cancel" onClick={onClose}>
        {t('common.cancel')}
      </button>
      <button
        type="submit"
        form="event-drink-category-form"
        className="event-vip-table-modal__submit"
        disabled={saving}
      >
        {saving ? t('drinkMenu.categoryModal.saving') : isEdit ? t('common.save') : t('common.create')}
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('drinkMenu.editCategoryTitle') : t('drinkMenu.createCategoryTitle')}
      closeLabel={t('common.cancel')}
      titleId="event-drink-category-modal-title"
      contentClassName="event-drink-category-modal"
      backdropClassName="modal__backdrop"
      footer={footer}
    >
      <form id="event-drink-category-form" onSubmit={handleSubmit}>
        <EventInfoField label={t('drinkMenu.categoryName')} required className="event-drink-category-modal__field">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('drinkMenu.categoryPlaceholder')}
            required
          />
        </EventInfoField>
        <EventInfoField
          label={t('drinkMenu.categoryModal.icon')}
          hint={t('drinkMenu.categoryModal.iconHint')}
          className="event-drink-category-modal__field"
        >
          <input
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
            placeholder={t('drinkMenu.categoryModal.iconPlaceholder')}
            maxLength={8}
          />
        </EventInfoField>
      </form>
    </Modal>
  );
}
