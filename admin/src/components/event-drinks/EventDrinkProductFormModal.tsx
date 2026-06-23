import { FormEvent, useEffect, useState } from 'react';
import {
  EventDrinkCategory,
  EventDrinkProduct,
  EventDrinkProductInput,
} from '../../api/client';
import { ImageUploadField } from '../ui/ImageUploadField';

type Props = {
  open: boolean;
  categories: EventDrinkCategory[];
  product: EventDrinkProduct | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: EventDrinkProductInput) => void;
};

const EMPTY: EventDrinkProductInput = {
  name: '',
  description: '',
  category_id: null,
  volume_ml: 350,
  price_clp: 5000,
  image_url: '',
  stock_total: 100,
  stock_remaining: 100,
  status: 'available',
};

export function EventDrinkProductFormModal({
  open,
  categories,
  product,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<EventDrinkProductInput>(EMPTY);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (product) {
      setForm({
        name: product.name,
        description: product.description ?? '',
        category_id: product.category_id,
        volume_ml: product.volume_ml,
        price_clp: product.price_clp,
        image_url: product.image_url ?? '',
        stock_total: product.stock_total,
        stock_remaining: product.stock_remaining,
        status: product.status,
        is_recommended: product.is_recommended,
      });
      return;
    }

    setForm({
      ...EMPTY,
      category_id: categories[0]?.category_id ?? null,
    });
  }, [open, product, categories]);

  if (!open) {
    return null;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      ...form,
      description: form.description?.trim() || null,
      image_url: form.image_url?.trim() || null,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card drink-product-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-card__header">
          <h3>{product ? 'Edit product' : 'Add product'}</h3>
          <button type="button" className="ghost-btn ghost-btn--sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="form-grid drink-product-modal__grid">
          <label className="field form-grid__full">
            <span className="field__label">Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              required
            />
          </label>

          <label className="field form-grid__full">
            <span className="field__label">Description</span>
            <textarea
              rows={3}
              value={form.description ?? ''}
              onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
            />
          </label>

          <label className="field">
            <span className="field__label">Category</span>
            <select
              value={form.category_id ?? ''}
              onChange={(e) =>
                setForm((c) => ({
                  ...c,
                  category_id: e.target.value || null,
                }))
              }
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.category_id} value={category.category_id}>
                  {category.icon ? `${category.icon} ` : ''}
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Volume (ml)</span>
            <input
              type="number"
              min={1}
              value={form.volume_ml ?? ''}
              onChange={(e) =>
                setForm((c) => ({
                  ...c,
                  volume_ml: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </label>

          <label className="field">
            <span className="field__label">Price (CLP)</span>
            <input
              type="number"
              min={0}
              value={form.price_clp}
              onChange={(e) =>
                setForm((c) => ({
                  ...c,
                  price_clp: e.target.value === '' ? 0 : Number(e.target.value),
                }))
              }
              required
            />
            <span className="field__hint">
              Set to 0 for a complimentary item (users redeem it under Cortesías).
            </span>
          </label>

          <label className="field">
            <span className="field__label">Total stock</span>
            <input
              type="number"
              min={0}
              value={form.stock_total ?? ''}
              onChange={(e) =>
                setForm((c) => ({
                  ...c,
                  stock_total: e.target.value ? Number(e.target.value) : null,
                  stock_remaining: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </label>

          <div className="form-grid__full">
            <ImageUploadField
              value={form.image_url ?? ''}
              onChange={(url) => setForm((current) => ({ ...current, image_url: url }))}
            />
          </div>
        </div>

        <div className="modal-card__footer">
          <button type="button" className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? 'Saving…' : product ? 'Save changes' : 'Create product'}
          </button>
        </div>
      </form>
    </div>
  );
}
