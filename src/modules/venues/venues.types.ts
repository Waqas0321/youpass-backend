export type VenueDimensions = {
  width_meters: number;
  height_meters: number;
};

export function parseVenueDimensions(value: unknown): VenueDimensions {
  const raw = value as VenueDimensions | null;
  if (
    !raw ||
    typeof raw.width_meters !== 'number' ||
    typeof raw.height_meters !== 'number'
  ) {
    return { width_meters: 0, height_meters: 0 };
  }
  return {
    width_meters: raw.width_meters,
    height_meters: raw.height_meters,
  };
}
