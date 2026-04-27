import type { BenchmarkResponse, ListingResponse } from '@iloja/sdk';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MobileFrame } from '@/components/mobile-frame';
import { getServerClient } from '@/lib/api';
import { formatNairaFromKobo } from '@/lib/sample-listings';

interface PageProps {
  params: { id: string };
}

async function loadListing(id: string): Promise<ListingResponse | null> {
  try {
    return await getServerClient().getListing(id);
  } catch {
    return null;
  }
}

async function loadBenchmark(listing: ListingResponse): Promise<BenchmarkResponse | null> {
  try {
    return await getServerClient().benchmark({
      type: listing.type,
      neighborhood: listing.neighborhood,
      bedrooms: listing.bedrooms,
    });
  } catch {
    return null;
  }
}

/**
 * OG metadata for WhatsApp link previews. The doc explicitly calls this out
 * as the dominant top-of-funnel for Lagos agents — every listing share has
 * to render the photo, price, and verified badge.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const listing = await loadListing(params.id);
  if (!listing) return { title: 'Listing not found — Iloja' };
  const photo = listing.photos?.[0]?.url;
  const verifiedTag = listing.verifiedAt ? ' · ✓ Verified' : '';
  const title = `${formatNairaFromKobo(listing.priceKobo)} /${listing.pricePeriod} · ${listing.title}${verifiedTag}`;
  const description = `${listing.bedrooms} bed · ${listing.neighborhood}. ${listing.description.slice(0, 140)}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: photo ? [{ url: photo }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: photo ? [photo] : undefined,
    },
  };
}

export default async function ListingDetailPage({ params }: PageProps) {
  const listing = await loadListing(params.id);
  if (!listing) notFound();

  const benchmark = await loadBenchmark(listing);
  const inspectionFeeKobo = inspectionFeeFor(listing);
  const benchmarkPosition = positionVsBenchmark(BigInt(listing.priceKobo), benchmark);

  return (
    <MobileFrame>
      <Hero listing={listing} />
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <PriceBlock listing={listing} />
        <Stats listing={listing} />
        <Bench listing={listing} benchmark={benchmark} position={benchmarkPosition} />
        <div className="h-px bg-line mx-5 mb-4" />
        <ListedBy listing={listing} />
        <About listing={listing} />
        <Amenities listing={listing} />
        <div className="h-7" />
      </div>
      <CtaDock inspectionFeeKobo={inspectionFeeKobo} listingId={listing.id} />
    </MobileFrame>
  );
}

function Hero({ listing }: { listing: ListingResponse }) {
  const photo = listing.photos?.[0]?.url;
  return (
    <div className="relative h-[290px] flex-shrink-0 overflow-hidden bg-gradient-to-b from-grove via-forest to-forest-night">
      {photo && (
        // Decorative background image — concrete <img> avoids needing
        // remotePatterns to be configured for every storage host during dev.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-forest/70" />

      <Link
        href="/"
        aria-label="Back"
        className="absolute top-12 left-5 w-9 h-9 bg-white/20 backdrop-blur rounded-full border border-white/30 flex items-center justify-center"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 13L5 8l5-5"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
      <button
        aria-label="Save"
        className="absolute top-12 right-5 w-9 h-9 bg-white/20 backdrop-blur rounded-full border border-white/30 flex items-center justify-center"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 13.5L2.5 8.5C1.5 7.5 1.5 5.5 3 4.5S6 4 8 5.5C10 4 12 3.5 13 4.5S14.5 7.5 13.5 8.5L8 13.5z"
            stroke="white"
            strokeWidth="1.5"
          />
        </svg>
      </button>

      {listing.verifiedAt && (
        <div className="absolute bottom-0 left-0 right-0 bg-forest/90 backdrop-blur px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-[22px] h-[22px] bg-meadow rounded-md flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6.5l2.5 2.5L10 3"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <div className="text-[11px] font-semibold text-mint tracking-wide">
                Verified Property
              </div>
              <div className="text-[9px] text-mint/70">
                Inspected {new Date(listing.verifiedAt).toLocaleDateString('en-NG')} · GPS confirmed
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-mint/55 font-mono">on-chain record</div>
          </div>
        </div>
      )}
    </div>
  );
}

function PriceBlock({ listing }: { listing: ListingResponse }) {
  return (
    <div className="px-5 pt-5">
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="font-display text-[28px] font-medium text-forest">
          {formatNairaFromKobo(listing.priceKobo)}
        </span>
        <span className="text-[13px] text-ink-subtle font-light">/ {listing.pricePeriod}</span>
      </div>
      <h1 className="font-display text-xl text-ink leading-tight tracking-tight mb-2.5">
        {listing.title}
      </h1>
      <div className="flex items-center gap-1.5 mb-4">
        <span className="text-xs text-ink-subtle">📍</span>
        <span className="text-[13px] text-ink-muted">
          {listing.neighborhood}, Lagos · {listing.address}
        </span>
      </div>
    </div>
  );
}

function Stats({ listing }: { listing: ListingResponse }) {
  const stats = [
    { icon: '🛏', val: String(listing.bedrooms), lbl: 'Bedrooms' },
    { icon: '🛁', val: String(listing.bathrooms), lbl: 'Bathrooms' },
    { icon: '⚡', val: '24h', lbl: 'Generator' },
    { icon: '🚗', val: '1', lbl: 'Parking' },
  ];
  return (
    <div className="px-5 flex gap-2 flex-wrap mb-4">
      {stats.map((s) => (
        <div
          key={s.lbl}
          className="flex items-center gap-1.5 bg-white border border-line rounded-[10px] px-3 py-2 shadow-card"
        >
          <span className="text-[13px]">{s.icon}</span>
          <div>
            <div className="text-xs font-semibold text-ink">{s.val}</div>
            <div className="text-[10px] text-ink-muted">{s.lbl}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Bench({
  listing,
  benchmark,
  position,
}: {
  listing: ListingResponse;
  benchmark: BenchmarkResponse | null;
  position: 'below' | 'fair' | 'above' | 'unknown';
}) {
  const positionLabel: Record<typeof position, { label: string; color: string }> = {
    below: { label: 'Below', color: 'text-grove' },
    fair: { label: 'Fair', color: 'text-info' },
    above: { label: 'Above', color: 'text-warning-deep' },
    unknown: { label: '—', color: 'text-ink-subtle' },
  };

  const range =
    benchmark && benchmark.p25Kobo && benchmark.p75Kobo
      ? `${formatNairaFromKobo(benchmark.p25Kobo)} – ${formatNairaFromKobo(benchmark.p75Kobo)}`
      : 'Not enough data yet';

  return (
    <div className="mx-5 bg-success-tint border border-mint rounded-2xl px-3.5 py-3 flex items-center gap-2.5 mb-4">
      <span className="w-8 h-8 bg-grove rounded-[9px] flex items-center justify-center flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 10L5 6.5l2.5 2.5L12 3"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="flex-1">
        <div className="text-[9.5px] font-bold text-grove tracking-wider uppercase mb-0.5">
          Market price · {listing.neighborhood} · {listing.bedrooms}-bed
        </div>
        <div className="font-display text-sm text-forest">{range}</div>
        {benchmark && benchmark.sampleSize > 0 && (
          <div className="text-[10px] text-ink-muted">
            {benchmark.sampleSize} verified rental{benchmark.sampleSize === 1 ? '' : 's'} this quarter
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-[11px] font-bold ${positionLabel[position].color}`}>
          {positionLabel[position].label}
        </div>
        <div className="text-[9px] text-ink-subtle mt-0.5">vs. market</div>
      </div>
    </div>
  );
}

function ListedBy({ listing }: { listing: ListingResponse }) {
  const initial = listing.ownerId.slice(0, 1).toUpperCase();
  return (
    <div className="px-5">
      <div className="text-[10px] font-bold tracking-wider uppercase text-ink-subtle mb-2.5">
        Listed by
      </div>
      <Link
        href={`/agents/${listing.ownerId}`}
        className="block bg-white border border-line rounded-2xl p-3.5 shadow-card flex items-center gap-3 mb-4"
      >
        <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-grove to-forest flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
          {initial}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink truncate">Agent profile →</div>
          <div className="text-[11px] text-ink-subtle">View credibility, listings, reviews</div>
        </div>
        <span className="text-[11px] font-semibold text-forest bg-parchment border-[1.5px] border-line-soft rounded-[9px] px-2.5 py-1.5">
          Open
        </span>
      </Link>
    </div>
  );
}

function About({ listing }: { listing: ListingResponse }) {
  return (
    <div className="px-5 mb-4">
      <div className="text-[10px] font-bold tracking-wider uppercase text-ink-subtle mb-2.5">
        About this property
      </div>
      <p className="text-[13px] text-ink-muted leading-[1.65]">{listing.description}</p>
    </div>
  );
}

function Amenities({ listing }: { listing: ListingResponse }) {
  if (listing.amenities.length === 0) return null;
  return (
    <div className="px-5 mb-2">
      <div className="text-[10px] font-bold tracking-wider uppercase text-ink-subtle mb-2.5">
        Amenities
      </div>
      <div className="flex flex-wrap gap-2">
        {listing.amenities.map((a) => (
          <span
            key={a}
            className="bg-white border border-line rounded-lg px-2.5 py-1 text-[11px] font-medium text-ink-muted shadow-card"
          >
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

function CtaDock({ inspectionFeeKobo, listingId }: { inspectionFeeKobo: bigint; listingId: string }) {
  return (
    <div className="bg-white border-t border-line px-5 pt-3.5 pb-6 flex-shrink-0 shadow-[0_-6px_24px_rgba(26,60,52,0.07)]">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="w-[26px] h-[26px] bg-success-tint border border-mint rounded-[7px] flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1.5" y="4" width="10" height="8" rx="1.5" stroke="#2D6A4F" strokeWidth="1.3" />
              <path
                d="M4 4V3a2.5 2.5 0 015 0v1"
                stroke="#2D6A4F"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="text-[11px] font-semibold text-grove">
            Inspection fee protected by escrow
          </span>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-ink-subtle">Inspection fee</div>
          <div className="text-[13px] font-bold text-ink">{formatNairaFromKobo(inspectionFeeKobo)}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <Link
          href={`/inspections/new?listing=${listingId}`}
          className="flex-1 px-3 py-3 bg-parchment border-2 border-forest rounded-2xl text-[13px] font-bold text-forest text-center"
        >
          Schedule
        </Link>
        <Link
          href={`/chat/new?listing=${listingId}`}
          className="flex-[2] px-3 py-3 bg-forest rounded-2xl text-sm font-semibold text-white shadow-[0_4px_14px_rgba(26,60,52,0.30)] text-center"
        >
          Message agent
        </Link>
      </div>
    </div>
  );
}

/**
 * Inspection fee is a tiny fraction of the listing price, capped between
 * ₦5K and ₦25K — placeholder until the doc's pricing rules are codified.
 */
function inspectionFeeFor(listing: ListingResponse): bigint {
  const price = BigInt(listing.priceKobo);
  const onePct = price / BigInt(100);
  const min = BigInt(500_000); // ₦5,000 in kobo
  const max = BigInt(2_500_000); // ₦25,000 in kobo
  if (onePct < min) return min;
  if (onePct > max) return max;
  return onePct;
}

function positionVsBenchmark(
  price: bigint,
  benchmark: BenchmarkResponse | null,
): 'below' | 'fair' | 'above' | 'unknown' {
  if (!benchmark || !benchmark.p25Kobo || !benchmark.p75Kobo) return 'unknown';
  const p25 = BigInt(benchmark.p25Kobo);
  const p75 = BigInt(benchmark.p75Kobo);
  if (price < p25) return 'below';
  if (price > p75) return 'above';
  return 'fair';
}
