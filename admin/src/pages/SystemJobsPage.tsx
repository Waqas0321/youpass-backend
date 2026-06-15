import { useState } from 'react';
import { adminApi } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { IconZap } from '../components/ui/Icons';
import { PageHeader } from '../components/ui/PageHeader';

const jobs = [
  {
    id: 'release-expired' as const,
    title: 'Release expired invitations',
    detail: 'Hourly job — marks pending invitations as expired and frees slots for re-invite.',
  },
  {
    id: 'send-reminders' as const,
    title: 'Send Guaranteed Pass reminders',
    detail: 'Daily countdown reminders for active Guaranteed Pass invitations nearing their deadline.',
  },
  {
    id: 'post-event-charges' as const,
    title: 'Post-event no-show charges',
    detail: 'Captures pre-authorisations for guests who accepted but did not attend the event.',
  },
  {
    id: 'process-waitlist-offers' as const,
    title: 'Process waitlist offers',
    detail: 'Expires overdue slot offers and sends 1-hour reminders to guests with active claims.',
  },
];

export function SystemJobsPage() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState<string | null>(null);

  async function run(job: (typeof jobs)[number]['id']) {
    setRunning(job);
    setMessage('');
    setError('');
    const result = await adminApi.runSystemJob(job);
    setRunning(null);
    if (!result.ok) {
      setError(result.error ?? 'Job failed');
      return;
    }
    setMessage(`${jobs.find((j) => j.id === job)?.title ?? job} completed successfully.`);
  }

  return (
    <section className="page">
      <PageHeader
        title="System jobs"
        subtitle="Manually trigger server-side invitation cron tasks for testing or recovery."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <div className="job-grid">
        {jobs.map((job) => (
          <article key={job.id} className="job-card">
            <div className="job-card__icon">
              <IconZap />
            </div>
            <h2>{job.title}</h2>
            <p className="muted">{job.detail}</p>
            <button
              className="primary-btn"
              disabled={running === job.id}
              onClick={() => run(job.id)}
            >
              {running === job.id ? 'Running…' : 'Run now'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
