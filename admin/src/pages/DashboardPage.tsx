import { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';

export function DashboardPage() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.overview().then((result) => {
      if (!result.ok) {
        setError(result.error ?? 'Failed to load overview');
        return;
      }
      setStats(result.data ?? null);
    });
  }, []);

  if (error) {
    return <Alert tone="error">{error}</Alert>;
  }

  if (!stats) {
    return <LoadingBlock label="Loading dashboard…" />;
  }

  return (
    <section className="page">
      <PageHeader
        title="Dashboard"
        subtitle="Live snapshot of users, events, invitations, and editorial content."
      />

      <div className="stat-grid">
        <StatCard label="Active users" value={stats.active_users} tone="gold" />
        <StatCard label="Producers" value={stats.producers} />
        <StatCard label="Published events" value={stats.published_events} tone="purple" />
        <StatCard label="Total invitations" value={stats.invitations_total} />
        <StatCard
          label="Pending invitations"
          value={stats.invitations_pending}
          tone="gold"
          hint="Awaiting guest response"
        />
        <StatCard label="Home banners" value={stats.home_banners} />
        <StatCard label="Active categories" value={stats.active_categories} tone="green" />
        <StatCard
          label="Waitlist queue"
          value={stats.waitlist_waiting ?? 0}
          tone="gold"
          hint="Guests waiting for courtesy slots"
        />
        <StatCard
          label="Active slot offers"
          value={stats.waitlist_active_offers ?? 0}
          tone="purple"
          hint="Exclusive claim windows in progress"
        />
      </div>

      <div className="insight-grid">
        <article className="insight-card">
          <h3>Invitation pipeline</h3>
          <p className="muted">
            {stats.invitations_pending} pending out of {stats.invitations_total} total sent.
          </p>
          <div className="progress-bar">
            <div
              className="progress-bar__fill"
              style={{
                width: `${stats.invitations_total > 0 ? Math.round((stats.invitations_pending / stats.invitations_total) * 100) : 0}%`,
              }}
            />
          </div>
        </article>
        <article className="insight-card">
          <h3>Content health</h3>
          <p className="muted">
            {stats.home_banners} carousel slides and {stats.active_categories} active category
            tabs powering the home experience.
          </p>
        </article>
      </div>
    </section>
  );
}
