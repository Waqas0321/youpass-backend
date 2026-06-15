type AlertProps = {
  tone: 'error' | 'success' | 'info';
  children: string;
};

export function Alert({ tone, children }: AlertProps) {
  return <div className={`alert alert--${tone}`}>{children}</div>;
}
