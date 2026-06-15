import { FormEvent, useEffect, useState } from 'react';
import {
  adminApi,
  EventCategory,
} from '../api/client';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatusPill } from '../components/ui/StatusPill';

export function CategoriesPage() {
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  async function load() {
    const result = await adminApi.categories();
    if (!result.ok) {
      setError(result.error ?? 'Failed to load categories');
      return;
    }
    setCategories(result.data?.event_categories ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const result = await adminApi.createCategory({
      name,
      slug,
      is_active: true,
      display_order: categories.length + 1,
    });
    if (!result.ok) {
      setError(result.error ?? 'Create failed');
      return;
    }
    setName('');
    setSlug('');
    await load();
  }

  async function toggleActive(category: EventCategory) {
    const result = await adminApi.updateCategory(category.id, {
      is_active: !category.is_active,
    });
    if (!result.ok) {
      setError(result.error ?? 'Update failed');
      return;
    }
    await load();
  }

  return (
    <section className="page">
      <PageHeader
        title="Event categories"
        subtitle="Home tab filters — add, enable, or disable without redeploying the app."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Panel title="Add category" description="Creates a new filter chip on the mobile home screen.">
        <form className="inline-form" onSubmit={onCreate}>
          <label className="field">
            <span className="field__label">Display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Parties" required />
          </label>
          <label className="field">
            <span className="field__label">Slug</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="parties" required />
          </label>
          <button className="primary-btn" type="submit">
            Add category
          </button>
        </form>
      </Panel>

      <div className="table-card">
        <div className="table-card__header">
          <h3>All categories</h3>
          <span className="muted">{categories.length} total</span>
        </div>
        {categories.length === 0 ? (
          <EmptyState title="No categories yet" description="Add your first category above." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Order</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td className="cell-strong">{category.name}</td>
                  <td><code className="code-chip">{category.slug}</code></td>
                  <td>{category.display_order}</td>
                  <td>
                    <StatusPill
                      label={category.is_active ? 'Active' : 'Disabled'}
                      tone={category.is_active ? 'success' : 'neutral'}
                    />
                  </td>
                  <td className="cell-actions">
                    <button className="ghost-btn ghost-btn--sm" onClick={() => toggleActive(category)}>
                      {category.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
