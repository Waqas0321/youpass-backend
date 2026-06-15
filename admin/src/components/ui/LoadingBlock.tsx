export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-block">
      <div className="loading-block__spinner" />
      <p>{label}</p>
    </div>
  );
}
