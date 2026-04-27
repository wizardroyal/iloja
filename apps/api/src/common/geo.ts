/**
 * Great-circle distance between two WGS84 coordinates in metres (Haversine).
 * Accuracy is within ~0.5% which is more than enough for the 200m mismatch
 * threshold used by the verification flow.
 */
export function haversineMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const earthRadiusM = 6371000;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}
