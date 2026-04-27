import { haversineMetres } from './geo';

describe('haversineMetres', () => {
  it('returns 0 for the same point', () => {
    const p = { lat: 6.5, lng: 3.3 };
    expect(haversineMetres(p, p)).toBe(0);
  });

  it('measures ~1km between adjacent Lagos points', () => {
    // Yaba ~ Surulere, two points ~1km apart in real Lagos.
    const yaba = { lat: 6.5113, lng: 3.3859 };
    const oneKmEast = { lat: 6.5113, lng: 3.395 }; // ~1.005km east at this latitude
    const d = haversineMetres(yaba, oneKmEast);
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1100);
  });

  it('flags > 200m mismatches above the verification threshold', () => {
    const a = { lat: 6.5113, lng: 3.3859 };
    // ~300m offset
    const b = { lat: 6.5113 + 0.0027, lng: 3.3859 };
    const d = haversineMetres(a, b);
    expect(d).toBeGreaterThan(200);
  });
});
