import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, getSession, saveSession } from '../api/client';
import { IconSpark } from '../components/ui/Icons';
import { Alert } from '../components/ui/Alert';

export function LoginPage() {
  const navigate = useNavigate();
  const existing = getSession();
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? 'youpass-dev-admin-key');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    saveSession({ apiKey: apiKey.trim() });

    const result = await adminApi.overview();
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not connect to API');
      return;
    }

    navigate('/');
  }

  return (
    <div className="login-page">
      <div className="login-page__backdrop" />
      <div className="login-layout">
        <section className="login-hero">
          <span className="brand-mark brand-mark--large">
            <IconSpark className="brand-mark__icon" />
          </span>
          <h1>Run YouPass operations from one place.</h1>
          <p className="muted">
            Manage categories, banners, producer invitations, and background jobs — all wired to
            your live API.
          </p>
          <ul className="login-hero__list">
            <li>Real-time platform metrics</li>
            <li>Editorial home banner control</li>
            <li>Guaranteed Pass invitation ops</li>
          </ul>
        </section>

        <form className="login-card" onSubmit={onSubmit}>
          <div className="login-card__header">
            <h2>Sign in</h2>
            <p className="muted">Enter your admin API key to continue.</p>
          </div>

          <label className="field">
            <span className="field__label">Admin API key</span>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="youpass-dev-admin-key"
              autoComplete="off"
            />
          </label>

          <p className="hint">
            Sent as <code>x-admin-key</code> on every request. In local dev you can leave the
            backend key empty for open access.
          </p>

          {error ? <Alert tone="error">{error}</Alert> : null}

          <button className="primary-btn primary-btn--full" disabled={loading} type="submit">
            {loading ? 'Connecting…' : 'Enter console'}
          </button>
        </form>
      </div>
    </div>
  );
}
