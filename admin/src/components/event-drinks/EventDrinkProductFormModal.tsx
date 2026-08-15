import { FormEvent, useEffect, useState } from 'react';
import { EventDrinkCategory, EventDrinkProduct, EventDrinkProductInput } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { Modal } from '../ui/Modal';
import { EventDrinkProductFormFields } from './EventDrinkProductFormFields';
import {
  drinkProductFormToInput,
  drinkProductToFormState,
  EMPTY_DRINK_PRODUCT_FORM,
  type DrinkProductFormState,
} from './eventDrinkProductForm';

type Props = {
  open: boolean;
  categories: EventDrinkCategory[];
  currency: string;
  product: EventDrinkProduct | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: EventDrinkProductInput) => void;
};

export function EventDrinkProductFormModal({
  open,
  categories,
  currency,
  product,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const { t } = useI18n();
  const [form, setForm] = useState<DrinkProductFormState>(EMPTY_DRINK_PRODUCT_FORM);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setError('');

    if (product) {
      setForm(drinkProductToFormState(product, currency));
      return;
    }

    setForm({
      ...EMPTY_DRINK_PRODUCT_FORM,
      categoryId: categories[0]?.category_id ?? '',
    });
  }, [open, product, categories, currency]);

  function updateForm<K extends keyof DrinkProductFormState>(key: K, value: DrinkProductFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(drinkProductFormToInput(form, currency, product));
  }

  const footer = (
    <>
      <button type="button" className="event-drink-product-modal__cancel" onClick={onClose}>
        {t('common.cancel')}
      </button>
      <button type="submit" form="event-drink-product-form" className="event-drink-product-modal__submit" disabled={saving}>
        {saving
          ? t('drinkMenu.productModal.saving')
          : product
            ? t('drinkMenu.productModal.saveChanges')
            : t('drinkMenu.productModal.submit')}
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? t('drinkMenu.productModal.editTitle') : t('drinkMenu.productModal.createTitle')}
      subtitle={product ? t('drinkMenu.productModal.editSubtitle') : t('drinkMenu.productModal.subtitle')}
      closeLabel={t('common.cancel')}
      titleId="event-drink-product-modal-title"
      contentClassName="event-drink-product-modal"
      backdropClassName="modal__backdrop event-drink-product-modal__backdrop"
      error={error}
      footer={footer}
    >
      <form id="event-drink-product-form" onSubmit={handleSubmit}>
        <EventDrinkProductFormFields
          form={form}
          categories={categories}
          currency={currency}
          onChange={updateForm}
          onError={setError}
        />
      </form>
    </Modal>
  );
}
