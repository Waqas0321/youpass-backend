const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Rough city-driving estimate at ~40 km/h average. */
export function estimateCarTravelMinutes(distanceKm: number): number {
  if (distanceKm <= 0) {
    return 0;
  }
  return Math.max(1, Math.round((distanceKm / 40) * 60));
}

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export function resolveEventDistanceKm(
  event: { latitude?: number | null; longitude?: number | null },
  user?: GeoPoint | null,
): number | null {
  if (
    user == null ||
    event.latitude == null ||
    event.longitude == null ||
    Number.isNaN(event.latitude) ||
    Number.isNaN(event.longitude)
  ) {
    return null;
  }

  return haversineDistanceKm(user.latitude, user.longitude, event.latitude, event.longitude);
}
