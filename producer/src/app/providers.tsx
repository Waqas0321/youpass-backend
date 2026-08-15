import { I18nProvider } from '../i18n/provider';
import { AppRoutes } from './routes';

export function AppProviders() {
  return (
    <I18nProvider>
      <AppRoutes />
    </I18nProvider>
  );
}
