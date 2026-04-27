import Link from 'next/link';
import { InboxBell } from '@/components/inbox-bell';
import { MobileFrame } from '@/components/mobile-frame';
import { PropertyCard } from '@/components/property-card';
import { getServerClient } from '@/lib/api';
import {
  formatNairaFromKobo,
  sampleLongTerms,
  sampleShortLets,
} from '@/lib/sample-listings';

type FeedItem = {
  id: string;
  title: string;
  priceKobo: string;
  pricePeriod: 'night' | 'week' | 'month' | 'year';
  neighborhood: string;
  bedrooms: number;
  /** Real listing IDs link to detail; sample IDs don't. */
  href?: string;
};

type SearchParams = {
  type?: 'short_let' | 'long_term' | 'commercial' | 'all';
  bedrooms?: string;
};

const TABS: { label: string; value: SearchParams['type'] }[] = [
  { label: 'All', value: 'all' },
  { label: 'Short-let', value: 'short_let' },
  { label: 'Long-term', value: 'long_term' },
  { label: 'Commercial', value: 'commercial' },
];

async function loadFeed(
  type: 'short_let' | 'long_term',
  bedrooms?: number,
): Promise<FeedItem[]> {
  try {
    const client = getServerClient();
    const listings = await client.listListings({ type, bedrooms });
    if (listings.length > 0) {
      return listings.map((l) => ({
        id: l.id,
        title: l.title,
        priceKobo: l.priceKobo,
        pricePeriod: l.pricePeriod,
        neighborhood: l.neighborhood,
        bedrooms: l.bedrooms,
        href: `/listings/${l.id}`,
      }));
    }
  } catch {
    // API unreachable — fall through to mocks.
  }
  return type === 'short_let' ? sampleShortLets : sampleLongTerms;
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const activeType = searchParams.type ?? 'all';
  const bedrooms = searchParams.bedrooms ? Number(searchParams.bedrooms) : undefined;

  const showShortLets = activeType === 'all' || activeType === 'short_let';
  const showLongTerms = activeType === 'all' || activeType === 'long_term';

  const [shortLets, longTerms] = await Promise.all([
    showShortLets ? loadFeed('short_let', bedrooms) : Promise.resolve([] as FeedItem[]),
    showLongTerms ? loadFeed('long_term', bedrooms) : Promise.resolve([] as FeedItem[]),
  ]);

  return (
    <MobileFrame>
      <header className="px-5 pt-3 pb-0 flex items-center justify-between flex-shrink-0">
        <span className="font-display text-[26px] text-forest tracking-tight">iloja</span>
        <div className="flex items-center gap-2.5">
          <Link
            href="/listings/new"
            className="text-xs font-semibold text-grove bg-success-tint border border-mint rounded-pill px-3 py-1.5"
          >
            + List
          </Link>
          <InboxBell />
          <Link
            href="/login"
            className="w-[38px] h-[38px] rounded-full bg-gradient-to-br from-grove to-forest flex items-center justify-center text-sm font-semibold text-white shadow-card"
            aria-label="Profile"
          >
            A
          </Link>
        </div>
      </header>

      <section className="px-5 pt-4 flex-shrink-0">
        <p className="text-xs text-ink-subtle mb-0.5">Good morning</p>
        <h1 className="font-display text-[26px] text-forest tracking-tight leading-tight mb-3.5">
          Find your
          <br />
          <em className="italic font-light text-grove">next home.</em>
        </h1>

        <button className="w-full bg-white border-[1.5px] border-line-soft rounded-2xl px-3.5 py-3 flex items-center gap-2.5 shadow-card text-left">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="8" cy="8" r="5.5" stroke="#7A7A70" strokeWidth="1.5" />
            <path
              d="M12.5 12.5L15.5 15.5"
              stroke="#7A7A70"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <div className="flex-1">
            <div className="text-xs font-medium text-ink">Where are you looking?</div>
            <div className="text-[11px] text-ink-subtle">Yaba · Ikeja · Surulere · any area</div>
          </div>
          <span className="w-[34px] h-[34px] bg-forest rounded-[10px] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M4 8h8M6 12h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      </section>

      <nav className="px-5 pt-3.5 flex gap-1.5 flex-shrink-0">
        {TABS.map((tab) => {
          const active = (activeType ?? 'all') === tab.value;
          const href = tab.value === 'all' ? '/' : `/?type=${tab.value}`;
          return (
            <Link
              key={tab.label}
              href={href}
              className={
                active
                  ? 'px-4 py-1.5 rounded-pill bg-forest text-white text-xs font-medium'
                  : 'px-4 py-1.5 rounded-pill bg-parchment border-[1.5px] border-line-soft text-ink-muted text-xs font-medium'
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto pt-3.5 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {showShortLets && shortLets.length > 0 && (
          <>
            <div className="flex items-center justify-between px-5 mb-3">
              <h2 className="font-display text-lg text-forest tracking-tight">
                {activeType === 'short_let' ? 'Short-lets' : 'Short-lets nearby'}
              </h2>
              <Link
                href="/?type=short_let"
                className="text-xs text-grove font-semibold cursor-pointer"
              >
                See all →
              </Link>
            </div>

            <div className="px-5 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {shortLets.map((listing) => (
                <PropertyCard
                  key={listing.id}
                  href={listing.href}
                  title={listing.title}
                  price={formatNairaFromKobo(listing.priceKobo)}
                  pricePeriod={`/${listing.pricePeriod}`}
                  location={listing.neighborhood}
                  bedrooms={listing.bedrooms}
                  agentInitial="O"
                  agentScore={4.8}
                  agentTier="gold"
                  listingType="short-let"
                  verified
                />
              ))}
            </div>
          </>
        )}

        {showLongTerms && longTerms.length > 0 && (
          <>
            <div
              className={`flex items-center justify-between px-5 mb-3 ${
                showShortLets && shortLets.length > 0 ? 'mt-5' : ''
              }`}
            >
              <h2 className="font-display text-lg text-forest tracking-tight">
                {activeType === 'long_term' ? 'Long-term rentals' : 'Long-term rentals'}
              </h2>
              <Link
                href="/?type=long_term"
                className="text-xs text-grove font-semibold cursor-pointer"
              >
                See all →
              </Link>
            </div>

            <div className="px-5 flex flex-col gap-2.5">
              {longTerms.map((listing) => {
                const Inner = (
                  <article className="bg-white rounded-2xl overflow-hidden shadow-card border border-line flex">
                    <div className="w-[100px] flex-shrink-0 relative bg-gradient-to-br from-grove to-forest">
                      <span className="absolute top-1.5 left-1.5 bg-success-tint/95 text-grove text-[8px] font-bold px-1.5 py-0.5 rounded">
                        ✓
                      </span>
                    </div>
                    <div className="flex-1 px-3 py-2.5">
                      <div className="font-display text-[15px] font-medium text-forest mb-0.5">
                        {formatNairaFromKobo(listing.priceKobo)}{' '}
                        <span className="text-[10px] font-light text-ink-subtle">
                          /{listing.pricePeriod}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-ink mb-1">{listing.title}</div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-ink-subtle">📍 {listing.neighborhood}</span>
                        <span className="text-[9.5px] font-semibold bg-success-tint text-grove px-1.5 py-0.5 rounded">
                          ✓ Verified
                        </span>
                      </div>
                    </div>
                  </article>
                );
                return listing.href ? (
                  <Link key={listing.id} href={listing.href}>
                    {Inner}
                  </Link>
                ) : (
                  <div key={listing.id}>{Inner}</div>
                );
              })}
            </div>
          </>
        )}

        {!showShortLets && !showLongTerms && (
          <p className="px-5 text-sm text-ink-muted">No listings yet for this filter.</p>
        )}
      </div>

      <nav className="bg-white border-t border-line px-0 pt-2.5 pb-5 flex justify-around items-center flex-shrink-0">
        {[
          { label: 'Home', active: true, href: '/' },
          { label: 'Saved', active: false, href: '/saved' },
          { label: 'Inspections', active: false, href: '/inbox' },
          { label: 'Profile', active: false, href: '/login' },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="flex flex-col items-center gap-1 flex-1">
            <span
              className={`text-[9.5px] font-medium ${item.active ? 'text-forest' : 'text-ink-subtle'}`}
            >
              {item.label}
            </span>
            {item.active && <span className="w-1 h-1 rounded-full bg-grove" />}
          </Link>
        ))}
      </nav>
    </MobileFrame>
  );
}
