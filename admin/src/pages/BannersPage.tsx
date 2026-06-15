import { useEffect, useState } from 'react';
import { adminApi, HomeBanner } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusPill } from '../components/ui/StatusPill';

export function BannersPage() {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const result = await adminApi.banners();
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to load banners');
      return;
    }
    setBanners(result.data?.home_banners ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleActive(banner: HomeBanner) {
    const result = await adminApi.updateBanner(banner.id, {
      is_active: !banner.is_active,
    });
    if (!result.ok) {
      setError(result.error ?? 'Update failed');
      return;
    }
    await load();
  }

  if (loading) {
    return <LoadingBlock label="Loading banners…" />;
  }

  return (
    <section className="page">
      <PageHeader
        title="Home banners"
        subtitle="Editorial carousel slides for the mobile home screen."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="table-card">
        <div className="table-card__header">
          <h3>Carousel slides</h3>
          <span className="muted">
            {banners.filter((b) => b.is_active).length} live / {banners.length} total
          </span>
        </div>
        {banners.length === 0 ? (
          <EmptyState title="No banners yet" description="Banners will appear here once created via the API." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Banner</th>
                <th>Order</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => (
                <tr key={banner.id}>
                  <td>
                    <div className="row-title">
                      <img src={banner.image_url} alt="" />
                      <div>
                        <strong>{banner.title}</strong>
                        {banner.subtitle ? <p className="muted">{banner.subtitle}</p> : null}
                      </div>
                    </div>
                  </td>
                  <td>{banner.display_order}</td>
                  <td>
                    <StatusPill
                      label={banner.is_active ? 'Live' : 'Hidden'}
                      tone={banner.is_active ? 'success' : 'neutral'}
                    />
                  </td>
                  <td className="cell-actions">
                    <button className="ghost-btn ghost-btn--sm" onClick={() => toggleActive(banner)}>
                      {banner.is_active ? 'Hide' : 'Publish'}
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
