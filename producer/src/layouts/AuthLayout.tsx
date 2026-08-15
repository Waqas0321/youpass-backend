import type { ReactNode } from 'react';
import { LanguageToggle } from '../components/ui/LanguageToggle';

type Props = {
  children: ReactNode;
};

export function AuthLayout({ children }: Props) {
  return (
    <div className="login-page">
      <div className="login-page__locale">
        <LanguageToggle />
      </div>
      <div className="login-page__orb login-page__orb--top-left" aria-hidden="true" />
      <div className="login-page__orb login-page__orb--bottom-right" aria-hidden="true" />
      {children}
    </div>
  );
}
