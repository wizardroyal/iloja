/**
 * Address → coordinate lookup. First implementation wraps Mapbox; the
 * interface stays small enough that we could swap to OpenCage / Google /
 * locationiq with a config flip.
 */
export interface GeocodingProvider {
  geocode(address: string): Promise<GeocodeResult | null>;
}

export interface GeocodeResult {
  /** Original input, returned for the caller's audit log. */
  query: string;
  lat: number;
  lng: number;
  /** Provider-normalized address. */
  formattedAddress: string;
  /** Confidence in [0, 1]. < 0.5 should usually be rejected upstream. */
  confidence: number;
}

export const GEOCODING_PROVIDER = Symbol('GEOCODING_PROVIDER');
