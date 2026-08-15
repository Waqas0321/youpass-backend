import { useCallback, useEffect, useState } from 'react';
import { adminApi, type EventDrinkCategory, type EventDrinkProduct } from '../api/client';

function dedupeCategories(categories: EventDrinkCategory[]) {
  const seen = new Map<string, EventDrinkCategory>();
  for (const category of categories) {
    if (!seen.has(category.slug)) {
      seen.set(category.slug, category);
    }
  }
  return [...seen.values()];
}

export function useEventDrinkMenu(eventId: string) {
  const [categories, setCategories] = useState<EventDrinkCategory[]>([]);
  const [products, setProducts] = useState<EventDrinkProduct[]>([]);
  const [currency, setCurrency] = useState('CLP');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!eventId) {
      setCategories([]);
      setProducts([]);
      setCurrency('CLP');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const [categoriesResult, productsResult] = await Promise.all([
      adminApi.eventDrinkCategories(eventId),
      adminApi.eventDrinkProducts(eventId),
    ]);

    if (!categoriesResult.ok) {
      setCategories([]);
      setProducts([]);
      setError(categoriesResult.error ?? 'Could not load drink categories');
      setLoading(false);
      return;
    }

    if (!productsResult.ok) {
      setCategories(dedupeCategories(categoriesResult.data?.categories ?? []));
      setProducts([]);
      setError(productsResult.error ?? 'Could not load drink products');
      setLoading(false);
      return;
    }

    setCategories(dedupeCategories(categoriesResult.data?.categories ?? []));
    setProducts(productsResult.data?.products ?? []);
    setCurrency(categoriesResult.data?.currency ?? productsResult.data?.currency ?? 'CLP');
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { categories, products, currency, loading, error, reload };
}
