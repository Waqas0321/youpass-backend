import type { Dictionary } from './en';

function collectKeys(node: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      return [path];
    }
    if (value && typeof value === 'object') {
      return collectKeys(value as Record<string, unknown>, path);
    }
    return [];
  });
}

export function assertDictionaryParity(source: Dictionary, target: Dictionary) {
  const sourceKeys = new Set(collectKeys(source as Record<string, unknown>));
  const targetKeys = new Set(collectKeys(target as Record<string, unknown>));

  const missingInTarget = [...sourceKeys].filter((key) => !targetKeys.has(key));
  const missingInSource = [...targetKeys].filter((key) => !sourceKeys.has(key));

  if (missingInTarget.length > 0 || missingInSource.length > 0) {
    const details = [
      missingInTarget.length > 0 ? `Missing in target: ${missingInTarget.join(', ')}` : '',
      missingInSource.length > 0 ? `Missing in source: ${missingInSource.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    throw new Error(`Dictionary key mismatch:\n${details}`);
  }
}
