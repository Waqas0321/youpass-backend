import type { ReactNode } from 'react';

type Props = {
  tone?: 'error' | 'info' | 'success';
  children: ReactNode;
  className?: string;
};

export function Alert({ tone = 'info', children, className = '' }: Props) {
  return (
    <div className={`alert alert--${tone} ${className}`.trim()} role="alert">
      {children}
    </div>
  );
}
