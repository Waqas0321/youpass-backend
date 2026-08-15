import type { ReactNode } from 'react';
import { IconBan, IconCheckCircle, IconInfo } from './Icons';

export type AlertTone = 'error' | 'success' | 'info' | 'warning' | 'purple';

type AlertProps = {
  tone: AlertTone;
  children: ReactNode;
  title?: string;
  icon?: ReactNode;
  className?: string;
};

const TONE_ICONS: Record<AlertTone, ReactNode> = {
  error: <IconBan />,
  success: <IconCheckCircle />,
  info: <IconInfo />,
  warning: <IconInfo />,
  purple: <IconInfo />,
};

export function Alert({ tone, children, title, icon, className }: AlertProps) {
  return (
    <div
      className={`alert alert--${tone}${className ? ` ${className}` : ''}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className="alert__icon" aria-hidden="true">
        {icon ?? TONE_ICONS[tone]}
      </span>
      <div className="alert__content">
        {title ? <strong className="alert__title">{title}</strong> : null}
        <div className="alert__body">{children}</div>
      </div>
    </div>
  );
}
