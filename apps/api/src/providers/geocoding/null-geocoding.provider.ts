import { Injectable, Logger } from '@nestjs/common';
import type { GeocodeResult, GeocodingProvider } from './geocoding.provider';

/**
 * Sprint-1 stand-in. Looks up known Lagos neighborhoods in a hard-coded table
 * so dev demos work without Mapbox credentials. Real coordinates per
 * Wikipedia, accurate to ~1 decimal place — good enough to exercise the
 * GPS-mismatch code path. Returns null for anything off-table.
 */
@Injectable()
export class NullGeocodingProvider implements GeocodingProvider {
  private readonly logger = new Logger(NullGeocodingProvider.name);

  private readonly table: Record<string, { lat: number; lng: number }> = {
    yaba: { lat: 6.5113, lng: 3.3859 },
    ikeja: { lat: 6.6018, lng: 3.3515 },
    surulere: { lat: 6.5009, lng: 3.3553 },
    'lekki phase 1': { lat: 6.4435, lng: 3.4631 },
    'victoria island': { lat: 6.4282, lng: 3.4216 },
    'ikeja gra': { lat: 6.5827, lng: 3.3537 },
  };

  async geocode(address: string): Promise<GeocodeResult | null> {
    const normalized = address.toLowerCase();
    for (const [hint, coords] of Object.entries(this.table)) {
      if (normalized.includes(hint)) {
        this.logger.debug(`Null-geocoded "${address}" to ${hint}`);
        return {
          query: address,
          lat: coords.lat,
          lng: coords.lng,
          formattedAddress: address,
          confidence: 0.7,
        };
      }
    }
    this.logger.warn(`Null-geocoder could not resolve: ${address}`);
    return null;
  }
}
