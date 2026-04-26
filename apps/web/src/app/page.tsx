import { MobileFrame } from '@/components/mobile-frame';
import { PropertyCard } from '@/components/property-card';

export default function HomePage() {
  return (
    <MobileFrame>
      <header className="px-5 pt-3 pb-0 flex items-center justify-between flex-shrink-0">
        <span className="font-display text-[26px] text-forest tracking-tight">iloja</span>
        <div className="flex items-center gap-2.5">
          <button
            aria-label="Notifications"
            className="w-[38px] h-[38px] rounded-full bg-parchment border border-line flex items-center justify-center shadow-card relative"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 2a5 5 0 015 5c0 2.5-1 4.5-2.5 6L9 16l-2.5-3C5 11.5 4 9.5 4 7a5 5 0 015-5z"
                stroke="#1A3C34"
                strokeWidth="1.5"
              />
              <circle cx="9" cy="7" r="1.5" fill="#1A3C34" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-danger border-[1.5px] border-cream" />
          </button>
          <div className="w-[38px] h-[38px] rounded-full bg-gradient-to-br from-grove to-forest flex items-center justify-center text-sm font-semibold text-white shadow-card">
            A
          </div>
        </div>
      </header>

      <section className="px-5 pt-4 flex-shrink-0">
        <p className="text-xs text-ink-subtle mb-0.5">Good morning, Adaeze</p>
        <h1 className="font-display text-[26px] text-forest tracking-tight leading-tight mb-3.5">
          Find your
          <br />
          <em className="italic font-light text-grove">next home.</em>
        </h1>

        <button className="w-full bg-white border-[1.5px] border-line-soft rounded-2xl px-3.5 py-3 flex items-center gap-2.5 shadow-card text-left">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="8" cy="8" r="5.5" stroke="#7A7A70" strokeWidth="1.5" />
            <path d="M12.5 12.5L15.5 15.5" stroke="#7A7A70" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div className="flex-1">
            <div className="text-xs font-medium text-ink">Where are you looking?</div>
            <div className="text-[11px] text-ink-subtle">Yaba · Ikeja · Surulere · any area</div>
          </div>
          <span className="w-[34px] h-[34px] bg-forest rounded-[10px] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 4h12M4 8h8M6 12h4"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </button>
      </section>

      <nav className="px-5 pt-3.5 flex gap-1.5 flex-shrink-0">
        {(['All', 'Short-let', 'Long-term', 'Commercial'] as const).map((tab, idx) => (
          <button
            key={tab}
            className={
              idx === 0
                ? 'px-4 py-1.5 rounded-pill bg-forest text-white text-xs font-medium'
                : 'px-4 py-1.5 rounded-pill bg-parchment border-[1.5px] border-line-soft text-ink-muted text-xs font-medium'
            }
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto pt-3.5 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-5 bg-success-tint border border-mint rounded-2xl px-3.5 py-3 flex items-center gap-2.5 mb-5">
          <span className="w-[34px] h-[34px] bg-grove rounded-[9px] flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 12L5.5 8l3 3L13 4"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="flex-1">
            <div className="text-[9.5px] font-bold text-grove tracking-wider uppercase">
              Market intelligence · Yaba
            </div>
            <div className="font-display text-[15px] text-forest">
              ₦750K – ₦1.05M{' '}
              <span className="text-[11px] font-light text-grove">/yr · 2-bed</span>
            </div>
            <div className="text-[10px] text-ink-muted">34 verified rentals this quarter</div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 mb-3">
          <h2 className="font-display text-lg text-forest tracking-tight">Short-lets nearby</h2>
          <a className="text-xs text-grove font-semibold cursor-pointer">See all →</a>
        </div>

        <div className="px-5 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <PropertyCard
            title="Studio serviced apartment, fully furnished"
            price="₦55,000"
            pricePeriod="/night"
            location="Lekki Phase 1"
            bedrooms={1}
            agentInitial="O"
            agentScore={4.9}
            agentTier="gold"
            listingType="short-let"
            verified
          />
          <PropertyCard
            title="Modern 2-bed short-let, pool access"
            price="₦38,000"
            pricePeriod="/night"
            location="Ikeja GRA"
            bedrooms={2}
            agentInitial="T"
            agentScore={4.7}
            agentTier="gold"
            listingType="short-let"
            verified
          />
          <PropertyCard
            title="Luxury penthouse, panoramic views"
            price="₦75,000"
            pricePeriod="/night"
            location="Victoria Island"
            bedrooms={3}
            agentInitial="F"
            agentScore={4.8}
            agentTier="diamond"
            listingType="short-let"
            verified
          />
        </div>

        <div className="flex items-center justify-between px-5 mt-5 mb-3">
          <h2 className="font-display text-lg text-forest tracking-tight">Long-term rentals</h2>
          <a className="text-xs text-grove font-semibold cursor-pointer">See all →</a>
        </div>

        <div className="px-5 flex flex-col gap-2.5">
          {[
            { title: '2-bedroom apartment · self-contained', price: '₦850,000', loc: 'Yaba', agent: 'Kemi Adeyemi', initial: 'K', score: 4.8, tier: 'gold' as const },
            { title: '3-bedroom flat, en-suite master', price: '₦1,200,000', loc: 'Surulere', agent: 'Biodun Lawal', initial: 'B', score: 4.9, tier: 'blue' as const },
            { title: '1-bedroom self-con, generator included', price: '₦600,000', loc: 'Ikeja', agent: 'Emeka Obi', initial: 'E', score: 4.6, tier: 'silver' as const },
          ].map((p) => (
            <article
              key={p.title}
              className="bg-white rounded-2xl overflow-hidden shadow-card border border-line flex"
            >
              <div className="w-[100px] flex-shrink-0 relative bg-gradient-to-br from-grove to-forest">
                <span className="absolute top-1.5 left-1.5 bg-success-tint/95 text-grove text-[8px] font-bold px-1.5 py-0.5 rounded">
                  ✓
                </span>
              </div>
              <div className="flex-1 px-3 py-2.5">
                <div className="font-display text-[15px] font-medium text-forest mb-0.5">
                  {p.price}{' '}
                  <span className="text-[10px] font-light text-ink-subtle">/yr</span>
                </div>
                <div className="text-xs font-medium text-ink mb-1">{p.title}</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-ink-subtle">📍 {p.loc}</span>
                  <span className="text-[9.5px] font-semibold bg-success-tint text-grove px-1.5 py-0.5 rounded">
                    ✓ Verified
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="w-[18px] h-[18px] rounded-full bg-grove flex items-center justify-center text-[7px] font-bold text-white">
                    {p.initial}
                  </span>
                  <span className="text-[10px] text-ink-muted">{p.agent}</span>
                  <span className="text-[10px] font-semibold text-grove bg-success-tint px-1.5 py-0.5 rounded">
                    {p.score.toFixed(1)}★
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <nav className="bg-white border-t border-line px-0 pt-2.5 pb-5 flex justify-around items-center flex-shrink-0">
        {[
          { label: 'Home', active: true },
          { label: 'Saved', active: false },
          { label: 'Inspections', active: false },
          { label: 'Profile', active: false },
        ].map((item) => (
          <button key={item.label} className="flex flex-col items-center gap-1 flex-1">
            <span
              className={`text-[9.5px] font-medium ${item.active ? 'text-forest' : 'text-ink-subtle'}`}
            >
              {item.label}
            </span>
            {item.active && <span className="w-1 h-1 rounded-full bg-grove" />}
          </button>
        ))}
      </nav>
    </MobileFrame>
  );
}
