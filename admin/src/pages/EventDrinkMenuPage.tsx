import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  adminApi,
  type EventDrinkCategory,
  type EventDrinkCategoryInput,
  type EventDrinkProduct,
  type EventDrinkProductInput,
} from '../api/client';
import { EventDrinkCategoryBar } from '../components/event-drinks/EventDrinkCategoryBar';
import { EventDrinkCategoryModal } from '../components/event-drinks/EventDrinkCategoryModal';
import { EventDrinkProductFormModal } from '../components/event-drinks/EventDrinkProductFormModal';
import { EventDrinkProductGrid } from '../components/event-drinks/EventDrinkProductGrid';
import { EventWorkspacePage } from '../components/event-workspace/EventWorkspacePage';
import { useEventDrinkMenu } from '../hooks/useEventDrinkMenu';
import { Alert } from '../components/ui/Alert';
import { IconEdit, IconPlus, IconTrash } from '../components/ui/Icons';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { useI18n } from '../i18n/useI18n';

export function EventDrinkMenuPage() {
  const { eventId = '' } = useParams();
  const { t } = useI18n();
  const { categories, products, currency, loading, error: loadError, reload } = useEventDrinkMenu(eventId);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<EventDrinkProduct | null>(null);
  const [editingCategory, setEditingCategory] = useState<EventDrinkCategory | null>(null);
  const [gridKey, setGridKey] = useState(0);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') {
      return products;
    }
    return products.filter((product) => product.category_slug === selectedCategory);
  }, [products, selectedCategory]);

  const activeCategory = useMemo(
    () => categories.find((category) => category.slug === selectedCategory) ?? null,
    [categories, selectedCategory],
  );

  function selectCategory(slug: string) {
    setSelectedCategory(slug);
    setGridKey((current) => current + 1);
  }

  function openCreateProduct() {
    setEditingProduct(null);
    setProductModalOpen(true);
  }

  function openEditProduct(product: EventDrinkProduct) {
    setEditingProduct(product);
    setProductModalOpen(true);
  }

  function openCreateCategory() {
    setEditingCategory(null);
    setCategoryModalOpen(true);
  }

  function openEditCategory() {
    if (!activeCategory) {
      return;
    }
    setEditingCategory(activeCategory);
    setCategoryModalOpen(true);
  }

  async function saveProduct(body: EventDrinkProductInput) {
    setSaving(true);
    const result = editingProduct
      ? await adminApi.updateEventDrinkProduct(eventId, editingProduct.product_id, body)
      : await adminApi.createEventDrinkProduct(eventId, body);
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? t('drinkMenu.saveProductError'));
      return;
    }

    setProductModalOpen(false);
    setEditingProduct(null);
    setMessage(editingProduct ? t('drinkMenu.productUpdated') : t('drinkMenu.productCreated'));
    await reload();
  }

  async function saveCategory(body: EventDrinkCategoryInput) {
    setSaving(true);
    const result = editingCategory
      ? await adminApi.updateEventDrinkCategory(eventId, editingCategory.category_id, body)
      : await adminApi.createEventDrinkCategory(eventId, body);
    setSaving(false);

    if (!result.ok) {
      setError(
        result.error ??
          (editingCategory ? t('drinkMenu.updateCategoryError') : t('drinkMenu.createCategoryError')),
      );
      return;
    }

    setCategoryModalOpen(false);
    setEditingCategory(null);
    setMessage(editingCategory ? t('drinkMenu.categoryUpdated') : t('drinkMenu.categoryCreated'));
    await reload();
  }

  async function deleteCategory() {
    if (!activeCategory) {
      return;
    }

    if (!window.confirm(t('drinkMenu.deleteCategoryConfirm', { name: activeCategory.name }))) {
      return;
    }

    setSaving(true);
    const result = await adminApi.deleteEventDrinkCategory(eventId, activeCategory.category_id);
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? t('drinkMenu.deleteCategoryError'));
      return;
    }

    setSelectedCategory('all');
    setMessage(t('drinkMenu.categoryDeleted'));
    await reload();
  }

  async function mutateProduct(
    _product: EventDrinkProduct,
    action: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
  ) {
    const result = await action();
    if (!result.ok) {
      setError(result.error ?? t('drinkMenu.updateProductError'));
      return;
    }

    setMessage(successMessage);
    await reload();
  }

  async function deleteProduct(product: EventDrinkProduct) {
    if (!window.confirm(t('drinkMenu.deleteConfirm', { name: product.name }))) {
      return;
    }

    await mutateProduct(
      product,
      () => adminApi.deleteEventDrinkProduct(eventId, product.product_id),
      t('drinkMenu.productDeleted'),
    );
  }

  const headerActions = (
    <div className="event-workspace__header-action-group">
      <button
        type="button"
        className="event-workspace__btn event-workspace__btn--ghost"
        onClick={openCreateCategory}
      >
        <IconPlus />
        {t('drinkMenu.createCategory')}
      </button>
      <button type="button" className="event-workspace__btn event-workspace__btn--primary" onClick={openCreateProduct}>
        <IconPlus />
        {t('drinkMenu.addProduct')}
      </button>
    </div>
  );

  return (
    <>
      <EventWorkspacePage
        pageTitle={t('drinkMenu.title')}
        pageSubtitle={t('drinkMenu.subtitle')}
        headerActions={headerActions}
        loadingLabel={t('drinkMenu.loading')}
        notFoundLabel={t('drinkMenu.notFound')}
      >
        <div className="drink-menu-page">
          {loadError ? <Alert tone="error">{loadError}</Alert> : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
          {message ? <Alert tone="success">{message}</Alert> : null}

          <EventDrinkCategoryBar
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={selectCategory}
          />

          {activeCategory ? (
            <div className="drink-category-actions">
              <button type="button" className="drink-category-actions__btn" onClick={openEditCategory}>
                <IconEdit />
                <span>{t('drinkMenu.editCategory')}</span>
              </button>
              <button
                type="button"
                className="drink-category-actions__btn drink-category-actions__btn--danger"
                onClick={() => void deleteCategory()}
                disabled={saving}
              >
                <IconTrash />
                <span>{t('drinkMenu.deleteCategory')}</span>
              </button>
            </div>
          ) : null}

          {loading ? (
            <LoadingBlock label={t('drinkMenu.loading')} />
          ) : (
            <EventDrinkProductGrid
              key={gridKey}
              products={filteredProducts}
              currency={currency}
              onEdit={openEditProduct}
              onHide={(product) =>
                void mutateProduct(
                  product,
                  () =>
                    adminApi.updateEventDrinkProduct(eventId, product.product_id, {
                      status: 'hidden',
                    }),
                  t('drinkMenu.productUpdated'),
                )
              }
              onSoldOut={(product) =>
                void mutateProduct(
                  product,
                  () =>
                    adminApi.updateEventDrinkProduct(eventId, product.product_id, {
                      status: 'sold_out',
                    }),
                  t('drinkMenu.productUpdated'),
                )
              }
              onAvailable={(product) =>
                void mutateProduct(
                  product,
                  () =>
                    adminApi.updateEventDrinkProduct(eventId, product.product_id, {
                      status: 'available',
                    }),
                  t('drinkMenu.productAvailable'),
                )
              }
              onDuplicate={(product) =>
                void mutateProduct(
                  product,
                  () => adminApi.duplicateEventDrinkProduct(eventId, product.product_id),
                  t('drinkMenu.productDuplicated'),
                )
              }
              onDelete={(product) => void deleteProduct(product)}
              onAddProduct={openCreateProduct}
            />
          )}
        </div>
      </EventWorkspacePage>

      <EventDrinkProductFormModal
        open={productModalOpen}
        categories={categories}
        currency={currency}
        product={editingProduct}
        saving={saving}
        onClose={() => {
          setProductModalOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={saveProduct}
      />

      <EventDrinkCategoryModal
        open={categoryModalOpen}
        saving={saving}
        category={editingCategory}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        onSubmit={saveCategory}
      />
    </>
  );
}
