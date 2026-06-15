import type { ReactNode } from 'react';

type PanelProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function Panel({ title, description, children, footer }: PanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>{title}</h2>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      <div className="panel__body">{children}</div>
      {footer ? <div className="panel__footer">{footer}</div> : null}
    </section>
  );
}
