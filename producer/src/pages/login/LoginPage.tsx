import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { devLoginDefaults } from '../../config/env';
import { loginProducer } from '../../api/auth.api';
import { saveSession } from '../../auth/session';
import { Alert } from '../../components/ui/Alert';
import { IconEye, IconLock, IconLogin, IconMail } from '../../components/ui/Icons';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useI18n } from '../../i18n/useI18n';
import { AuthLayout } from '../../layouts/AuthLayout';

export function LoginPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  useDocumentTitle('login');
  const devDefaults = devLoginDefaults();
  const [email, setEmail] = useState(devDefaults.email);
  const [password, setPassword] = useState(devDefaults.password);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const result = await loginProducer({ email, password });
    setLoading(false);

    if (!result.ok) {
      if (result.error === 'invalid_email') {
        setError(t('login.invalidEmail'));
      } else if (result.error === 'invalid_password') {
        setError(t('login.invalidPassword'));
      } else {
        setError(t('login.error'));
      }
      return;
    }

    saveSession(result.session);
    navigate('/');
  }

  return (
    <AuthLayout>
      <form className="login-panel" onSubmit={onSubmit}>
        <div className="login-panel__logo" aria-label={t('common.brand')}>
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
              required
            />
          </span>
        </label>

        <label className="login-field">
          <span className="login-field__label">{t('login.passwordLabel')}</span>
          <span className="login-field__control">
            <IconLock className="login-field__icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
    </AuthLayout>
  );
}
