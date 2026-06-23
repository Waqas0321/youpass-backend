export function formatDrinkPriceClp(clp: number) {
  if (clp <= 0) {
    return 'Free (courtesy)';
  }

  const amount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(clp);

  return `$${amount} CLP`;
}
