import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  adminApi,
  AdminEvent,
  EventDrinkCategory,
  EventDrinkProduct,
  EventDrinkProductInput,
} from '../api/client';
import { EventDrinkProductCard } from '../components/event-drinks/EventDrinkProductCard';
import { EventDrinkProductFormModal } from '../components/event-drinks/EventDrinkProductFormModal';
import { EventWorkspaceLayout } from '../components/event-workspace/EventWorkspaceLayout';
import { Alert } from '../components/ui/Alert';
import { IconChevronLeft, IconChevronRight, IconLayoutGrid } from '../components/ui/Icons';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { useI18n } from '../i18n/useI18n';

const PAGE_SIZE = 6;

function dedupeCategories(categories: EventDrinkCategory[]) {
  const seen = new Map<string, EventDrinkCategory>();
  for (const category of categories) {
    if (!seen.has(category.slug)) {
      seen.set(category.slug, category);
    }
  }
  return [...seen.values()];
}

export function EventDrinkMenuPage() {
  const { eventId = '' } = useParams();
  const { t } = useI18n();
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [categories, setCategories] = useState<EventDrinkCategory[]>([]);
  const [products, setProducts] = useState<EventDrinkProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<EventDrinkProduct | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') {
      return products;
    }
    return products.filter((product) => product.category_slug === selectedCategory);
  }, [products, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const pageProducts = filteredProducts.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  async function loadEvent() {
    const result = await adminApi.events();
    if (result.ok) {
      setEvent(result.data?.events.find((item) => item.id === eventId) ?? null);
    }
  }

  async function loadMenu() {
    setLoading(true);
    const categoriesResult = await adminApi.eventDrinkCategories(eventId);
    if (!categoriesResult.ok) {
      setLoading(false);
      setError(categoriesResult.error ?? t('drinkMenu.loadCategoriesError'));
      return;
    }

    const productsResult = await adminApi.eventDrinkProducts(eventId);
    setLoading(false);

    if (!productsResult.ok) {
      setError(productsResult.error ?? t('drinkMenu.loadProductsError'));
      return;
    }

    setCategories(dedupeCategories(categoriesResult.data?.categories ?? []));
    setProducts(productsResult.data?.products ?? []);
  }

  useEffect(() => {
    void loadEvent();
    void loadMenu();
  }, [eventId]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategory]);

  function openCreateProduct() {
    setEditingProduct(null);
    setProductModalOpen(true);
  }

  function openEditProduct(product: EventDrinkProduct) {
    setEditingProduct(product);
    setProductModalOpen(true);
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
    await loadMenu();
  }

  async function createCategory(event: FormEvent) {
    event.preventDefault();
    if (!categoryName.trim()) {
      return;
    }

    setSaving(true);
    const result = await adminApi.createEventDrinkCategory(eventId, {
      name: categoryName.trim(),
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? t('drinkMenu.createCategoryError'));
      return;
    }

    setCategoryModalOpen(false);
    setCategoryName('');
    setMessage(t('drinkMenu.categoryCreated'));
    await loadMenu();
  }

  async function updateProductStatus(
    product: EventDrinkProduct,
    status: EventDrinkProduct['status'],
  ) {
    const result = await adminApi.updateEventDrinkProduct(eventId, product.product_id, {
      status,
    });
    if (!result.ok) {
      setError(result.error ?? t('drinkMenu.updateProductError'));
      return;
    }
    await loadMenu();
  }

  async function duplicateProduct(product: EventDrinkProduct) {
    const result = await adminApi.duplicateEventDrinkProduct(eventId, product.product_id);
    if (!result.ok) {
      setError(result.error ?? t('drinkMenu.duplicateProductError'));
      return;
    }
    setMessage(t('drinkMenu.productDuplicated'));
    await loadMenu();
  }

  async function deleteProduct(product: EventDrinkProduct) {
    if (!window.confirm(t('drinkMenu.deleteConfirm', { name: product.name }))) {
      return;
    }

    const result = await adminApi.deleteEventDrinkProduct(eventId, product.product_id);
    if (!result.ok) {
      setError(result.error ?? t('drinkMenu.deleteProductError'));
      return;
    }
    setMessage(t('drinkMenu.productDeleted'));
    await loadMenu();
  }

  const rangeStart = filteredProducts.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredProducts.length);

  return (
    <EventWorkspaceLayout event={event}>
      <div className="drink-menu-page">
        <header className="drink-menu-page__header">
          <div>
            <h1>{t('drinkMenu.title')}</h1>
            <p className="muted">{t('drinkMenu.subtitle')}</p>
          </div>
          <div className="drink-menu-page__header-actions">
            <button
              type="button"
              className="outline-btn"
              onClick={() => setCategoryModalOpen(true)}
            >
              {t('drinkMenu.createCategory')}
            </button>
            <button type="button" className="primary-btn" onClick={openCreateProduct}>
              {t('drinkMenu.addProduct')}
            </button>
          </div>
        </header>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}

        <div className="drink-category-bar">
          <button
            type="button"
            className={
              selectedCategory === 'all'
                ? 'drink-category-chip drink-category-chip--active'
                : 'drink-category-chip'
            }
            onClick={() => setSelectedCategory('all')}
          >
            <span className="drink-category-chip__icon drink-category-chip__icon--grid">
              <IconLayoutGrid />
            </span>
            {t('drinkMenu.allCategories')}
          </button>
          {categories.map((category) => (
            <button
              key={category.slug}
              type="button"
              className={
                selectedCategory === category.slug
                  ? 'drink-category-chip drink-category-chip--active'
                  : 'drink-category-chip'
              }
              onClick={() => setSelectedCategory(category.slug)}
            >
              {category.icon ? (
                <span className="drink-category-chip__icon" aria-hidden>
                  {category.icon}
                </span>
              ) : null}
              {category.name}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingBlock label={t('drinkMenu.loading')} />
        ) : pageProducts.length === 0 ? (
          <div className="drink-menu-empty">
            <h3>{t('drinkMenu.emptyTitle')}</h3>
            <p className="muted">{t('drinkMenu.emptyBody')}</p>
            <button type="button" className="primary-btn" onClick={openCreateProduct}>
              {t('drinkMenu.addProduct')}
            </button>
          </div>
        ) : (
          <div className="drink-product-grid">
            {pageProducts.map((product) => (
              <EventDrinkProductCard
                key={product.product_id}
                product={product}
                onEdit={() => openEditProduct(product)}
                onHide={() => updateProductStatus(product, 'hidden')}
                onSoldOut={() => updateProductStatus(product, 'sold_out')}
                onDuplicate={() => duplicateProduct(product)}
                onDelete={() => deleteProduct(product)}
              />
            ))}
          </div>
        )}

        <footer className="drink-menu-pagination">
          <p className="muted">
            {t('drinkMenu.pagination', {
              from: rangeStart,
              to: rangeEnd,
              total: filteredProducts.length,
            })}
          </p>
          <div className="drink-menu-pagination__controls">
            <button
              type="button"
              className="drink-menu-pagination__btn"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              aria-label="Previous page"
            >
              <IconChevronLeft />
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={
                  pageNumber === page
                    ? 'drink-menu-pagination__btn drink-menu-pagination__btn--active'
                    : 'drink-menu-pagination__btn'
                }
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              className="drink-menu-pagination__btn"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              aria-label="Next page"
            >
              <IconChevronRight />
            </button>
          </div>
        </footer>
      </div>

      <EventDrinkProductFormModal
        open={productModalOpen}
        categories={categories}
        product={editingProduct}
        saving={saving}
        onClose={() => {
          setProductModalOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={saveProduct}
      />

      {categoryModalOpen ? (
        <div className="modal-backdrop" onClick={() => setCategoryModalOpen(false)}>
          <form
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={createCategory}
          >
            <div className="modal-card__header">
              <h3>{t('drinkMenu.createCategoryTitle')}</h3>
            </div>
            <label className="field">
              <span className="field__label">{t('drinkMenu.categoryName')}</span>
              <input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder={t('drinkMenu.categoryPlaceholder')}
                required
              />
            </label>
            <div className="modal-card__footer">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setCategoryModalOpen(false)}
              >
                {t('common.cancel')}
              </button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {t('common.create')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </EventWorkspaceLayout>
  );
}
