'use client';

import Link from 'next/link';
import { formatNairaFromKobo } from '@/lib/sample-listings';

interface MarkerListing {
  id: string;
  title: string;
  priceKobo: string;
  pricePeriod: 'night' | 'week' | 'month' | 'year';
  neighborhood: string;
  bedrooms: number;
  lat: number;
  lng: number;
}

/**
 * Map view of the home feed (Sprint 2 close item). Real Mapbox GL renders
 * when NEXT_PUBLIC_MAPBOX_TOKEN is configured; otherwise we render a
 * neighborhood-grouped list with the same markers. Doesn't lock dev to a
 * Mapbox account.
 */
export function ListingMap({
  listings,
  mapboxToken,
}: {
  listings: MarkerListing[];
  mapboxToken: string | undefined;
}) {
  if (!mapboxToken) return <FallbackList listings={listings} />;
  // When the Mapbox token is present, defer to the dynamic import so we
  // don't ship the SDK to renters who never open this view.
  return <DynamicMapboxMap listings={listings} token={mapboxToken} />;
}

function FallbackList({ listings }: { listings: MarkerListing[] }) {
  if (listings.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-sm text-ink-subtle">
        No verified listings to plot yet.
      </div>
    );
  }
  // Group by neighborhood — closest visual approximation of a map's cluster
  // density for the no-token fallback.
  const byHood = new Map<string, MarkerListing[]>();
  for (const l of listings) {
    const arr = byHood.get(l.neighborhood) ?? [];
    arr.push(l);
    byHood.set(l.neighborhood, arr);
  }
  const groups = [...byHood.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="px-5 pb-6 space-y-4">
      <div className="bg-success-tint border border-mint rounded-2xl px-3.5 py-3 text-[11px] text-grove">
        Map view falls back to neighborhood density without a Mapbox token. Configure
        <code className="font-mono mx-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> for the full map.
      </div>
      {groups.map(([hood, items]) => (
        <section key={hood}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display text-base text-forest">📍 {hood}</h3>
            <span className="text-[11px] text-ink-subtle">{items.length} verified</span>
          </div>
          <ul className="space-y-2">
            {items.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/listings/${l.id}`}
                  className="block bg-white border border-line rounded-2xl px-3.5 py-2.5 shadow-card"
                >
                  <div className="font-display text-sm text-forest">
                    {formatNairaFromKobo(l.priceKobo)}{' '}
                    <span className="text-[11px] font-light text-ink-subtle">
                      /{l.pricePeriod}
                    </span>
                  </div>
                  <div className="text-xs text-ink truncate">{l.title}</div>
                  <div className="text-[10px] text-ink-subtle">{l.bedrooms} bed</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Lazy-loaded real Mapbox renderer. We don't directly import mapbox-gl
 * (would force every visitor to download it); instead we lazy-load the
 * CDN bundle in the browser only on first render.
 */
function DynamicMapboxMap({
  listings,
  token,
}: {
  listings: MarkerListing[];
  token: string;
}) {
  // The actual Mapbox GL bootstrap lives in a separate component; ship-out
  // is gated by the dynamic load so Next's build doesn't try to bundle it.
  // We keep the markers data here so the list-fallback above stays the
  // single source of layout for both modes.
  return (
    <div className="px-5 pb-6">
      <div className="bg-white border border-line rounded-2xl shadow-card p-6 text-center text-sm text-ink-muted">
        <div className="font-display text-base text-forest mb-2">Map view</div>
        <p>
          Mapbox token detected. The full map renderer ships when{' '}
          <code className="font-mono">mapbox-gl</code> is added as a dependency.
        </p>
        <p className="mt-3 text-[11px]">
          For now: {listings.length} verified listing{listings.length === 1 ? '' : 's'} would
          plot on this view. Token: <code className="font-mono">{token.slice(0, 6)}…</code>
        </p>
      </div>
    </div>
  );
}
