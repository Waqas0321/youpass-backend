import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, AdminEvent, EventDrinkProduct } from '../api/client';
import { DrinkMenuProductPreviewRow } from '../components/event-drinks/DrinkMenuProductPreviewRow';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusPill } from '../components/ui/StatusPill';

const PREVIEW_LIMIT = 6;

type EventMenu = {
  event: AdminEvent;
  products: EventDrinkProduct[];
};

type FilterMode = 'with-products' | 'all' | 'empty';

function formatEventDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function statusTone(status?: AdminEvent['status']) {
  if (status === 'published') return 'success' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'neutral' as const;
}

function sortEventMenus(menus: EventMenu[]) {
  return [...menus].sort((a, b) => {
    const aHasProducts = a.products.length > 0 ? 1 : 0;
    const bHasProducts = b.products.length > 0 ? 1 : 0;
    if (aHasProducts !== bHasProducts) {
      return bHasProducts - aHasProducts;
    }

    const aPublished = a.event.status === 'published' ? 1 : 0;
    const bPublished = b.event.status === 'published' ? 1 : 0;
    if (aPublished !== bPublished) {
      return bPublished - aPublished;
    }

    return new Date(b.event.starts_at).getTime() - new Date(a.event.starts_at).getTime();
  });
}

export function DrinkMenusPage() {
  const [eventMenus, setEventMenus] = useState<EventMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterMode>('with-products');
  const [search, setSearch] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const eventsResult = await adminApi.events();
      if (!eventsResult.ok) {
        setLoading(false);
        setError(eventsResult.error ?? 'Could not load drink menus');
        return;
      }

      const events = eventsResult.data?.events ?? [];
      const menus = await Promise.all(
        events.map(async (event) => {
          const productsResult = await adminApi.eventDrinkProducts(event.id);
          return {
            event,
            products: productsResult.ok ? (productsResult.data?.products ?? []) : [],
          };
        }),
      );

      setEventMenus(sortEventMenus(menus));
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const withProducts = eventMenus.filter((menu) => menu.products.length > 0).length;
    const totalProducts = eventMenus.reduce((sum, menu) => sum + menu.products.length, 0);
    const empty = eventMenus.length - withProducts;
    return { withProducts, totalProducts, empty };
  }, [eventMenus]);

  const visibleMenus = useMemo(() => {
    const query = search.trim().toLowerCase();

    return eventMenus.filter(({ event, products }) => {
      if (filter === 'with-products' && products.length === 0) {
        return false;
      }
      if (filter === 'empty' && products.length > 0) {
        return false;
      }
      if (!query) {
        return true;
      }

      const haystack = [
        event.title,
        event.city,
        event.venue_name,
        event.location_display,
        ...products.map((product) => product.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [eventMenus, filter, search]);

  if (loading) {
    return <LoadingBlock label="Loading drink menus…" />;
  }

  return (
    <section className="page drink-menus-overview">
      <PageHeader
        title="Drink menus"
        subtitle="Browse drink menus by event. Open any event to add categories and products."
        actions={
          <div className="drink-menus-overview__header-stats">
            <div className="drink-menus-stat">
              <strong>{stats.withProducts}</strong>
              <span>Active menus</span>
            </div>
            <div className="drink-menus-stat">
              <strong>{stats.totalProducts}</strong>
              <span>Products</span>
            </div>
            <div className="drink-menus-stat">
              <strong>{eventMenus.length}</strong>
              <span>Events</span>
            </div>
          </div>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {eventMenus.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Create an event first, then configure its drink menu."
        />
      ) : (
        <>
          <div className="drink-menus-toolbar">
            <input
              className="drink-menus-toolbar__search"
              type="search"
              placeholder="Search event or product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="drink-menus-toolbar__filters">
              <button
                type="button"
                className={
                  filter === 'with-products'
                    ? 'drink-menus-filter drink-menus-filter--active'
                    : 'drink-menus-filter'
                }
                onClick={() => setFilter('with-products')}
              >
                With products ({stats.withProducts})
              </button>
              <button
                type="button"
                className={
                  filter === 'empty' ? 'drink-menus-filter drink-menus-filter--active' : 'drink-menus-filter'
                }
                onClick={() => setFilter('empty')}
              >
                Empty ({stats.empty})
              </button>
              <button
                type="button"
                className={
                  filter === 'all' ? 'drink-menus-filter drink-menus-filter--active' : 'drink-menus-filter'
                }
                onClick={() => setFilter('all')}
              >
                All events ({eventMenus.length})
              </button>
            </div>
          </div>

          {visibleMenus.length === 0 ? (
            <EmptyState
              title="No menus match"
              description="Try another filter or search term."
            />
          ) : (
            <div className="drink-menus-overview__list">
              {visibleMenus.map(({ event, products }) => {
                const previewProducts = products.slice(0, PREVIEW_LIMIT);
                const hasMore = products.length > PREVIEW_LIMIT;

                return (
                  <section key={event.id} className="drink-menu-event-block">
                    <header className="drink-menu-event-block__toolbar">
                      {event.image_url ? (
                        <img src={event.image_url} alt="" className="drink-menu-event-block__thumb" />
                      ) : (
                        <div className="drink-menu-event-block__thumb drink-menu-event-block__thumb--placeholder" />
                      )}

                      <div className="drink-menu-event-block__info">
                        <div className="drink-menu-event-block__title-row">
                          <h3>{event.title}</h3>
                          <StatusPill label={event.status ?? 'draft'} tone={statusTone(event.status)} />
                        </div>
                        <p className="drink-menu-event-block__meta muted">
                          {formatEventDate(event.starts_at)}
                          {' · '}
                          {event.location_display ?? `${event.venue_name ?? 'Venue'}, ${event.city}`}
                          {' · '}
                          <span className="drink-menu-event-block__count">
                            {products.length} product{products.length === 1 ? '' : 's'}
                          </span>
                        </p>
                      </div>

                      <div className="drink-menu-event-block__actions">
                        <Link className="outline-btn outline-btn--sm" to={`/events/${event.id}/drinks`}>
                          Manage
                        </Link>
                        <Link className="primary-btn primary-btn--sm" to={`/events/${event.id}/drinks`}>
                          + Add product
                        </Link>
                      </div>
                    </header>

                    {products.length === 0 ? (
                      <div className="drink-menu-event-block__empty">
                        <p className="muted">No products yet.</p>
                        <Link className="primary-btn primary-btn--sm" to={`/events/${event.id}/drinks`}>
                          Set up menu
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div className="drink-menu-product-list">
                          {previewProducts.map((product) => (
                            <DrinkMenuProductPreviewRow
                              key={product.product_id}
                              product={product}
                              eventId={event.id}
                            />
                          ))}
                        </div>

                        {hasMore ? (
                          <div className="drink-menu-event-block__footer">
                            <p className="muted">
                              Showing {PREVIEW_LIMIT} of {products.length} products
                            </p>
                            <Link className="ghost-btn ghost-btn--sm" to={`/events/${event.id}/drinks`}>
                              View full menu →
                            </Link>
                          </div>
                        ) : null}
                      </>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
