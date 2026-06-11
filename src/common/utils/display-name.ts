/** "Alejandro Rodriguez" → "Alejandro R." for home header greeting */
export function formatGreetingName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'there';
  if (parts.length === 1) return parts[0]!;
  const first = parts[0]!;
  const lastInitial = parts[parts.length - 1]![0]?.toUpperCase() ?? '';
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

export function buildHeaderGreeting(fullName: string): string {
  return `Hi, ${formatGreetingName(fullName)}!`;
}
