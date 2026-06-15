export type TablePosition = {
  x: number;
  y: number;
};

export type TableIncludes = {
  bottles: number;
  bar_vouchers: number;
  extras: string[];
};

export function parseTablePosition(value: unknown): TablePosition {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const x = Number(record.x);
    const y = Number(record.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

export function parseTableIncludes(value: unknown): TableIncludes {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return {
      bottles: Number(record.bottles) || 0,
      bar_vouchers: Number(record.bar_vouchers) || 0,
      extras: Array.isArray(record.extras)
        ? record.extras.filter((item): item is string => typeof item === 'string')
        : [],
    };
  }
  return { bottles: 0, bar_vouchers: 0, extras: [] };
}

export function buildTableIncludes(input: {
  bottles?: number;
  bar_vouchers?: number;
  extras?: string[];
}): TableIncludes {
  return {
    bottles: input.bottles ?? 0,
    bar_vouchers: input.bar_vouchers ?? 0,
    extras: input.extras ?? [],
  };
}

export function isTableLockActive(
  table: {
    status: string;
    lockedUntil: Date | null;
  },
  now = new Date(),
) {
  return (
    (table.status === 'locked' || table.status === 'reserved') &&
    table.lockedUntil != null &&
    table.lockedUntil > now
  );
}
