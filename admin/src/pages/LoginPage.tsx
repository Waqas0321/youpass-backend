import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, getSession, saveSession } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { IconEye, IconLock, IconLogin, IconMail } from '../components/ui/Icons';
import { useI18n } from '../i18n/useI18n';

export function LoginPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const existing = getSession();
  const [email, setEmail] = useState('admin@youpass.com');
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? 'youpass-dev-admin-key');
  const [showPassword, setShowPassword] = useState(false);
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
      setError(result.error ?? t('login.error'));
      return;
    }

    navigate('/');
  }

  return (
    <div className="login-page">
      <div className="login-page__orb login-page__orb--top-left" aria-hidden="true" />
      <div className="login-page__orb login-page__orb--bottom-right" aria-hidden="true" />

      <form className="login-panel" onSubmit={onSubmit}>
        <div className="login-panel__logo" aria-label="YouPass">
          YouPass<sup>®</sup>
        </div>

        <div className="login-panel__subtitle">
          <span className="login-panel__subtitle-line" />
          <span className="login-panel__subtitle-text">{t('login.subtitle')}</span>
          <span className="login-panel__subtitle-line" />
        </div>

        <label className="login-field">
          <span className="login-field__label">{t('login.emailLabel')}</span>
          <span className="login-field__control">
            <IconMail className="login-field__icon" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              autoComplete="username"
            />
          </span>
        </label>

        <label className="login-field">
          <span className="login-field__label">{t('login.passwordLabel')}</span>
          <span className="login-field__control">
            <IconLock className="login-field__icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('login.passwordPlaceholder')}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login-field__toggle"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
            >
              <IconEye className="login-field__toggle-icon" />
            </button>
          </span>
        </label>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <button className="login-panel__submit" disabled={loading} type="submit">
          <IconLogin className="login-panel__submit-icon" />
          <span>{loading ? t('login.connecting') : t('login.submit')}</span>
        </button>
      </form>
    </div>
  );
}
